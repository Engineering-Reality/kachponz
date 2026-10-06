// AmadeusCoreShell — Native C++ shell bridging OS + Amadeus Backend
// Built with CMake, GLFW, ImGui, cpp-httplib, nlohmann/json
//
// Architecture:
//   Main thread       → runs ImGui window (GLFW + OpenGL3)
//   Daemon thread     → polls system usage → POST /agent/status every 5s
//   Worker thread     → polls /agent/tasks/next → enqueues Task
//   Executor thread   → dequeues Task → validates token → executes

#include "os_executor.hpp"
#include <httplib/httplib.h>
#include <nlohmann/json.hpp>

#include <glad/glad.h>        // GL loader (GLAD_OPENGL_3_2)
#include <GLFW/glfw3.h>
#include "backends/imgui_impl_glfw.h"
#include "backends/imgui_impl_opengl3.h"
#include "imgui.h"
#include <thread>
#include <atomic>
#include <queue>
#include <chrono>
#include <csignal>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <cstdlib>
#include <cstring>

using json = nlohmann::json;

// ------------------------------------------------------------------ //
// Global configuration (read from env or hardcoded defaults)
// ------------------------------------------------------------------ //
static const char* BACKEND_HOST = std::getenv("AMADEUS_BACKEND_HOST")
                                 ? std::getenv("AMADEUS_BACKEND_HOST") : "localhost";
static const int   BACKEND_PORT = []{
    const char* p = std::getenv("AMADEUS_BACKEND_PORT");
    return p ? std::atoi(p) : 8000;
}();

// ------------------------------------------------------------------ //
// App state shared across threads
// ------------------------------------------------------------------ //
static std::queue<Task>      g_task_queue;
static std::mutex            g_queue_mutex;
static std::condition_variable g_queue_cv;
static std::atomic<bool>     g_running{true};
static std::atomic<bool>     g_authenticated{false};
static std::string           g_auth_token;
static std::string           g_last_status_msg;

// Thread-safe log buffer for the imGui overlay
static std::vector<std::string> g_log_lines;
static std::mutex               g_log_mutex;
static const size_t             MAX_LOG_LINES = 200;

static void log_message(const std::string& msg) {
    std::lock_guard<std::mutex> lock(g_log_mutex);
    auto now = std::chrono::system_clock::now();
    std::time_t t = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    ss << std::put_time(std::localtime(&t), "%H:%M:%S");
    g_log_lines.emplace_back("[" + ss.str() + "] " + msg);
    if (g_log_lines.size() > MAX_LOG_LINES) {
        g_log_lines.erase(g_log_lines.begin());
    }
}

// ------------------------------------------------------------------ //
// HTTP helper
// ------------------------------------------------------------------ //
static httplib::Client make_client() {
    httplib::Client cli(std::string(BACKEND_HOST), BACKEND_PORT);
    cli.set_connection_timeout(3);
    cli.set_read_timeout(5);
    cli.set_write_timeout(5);
    return cli;
}

// ------------------------------------------------------------------ //
// System usage: Linux /proc reader  (replace with platform-specific APIs)
// ------------------------------------------------------------------ //
static float g_cpu_pct = 0.0f;
static float g_ram_pct = 0.0f;

static void update_system_usage() {
#ifdef __linux__
    // Read /proc/stat for CPU
    {
        std::ifstream f("/proc/stat");
        std::string line;
        long long u, n, s;
        if (f >> line >> u >> n >> s) {
            static long long prev_idle = 0, prev_total = 0;
            long long idle = n, total = u + n + s;
            if (prev_total > 0) {
                long long d_idle = idle - prev_idle;
                long long d_total = total - prev_total;
                g_cpu_pct = d_total ? (float)(d_total - d_idle) / d_total * 100.0f : 0.0f;
            }
            prev_idle = idle;
            prev_total = total;
        }
    }
    // Read /proc/meminfo for RAM
    {
        std::ifstream f("/proc/meminfo");
        long long mem_total = 0, mem_available = 0;
        std::string key;
        while (f >> key >> mem_total) {
            if (key == "MemTotal:") {
                f >> mem_available; // consume it
            } else if (key == "MemAvailable:") {
                f >> mem_available;
                g_ram_pct = mem_total ? (float)(mem_total - mem_available) / mem_total * 100.0f : 0.0f;
                break;
            }
        }
    }
#elif defined(_WIN32)
    MEMORYSTATUSEX ms{};
    ms.dwLength = sizeof(ms);
    if (GlobalMemoryStatusEx(&ms)) {
        g_ram_pct = (float)ms.dwMemoryLoad;
    }
    // g_cpu_pct on Windows can use a PDH counter — placeholder here
    g_cpu_pct = 0.0f;
#else
    g_cpu_pct = 0.0f;
    g_ram_pct = 0.0f;
#endif
}

// ------------------------------------------------------------------ //
// Background daemon: send system usage every 5 s
// ------------------------------------------------------------------ //
static void daemon_thread_fn() {
    log_message("Daemon thread started (system status @ " + std::string(BACKEND_HOST)
                + ":" + std::to_string(BACKEND_PORT) + "/agent/status)");
    while (g_running) {
        update_system_usage();
        json payload = {
            {"hostname",    "amadeus-core-shell"},
            {"cpu_percent", g_cpu_pct},
            {"ram_percent", g_ram_pct},
            {"timestamp",   std::time(nullptr)}
        };
        try {
            auto cli = make_client();
            json headers;
            if (!g_auth_token.empty()) {
                httplib::Headers hdr = {{"Authorization", "Bearer " + g_auth_token}};
            }
            auto rv = cli.Post("/agent/status", payload.dump(), "application/json");
            if (rv && rv->status == 200) {
                g_last_status_msg = "OK";
            } else {
                g_last_status_msg = rv
                    ? ("HTTP " + std::to_string(rv->status))
                    : "connection failed";
            }
        } catch (const std::exception& e) {
            g_last_status_msg = std::string("exception: ") + e.what();
        }

        for (int i = 0; i < 50 && g_running; ++i) { // check every 100 ms
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
    }
    log_message("Daemon thread stopped");
}

// ------------------------------------------------------------------ //
// Poller: fetch next task every 2 s
// ------------------------------------------------------------------ //
static std::thread start_poller() {
    return std::thread([=]() {
        log_message("Worker thread started (task poll @ "
                    + std::string(BACKEND_HOST) + ":" + std::to_string(BACKEND_PORT)
                    + "/agent/tasks/next)");
        while (g_running) {
            try {
                auto cli = make_client();
                if (!g_auth_token.empty()) {
                    httplib::Headers hdr = {{"Authorization", "Bearer " + g_auth_token}};
                }
                auto rv = cli.Get("/agent/tasks/next");
                if (rv && rv->status == 200) {
                    auto body = json::parse(rv->body, nullptr, false);
                    if (!body.is_discarded() && body.contains("action")) {
                        Task t;
                        t.action = body.value("action", "");
                        t.x      = body.value("x", 0.0);
                        t.y      = body.value("y", 0.0);
                        t.text   = body.value("text", "");
                        t.keycode = body.value("keycode", 0);
                        t.amount  = body.value("amount", 0);
                        t.token   = body.value("token", "");

                        // TODO: real token verification with backend before enqueuing
                        // For now we only check non-empty token
                        if (!t.token.empty() || t.action == "noop") {
                            std::lock_guard<std::mutex> lock(g_queue_mutex);
                            g_task_queue.push(t);
                            log_message("Task queued: " + t.action);
                        } else {
                            log_message("Task rejected: missing token");
                        }
                    }
                    // If no action field → empty → just idle
                } else if (rv && rv->status != 204) {
                    // Non-empty but no task → normal idle
                }
            } catch (const std::exception& e) {
                log_message(std::string("Poller error: ") + e.what());
            }

            for (int i = 0; i < 20 && g_running; ++i) { // 2 s total (20 × 100 ms)
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
        }
        log_message("Worker thread stopped");
    });
}

// ------------------------------------------------------------------ //
// Token validation via backend
// ------------------------------------------------------------------ //
static bool verify_token_with_backend(const std::string& token) {
    try {
        auto cli = make_client();
        httplib::Headers hdr = {{"Authorization", "Bearer " + token}};
        auto rv = cli.Get("/auth/validate");
        // g_authenticated is set on success
        return rv && rv->status == 200;
    } catch (...) {
        return false;
    }
}

// ------------------------------------------------------------------ //
// Task executor: pop from queue, validate, run
// ------------------------------------------------------------------ //
static void execute_task(const Task& t) {
    // Security gate: execute only if token is valid
    if (!os_executor::validateToken(t.token)) {
        // Try backend validation
        if (!verify_token_with_backend(t.token)) {
            log_message("[SECURITY] Task '" + t.action + "' blocked — invalid token");
            return;
        }
    }

    bool ok = false;
    if (t.action == "click") {
        ok = os_executor::clickAt(t.x, t.y);
    } else if (t.action == "type") {
        ok = os_executor::typeText(t.text);
    } else if (t.action == "move") {
        ok = os_executor::moveTo(t.x, t.y);
    } else if (t.action == "scroll") {
        ok = os_executor::scroll(t.amount);
    } else if (t.action == "key") {
        ok = os_executor::pressKey(t.keycode);
    } else if (t.action == "noop") {
        ok = true;  // heartbeat
    } else {
        log_message("Unknown action: " + t.action);
        return;
    }

    log_message("Executed '" + t.action + "' → " + std::string(ok ? "OK" : "FAILED"));
}

static void executor_thread_fn() {
    while (g_running) {
        Task t;
        {
            std::unique_lock<std::mutex> lock(g_queue_mutex);
            g_queue_cv.wait_for(lock, std::chrono::milliseconds(500),
                                [&]{ return !g_task_queue.empty() || !g_running; });
            if (!g_running) break;
            if (!g_task_queue.empty()) {
                t = g_task_queue.front();
                g_task_queue.pop();
            } else {
                continue;
            }
        }
        execute_task(t);
    }
}

// ------------------------------------------------------------------ //
// ImGui minimal overlay
// ------------------------------------------------------------------ //
static void error_callback(int err, const char* msg) {
    fprintf(stderr, "[GLFW Error %d] %s\n", err, msg);
}

static void glsl_version(int major, int minor, std::ostringstream& out) {
    out << "#version " << major << minor << "0\n";
}

int main(int argc, char** argv) {
    // Parse --token <token> from CLI
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--token" && i + 1 < argc) {
            g_auth_token = argv[++i];
        } else if (arg == "--backend" && i + 1 < argc) {
            BACKEND_HOST = argv[++i];
        }
    }

    // Initialize OS executor first
    if (!os_executor::init()) {
        fprintf(stderr, "[FATAL] os_executor::init() failed.\n");
        return 1;
    }

    // Set up error logging callback
    glfwSetErrorCallback(error_callback);

    // Required on some Linux distros before glfwInit()
    if (!glfwInit()) {
        fprintf(stderr, "[FATAL] GLFW init failed.\n");
        return 1;
    }
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 2);

#ifdef __APPLE__
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GLFW_TRUE);
#endif

    // ---------- Minimal overlay window ----------
    GLFWmonitor* primary = glfwGetPrimaryMonitor();
    const GLFWvidmode* mode = glfwGetVideoMode(primary);

    // Small settings window (top-right corner)
    int ww = 420, wh = 300;
    GLFWwindow* win = glfwCreateWindow(ww, wh,
        "AmadeusCoreShell",
        nullptr, nullptr);
    if (!win) {
        fprintf(stderr, "[FATAL] GLFW window creation failed.\n");
        glfwTerminate();
        return 1;
    }
    glfwMakeContextCurrent(win);
    glfwSwapInterval(1);  // vsync

    // Load OpenGL function pointers (GLAD must be built into the project
    // OR linked via system's libglad. For a self-contained build we rely on
    // glfwGetProcAddress + a simple GL loader header below.)
    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
        fprintf(stderr, "[FATAL] GLAD GL loader failed.\n");
        return 1;
    }

    // ImGui context
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO();
    io.IniFilename = nullptr;  // don't write imgui.ini
    // (Optional: load a small font from system)

    ImGui_ImplGlfw_InitForOpenGL(win, true);
    ImGui_ImplOpenGL3_Init("#version 130");  // GLSL 130 for GLFW 3

    // Style: dark overlay
    ImGui::StyleColorsDark();

    log_message("AmadeusCoreShell started");
    if (!g_auth_token.empty()) {
        if (verify_token_with_backend(g_auth_token)) {
            g_authenticated = true;
            log_message("Token verified: access granted");
        } else {
            log_message("[WARN] Token verification failed — tasks will be blocked");
        }
    }

    // Launch daemon + worker threads
    std::thread daemon(daemon_thread_fn);
    std::thread worker = start_poller();
    std::thread executor(executor_thread_fn);

    // ---------- Render loop ----------
    while (g_running && !glfwWindowShouldClose(win)) {
        glfwPollEvents();

        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplGlfw_NewFrame();
        ImGui::NewFrame();

        // ── Minimal overlay panel ──────────────────────────────────
        ImGui::SetNextWindowPos(ImVec2(0, 0));
        ImGui::SetNextWindowSize(ImGui::GetIO().DisplaySize);
        ImGui::SetNextWindowBgAlpha(0.0f);

        ImGuiWindowFlags flags =
            ImGuiWindowFlags_NoTitleBar |
            ImGuiWindowFlags_NoResize |
            ImGuiWindowFlags_NoMove |
            ImGuiWindowFlags_NoScrollbar |
            ImGuiWindowFlags_NoSavedSettings |
            ImGuiWindowFlags_NoInputs;

        ImGui::Begin("##overlay", nullptr, flags);

        // Bottom status bar
        ImGui::SetCursorPos(ImVec2(8, mode ? mode->height - 32 : 720 - 32));
        ImGui::PushStyleVar(ImGuiStyleVar_Alpha, 0.7f);
        ImGui::BeginGroup();
        ImGui::TextColored(g_authenticated ? ImVec4(0,1,0,1) : ImVec4(1,0.5,0,1),
                           g_authenticated ? "AMADEUS [AUTH]" : "AMADEUS [UNAUTH]");
        ImGui::SameLine();
        ImGui::Text(" CPU:%.1f%%  RAM:%.1f%%", g_cpu_pct, g_ram_pct);
        char label[64];
        snprintf(label, sizeof(label), "  %s", g_last_status_msg.c_str());
        ImGui::Text(label);
        ImGui::EndGroup();
        ImGui::PopStyleVar();

        ImGui::End();

        // ── Settings panel (top-left, small) ─────────────────────────
        ImGui::SetNextWindowPos(ImVec2(8, 8), ImGuiCond_Once);
        ImGui::SetNextWindowSize(ImVec2(380, 0));
        if (ImGui::Begin("AmadeusCoreShell", nullptr,
                         ImGuiWindowFlags_AlwaysAutoResize |
                         ImGuiWindowFlags_NoSavedSettings)) {
            ImGui::Text(" AmadeusCoreShell v0.1");
            ImGui::Separator();
            ImGui::Text("Backend: %s:%d", BACKEND_HOST, BACKEND_PORT);
            ImGui::Text("Auth:    %s",
                        g_authenticated ? "verified" :
                        g_auth_token.empty() ? "no token" : "failed");
            ImGui::Text("CPU:     %.1f%%", g_cpu_pct);
            ImGui::Text("RAM:     %.1f%%", g_ram_pct);
            ImGui::Text("Queue:   %zu task(s)", g_task_queue.size());
            ImGui::Separator();

            if (ImGui::CollapsingHeader("Log", ImGuiTreeNodeFlags_DefaultOpen)) {
                ImGuiListClipper clipper;
                std::lock_guard<std::mutex> lock(g_log_mutex);
                clipper.Begin((int) g_log_lines.size());
                while (clipper.Step()) {
                    for (int i = clipper.DisplayStart; i < clipper.DisplayEnd; ++i) {
                        ImGui::TextUnformatted(g_log_lines[i].c_str());
                    }
                }
                clipper.End();
                if (!g_log_lines.empty() && ImGui::GetScrollY() >= ImGui::GetScrollMaxY()) {
                    ImGui::SetScrollHereY(1.0f);
                }
            }

            if (ImGui::Button("Exit")) {
                g_running = false;
                glfwSetWindowShouldClose(win, GLFW_TRUE);
            }
        }
        ImGui::End();

        ImGui::Render();
        glViewport(0, 0, (int)io.DisplaySize.x, (int)io.DisplaySize.y);
        glClear(GL_COLOR_BUFFER_BIT);
        ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
        glfwSwapBuffers(win);
    }

    // ---------- Shutdown ----------
    g_running = false;
    g_queue_cv.notify_all();

    log_message("Shutting down...");
    daemon.join();
    worker.join();
    executor.join();

    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplGlfw_Shutdown();
    ImGui::DestroyContext();
    glfwDestroyWindow(win);
    glfwTerminate();
    os_executor::shutdown();

    log_message("Goodbye.");
    return 0;
}
