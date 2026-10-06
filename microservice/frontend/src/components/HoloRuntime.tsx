"use client";

import { useEffect } from "react";
import { startHoloRuntime } from "@/lib/holo";

/**
 * Mounted once in the root layout. Tracks pointer, touch, device tilt and
 * scroll velocity, and publishes them as CSS variables (--holo-x, --holo-y,
 * --holo-angle) so every .holo-* surface shifts colour together.
 */
export function HoloRuntime() {
  useEffect(() => startHoloRuntime(), []);
  return null;
}
