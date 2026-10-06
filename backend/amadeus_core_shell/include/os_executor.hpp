#pragma once

#include <string>
#include <functional>

// Task types that can be received from the backend
struct Task {
    std::string action;   // "click", "type", "key", "scroll", "screenshot"
    double x = 0;
    double y = 0;
    std::string text;     // for typeText
    int keycode = 0;      // for key press
    int amount = 0;       // for scroll delta
    std::string token;    // security token from backend
};

// OS-level input simulation interface.
// All functions return true on success, false on failure.
namespace os_executor {

// Move mouse cursor to (x, y) and click (left button).
bool clickAt(double x, double y);

// Move mouse cursor to (x, y) and release (used for drag).
bool moveTo(double x, double y);

// Type a string of text via keystroke events.
bool typeText(const std::string& text);

// Press a single key by keycode (X11 keycode or Win32 VK_*).
bool pressKey(int keycode);

// Scroll by 'delta' units (positive=up, negative=down).
bool scroll(int delta);

// Take a screenshot and return raw pixel data as a string (base64 PNG).
// Returns empty string on failure.
std::string takeScreenshot();

// Validate a token — only executes actions if this returns true.
// In production this calls the backend at /auth/validate.
bool validateToken(const std::string& token);

// Initialize the executor (opens X11 display or Win32 console).
bool init();

// Tear down resources.
void shutdown();

}  // namespace os_executor