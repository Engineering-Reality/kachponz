# AmadeusCoreShell

Native C++ desktop shell that bridges the local OS with the Amadeus Backend (FastAPI).
Built with CMake, GLFW, ImGui, cpp-httplib, and nlohmann/json.

## Architecture

```
┌──────────────────────────────────────────────┐
│             AmadeusCoreShell                  │
│                                              │
│  Main thread:  ImGui overlay (GLFW+OpenGL)    │
│  Daemon thread: system usage → POST /status  │  ← every 5 s
│  Worker thread: poll GET /tasks/next          │  ← every 2 s
│  Executor thread: validate token → exec task │
└──────────┬───────────────────────────────────┘
           │ HTTP (Bearer token auth)
           ▼
┌─────────────────────────────────────┐
│    Amadeus Backend  (localhost:8000) │
│    FastAPI microservice              │
│    - /agent/status  (POST)            │
│    - /agent/tasks/next (GET)         │
│    - /auth/validate  (GET)          │
└─────────────────────────────────────┘
```

## File Structure

```
amadeus_core_shell/
├── CMakeLists.txt          ← build configuration
├── CMakePresets.json       ← cmake --preset profiles
├── .gitignore
├── README.md
├── include/
│   └── os_executor.hpp      ← OS input interface (click, type, scroll...)
└── src/
    ├── main.cpp             ← entry point + ImGui + thread orchestration
    └── os_executor.cpp      ← Linux X11/XTest or Win32 SendInput
```

## Dependencies (Linux)

```bash
sudo apt install \
    build-essential cmake pkg-config \
    libgl1-mesa-dev libglfw3-dev \
    libx11-dev libxext-dev libxtst-dev \
    libxcursor-dev libxrandr-dev libxi-dev \
    libglu1-mesa-dev
```

### Why these packages?

| Package | Used for |
|---------|----------|
| `libgl1-mesa-dev` | OpenGL headers (`GL/gl.h`) |
| `libglfw3-dev` | GLFW window + context |
| `libx11-dev` | X11 display connection |
| `libxtst-dev` | XTest — key/mouse simulation |
| `libxi-dev` | XInput — scroll/advanced input |
| `libglu1-mesa-dev` | GLU (sometimes needed by ImGui's GL3 backend) |

If `libxtst-dev` is not available the `HAVE_XTEST` define is not set and input
simulation will log a warning but still build.

## Build (Linux)

```bash
# 1. Create and enter build directory
mkdir build && cd build

# 2. Configure (CMake will auto-fetch httplib, nlohmann-json, ImGui via FetchContent)
cmake ..

# 3. Compile (uses all CPU cores)
make -j$(nproc)

# 4. Run (set AMADEUS_BACKEND_HOST/PORT env vars, or use --backend / --token flags)
./AmadeusCoreShell --token YOUR_API_TOKEN --backend localhost
```

Or use a preset:

```bash
cmake --preset linux-default
cmake --build --preset linux-default
./build/AmadeusCoreShell --token YOUR_API_TOKEN
```

## Build (Windows — MSVC)

```bat
:: Open a "x64 Native Tools Command Prompt for VS 2022"
mkdir build && cd build
cmake .. -G "Visual Studio 17 2022" -A x64
cmake --build . --config Release
Release\AmadeusCoreShell.exe --token YOUR_API_TOKEN
```

Or with Ninja (faster):

```bat
cmake .. -G Ninja -DCMAKE_BUILD_TYPE=Release
ninja
```

## Usage

```bash
# Basic (uses localhost:8000)
./AmadeusCoreShell --token "your-jwt-token"

# Custom backend host
AMADEUS_BACKEND_HOST=192.168.1.100 AMADEUS_BACKEND_PORT=8080 \
  ./AmadeusCoreShell --token "token" --backend 192.168.1.100

# Token only via env var
export AMADEUS_BACKEND_TOKEN="your-jwt-token"
./AmadeusCoreShell
```

## Backend Endpoints Expected

The shell sends/receives from these FastAPI routes (ensure they exist in your
`app.py` or a dedicated microservice):

| Method | Path | Body / Response |
|--------|------|----------------|
| POST | `/agent/status` | `{"hostname":str,"cpu_percent":float,"ram_percent":float,"timestamp":int}` |
| GET | `/agent/tasks/next` | `{"action":str,"x":float,"y":float,"text":str,"keycode":int,"amount":int,"token":str}` |
| GET | `/auth/validate` | Returns 200 if `Authorization: Bearer <token>` is valid |

## Security

- **Token required**: every task carries a `token` field. The executor rejects
  any task whose token cannot be validated against the backend at `/auth/validate`.
- **No token → no execution**: if no `--token` is provided at startup, the shell
  runs in **read-only mode** (only collects system stats, ignores all tasks).
- **In-process validation**: `os_executor::validateToken()` is a fast guard;
  full validation hits the backend endpoint before executing any OS call.
- **Configurable via env**: backend host/port can be set via environment
  variables without recompiling.

## ImGui Overlay

The overlay is minimal and non-intrusive:

- **Top-left**: settings panel (collapsible) showing backend, auth, CPU/RAM, queue size, and a live log of all events.
- **Bottom bar**: translucent status strip showing `AMADEUS [AUTH/UNAUTH]` + CPU/RAM + last `/agent/status` result.

To move or resize the overlay, edit the `ImGui::SetNextWindowPos/Size` calls
in `src/main.cpp`.

## Keyboard Shortcuts in Overlay

| Key | Action |
|-----|--------|
| `Esc` | Close window (triggers shutdown) |
| Click "Exit" button | Clean shutdown |
| Window close button | Clean shutdown |

## Customization

- **Change window size**: edit `ww = 420, wh = 300` in `main.cpp`.
- **Change poll intervals**: `daemon_thread_fn` sleeps in 100 ms increments
  for a total of 5 s. Change `50` to any value.
- **Add task types**: add a branch in `execute_task()` for new actions.
- **Screenshot**: `os_executor.cpp` has a stub; replace the placeholder with
  `XGetImage` (X11) or `BitBlt` (Win32).

## Troubleshooting

**"Cannot open X11 display"** — `DISPLAY` env var not set.
```bash
export DISPLAY=:0   # or whatever your X server is
./AmadeusCoreShell ...
```

**"GLAD GL loader failed"** — GLFW compiled without OpenGL support.
Install `libgl1-mesa-dev` and rebuild GLFW or use a system-installed version.

**Tasks not executing** — Token verification failing.
Check that `/auth/validate` returns 200 in your FastAPI app, and that the
token format matches what the backend issues.

## License

MIT