import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Without this, Turbopack scans upward for lockfiles to guess the
    // monorepo root and can pick a stray one outside this project (e.g. a
    // lockfile sitting in the home directory), which then resolves
    // node_modules from the wrong place.
    root: path.join(__dirname),
  },
};

export default nextConfig;
