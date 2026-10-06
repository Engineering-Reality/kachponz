cmake_minimum_required(VERSION 3.16)
project(AmadeusCoreShell VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# ---------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------
if(WIN32)
    set(PLATFORM_TARGET "windows")
elseif(UNIX AND NOT APPLE)
    set(PLATFORM_TARGET "linux")
    find_package(X11 REQUIRED)
    find_package(PkgConfig REQUIRED)
else()
    message(FATAL_ERROR "Unsupported platform: ${CMAKE_SYSTEM_NAME}")
endif()

message(STATUS "Building for platform: ${PLATFORM_TARGET}")

# ---------------------------------------------------------------
# FetchContent: httplib + nlohmann/json + ImGui (all header-only)
# ---------------------------------------------------------------
include(FetchContent)

FetchContent_Declare(
    httplib
    GIT_REPOSITORY  https://github.com/yhirose/cpp-httplib.git
    GIT_SHALLOW     FALSE
    GIT_PROGRESS    TRUE
)
FetchContent_Declare(
    nlohmann_json
    GIT_REPOSITORY  https://github.com/nlohmann/json.git
    GIT_SHALLOW     TRUE
    GIT_PROGRESS    TRUE
)
FetchContent_Declare(
    imgui
    GIT_REPOSITORY  https://github.com/ocornut/imgui.git
    GIT_TAG         docking
    GIT_SHALLOW     TRUE
    GIT_PROGRESS    TRUE
)

FetchContent_MakeAvailable(httplib nlohmann_json imgui)

# httplib ships as a single httplib.h but source uses #include <httplib/httplib.h>
# Create external/httplib/httplib.h as a symlink to resolve this.
file(MAKE_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/external/httplib")
file(CREATE_LINK
    "${CMAKE_BINARY_DIR}/_deps/httplib-src/httplib.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/external/httplib/httplib.h"
    SYMBOLIC)

# glad was generated via `python3 -m glad --api gl=3.2 --generator c --profile core`
# into external/glad/ — add its src .c to sources and its include dir.
file(GLOB GLAD_SRC "${CMAKE_CURRENT_SOURCE_DIR}/external/glad/src/*.c")

# ---------------------------------------------------------------
# Find GLFW (system pkg-config)
# ---------------------------------------------------------------
find_package(PkgConfig REQUIRED)
pkg_check_modules(GLFW REQUIRED glfw3)

# ---------------------------------------------------------------
# Compile options
# ---------------------------------------------------------------
if(MSVC)
    add_compile_options(/W4 /utf-8)
else()
    add_compile_options(-Wall -Wextra -pedantic -Wno-unused-parameter)
endif()

# ---------------------------------------------------------------
# Sources
# ---------------------------------------------------------------
# Kumpulkan source code ImGui dan backend-nya
file(GLOB IMGUI_SOURCES
    "${CMAKE_BINARY_DIR}/_deps/imgui-src/*.cpp"
    "${CMAKE_BINARY_DIR}/_deps/imgui-src/backends/imgui_impl_glfw.cpp"
    "${CMAKE_BINARY_DIR}/_deps/imgui-src/backends/imgui_impl_opengl3.cpp"
)

set(SOURCES
    ${CMAKE_CURRENT_SOURCE_DIR}/src/main.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/os_executor.cpp
    ${GLAD_SRC}
    ${IMGUI_SOURCES}
)

add_executable(AmadeusCoreShell ${SOURCES})

# ---------------------------------------------------------------
# XTest manual bypass (Ubuntu Noble)
# ---------------------------------------------------------------
if(PLATFORM_TARGET STREQUAL "linux")
    find_library(XTEST_LIB NAMES Xtst Xtest)
    if(XTEST_LIB)
        set(XTEST_FOUND TRUE)
        get_filename_component(XTEST_LIB_DIR ${XTEST_LIB} DIRECTORY)
        set(XTEST_LIBRARIES ${XTEST_LIB})
        set(XTEST_INCLUDE_DIRS "/usr/include")
        message(STATUS "-> Amadeus Sync: XTest ditemukan manual di: ${XTEST_LIB}")
    else()
        message(WARNING "-> Amadeus Warning: File (.so) XTest tetap tidak ditemukan!")
    endif()
endif()

# ---------------------------------------------------------------
# Includes & Defines
# ---------------------------------------------------------------
target_include_directories(AmadeusCoreShell
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/include
        ${CMAKE_CURRENT_SOURCE_DIR}/external
        ${CMAKE_CURRENT_SOURCE_DIR}/external/glad/include
        ${CMAKE_BINARY_DIR}/_deps/imgui-src
        ${CMAKE_BINARY_DIR}/_deps/imgui-src/backends
        ${GLFW_INCLUDE_DIRS}
)

if(PLATFORM_TARGET STREQUAL "linux")
    target_include_directories(AmadeusCoreShell PRIVATE ${X11_INCLUDE_DIRS})
    if(XTEST_FOUND)
        target_include_directories(AmadeusCoreShell PRIVATE ${XTEST_INCLUDE_DIRS})
        target_compile_definitions(AmadeusCoreShell PRIVATE HAVE_XTEST=1)
    endif()
endif()

# ---------------------------------------------------------------
# Link libraries
# ---------------------------------------------------------------
target_link_libraries(AmadeusCoreShell PRIVATE
    nlohmann_json::nlohmann_json
    httplib::httplib
    ${GLFW_LIBRARIES}
    pthread
)

if(PLATFORM_TARGET STREQUAL "linux")
    target_link_libraries(AmadeusCoreShell PRIVATE ${X11_LIBRARIES})
    if(XTEST_FOUND)
        target_link_libraries(AmadeusCoreShell PRIVATE ${XTEST_LIBRARIES})
    endif()
endif()

# ---------------------------------------------------------------
# Install
# ---------------------------------------------------------------
install(TARGETS AmadeusCoreShell RUNTIME DESTINATION bin)
