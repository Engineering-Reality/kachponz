#include "os_executor.hpp"

#ifdef __linux__

#include <cstring>
#include <cerrno>
#include <X11/Xlib.h>
#include <X11/keysym.h>
#include <X11/keysymdef.h>
#include <X11/extensions/XTest.h>

// Shared X11 display and current keymap per process
static Display* g_display = nullptr;
static unsigned int g_keymap[32] = {0};
static bool g_keymap_loaded = false;

static bool ensureDisplay() {
    if (!g_display) {
        g_display = XOpenDisplay(nullptr);
        if (!g_display) {
            fprintf(stderr, "[os_executor] Cannot open X11 display: %s\n", strerror(errno));
            return false;
        }
    }
    return true;
}

bool init() {
    if (!ensureDisplay()) return false;
    // Pre-fetch keymap so typeText can map ASCII -> keycode
    XQueryKeymap(g_display, (char*)g_keymap);
    g_keymap_loaded = true;
    fprintf(stderr, "[os_executor] X11 display opened: %s\n", DisplayString(g_display));
    return true;
}

void shutdown() {
    if (g_display) {
        XCloseDisplay(g_display);
        g_display = nullptr;
        g_keymap_loaded = false;
    }
}

static KeyCode charToKeycode(char c) {
    // Try XLookupKeysym: works for ASCII letters, digits, punctuation
    KeySym keysym = 0;
    if (c >= 32 && c <= 126) {
        keysym = c;  // printable ASCII maps directly to keysym
    } else if (c == ' ') {
        keysym = XK_space;
    }

    KeyCode kc = XKeysymToKeycode(g_display, keysym);
    return kc ? kc : 0;
}

bool clickAt(double x, double y) {
    if (!ensureDisplay()) return false;
    XTestFakeMotionEvent(g_display, 0, static_cast<int>(x), static_cast<int>(y), 0);
    XTestFakeButtonEvent(g_display, Button1, True, 0);   // press
    XTestFakeButtonEvent(g_display, Button1, False, 0);  // release
    XFlush(g_display);
    return true;
}

bool moveTo(double x, double y) {
    if (!ensureDisplay()) return false;
    XTestFakeMotionEvent(g_display, 0, static_cast<int>(x), static_cast<int>(y), 0);
    XFlush(g_display);
    return true;
}

bool typeText(const std::string& text) {
    if (!ensureDisplay()) return false;
    if (!g_keymap_loaded) {
        XQueryKeymap(g_display, (char*)g_keymap);
        g_keymap_loaded = true;
    }
    for (unsigned char uc : text) {
        KeyCode kc = charToKeycode(static_cast<char>(uc));
        if (!kc) continue;
        // Key press + release
        XTestFakeKeyEvent(g_display, kc, True, 0);
        XTestFakeKeyEvent(g_display, kc, False, 0);
    }
    XFlush(g_display);
    return true;
}

bool pressKey(int keycode) {
    if (!ensureDisplay()) return false;
    XTestFakeKeyEvent(g_display, static_cast<KeyCode>(keycode), True, 0);
    XTestFakeKeyEvent(g_display, static_cast<KeyCode>(keycode), False, 0);
    XFlush(g_display);
    return true;
}

bool scroll(int delta) {
    if (!ensureDisplay()) return false;
    // Button 4 = scroll up, Button 5 = scroll down
    int button = (delta > 0) ? 4 : 5;
    int repeats = std::abs(delta);
    for (int i = 0; i < repeats; ++i) {
        XTestFakeButtonEvent(g_display, button, True, 0);
        XTestFakeButtonEvent(g_display, button, False, 0);
    }
    XFlush(g_display);
    return true;
}

std::string takeScreenshot() {
    // Screenshot not implemented in this version
    return "";
}

bool validateToken(const std::string& token) {
    return !token.empty();
}

#elif defined(_WIN32) || defined(WIN32)

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <cstring>

// Use SendInput for Windows input simulation
static bool s_input_initialized = false;

bool init() {
    // AllocConsole() lets us see fprintf output in a debug console.
    // The shell typically runs as a GUI app, so console output is invisible by default.
    // For production, use OutputDebugStringA instead.
    AllocConsole();
    fprintf(stderr, "[os_executor] Windows input subsystem initialized.\n");
    s_input_initialized = true;
    return true;
}

void shutdown() {
    if (s_input_initialized) {
        FreeConsole();
        s_input_initialized = false;
    }
}

static void moveMouse(double x, double y) {
    double nx = x * (65535.0 / GetSystemMetrics(SM_CXSCREEN));
    double ny = y * (65535.0 / GetSystemMetrics(SM_CYSCREEN));
    INPUT input[1] = {};
    input[0].type = INPUT_MOUSE;
    input[0].mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_MOVEANDACTIVATE;
    input[0].mi.dx = static_cast<LONG>(nx);
    input[0].mi.dy = static_cast<LONG>(ny);
    SendInput(1, input, sizeof(INPUT));
}

static void leftClick() {
    INPUT input[2] = {};
    input[0].type = INPUT_MOUSE;
    input[0].mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
    input[1].type = INPUT_MOUSE;
    input[1].mi.dwFlags = MOUSEEVENTF_LEFTUP;
    SendInput(2, input, sizeof(INPUT));
}

bool clickAt(double x, double y) {
    moveMouse(x, y);
    Sleep(10);
    leftClick();
    return true;
}

bool moveTo(double x, double y) {
    moveMouse(x, y);
    return true;
}

bool typeText(const std::string& text) {
    for (char c : text) {
        SHORT vk = VkKeyScanA(c);
        if (vk == -1) continue;
        WORD vkcode = LOBYTE(vk);
        WORD shift = HIBYTE(vk);  // shift state

        INPUT inputs[4] = {};
        int n = 0;
        if (shift & 1) {
            inputs[n++] = {INPUT_KEYBOARD, {VK_SHIFT, 0, KEYEVENTF_EXTENDEDKEY, 0, nullptr}};
        }
        inputs[n++] = {INPUT_KEYBOARD, {static_cast<WORD>(vkcode), 0, 0, 0, nullptr}};
        inputs[n++] = {INPUT_KEYBOARD, {static_cast<WORD>(vkcode), 0, KEYEVENTF_KEYUP, 0, nullptr}};
        if (shift & 1) {
            inputs[n++] = {INPUT_KEYBOARD, {VK_SHIFT, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0, nullptr}};
        }
        SendInput(n, inputs, sizeof(INPUT));
        Sleep(30);
    }
    return true;
}

bool pressKey(int keycode) {
    INPUT inputs[2] = {};
    inputs[0].type = INPUT_KEYBOARD;
    inputs[0].ki.wVk = static_cast<WORD>(keycode);
    inputs[1].type = INPUT_KEYBOARD;
    inputs[1].ki.wVk = static_cast<WORD>(keycode);
    inputs[1].ki.dwFlags = KEYEVENTF_KEYUP;
    SendInput(2, inputs, sizeof(INPUT));
    return true;
}

bool scroll(int delta) {
    // Positive = wheel up, negative = wheel down
    INPUT input = {};
    input.type = INPUT_MOUSE;
    input.mi.dwFlags = MOUSEEVENTF_WHEEL;
    input.mi.mouseData = static_cast<DWORD>(delta * 120);
    SendInput(1, &input, sizeof(INPUT));
    return true;
}

std::string takeScreenshot() {
    // Screenshot not implemented in this version
    return "";
}

bool validateToken(const std::string& token) {
    return !token.empty();
}

#else
#error "Unsupported platform"
#endif