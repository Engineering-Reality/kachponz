import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface PortRange {
  host: string;
  startPort: number;
  endPort: number;
}

export class PortRangeExhaustedError extends Error {
  constructor(range: PortRange) {
    super(`No free port available in range ${range.host}:${range.startPort}-${range.endPort}`);
    this.name = 'PortRangeExhaustedError';
  }
}

const DEFAULT_RANGE: PortRange = { host: '127.0.0.1', startPort: 10000, endPort: 11999 };

/**
 * Locates config/port_range.json by walking up from this file's own location.
 * __dirname depth differs between `tsx` (runs src/ directly) and the compiled
 * `dist/` build, so a fixed number of `..` segments would break one of them.
 */
function findPortRangeConfig(): PortRange {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'config', 'port_range.json');
    if (fs.existsSync(candidate)) {
      try {
        const raw = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
        return {
          host: raw.host ?? DEFAULT_RANGE.host,
          startPort: raw.start_port ?? DEFAULT_RANGE.startPort,
          endPort: raw.end_port ?? DEFAULT_RANGE.endPort,
        };
      } catch {
        break;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { ...DEFAULT_RANGE };
}

export function loadPortRange(): PortRange {
  const fileRange = findPortRangeConfig();
  return {
    host: process.env.MCP_HOST || fileRange.host,
    startPort: process.env.MCP_START_PORT ? Number(process.env.MCP_START_PORT) : fileRange.startPort,
    endPort: process.env.MCP_END_PORT ? Number(process.env.MCP_END_PORT) : fileRange.endPort,
  };
}

export class PortAllocator {
  private readonly range: PortRange;
  private readonly sampleSize: number;

  constructor(range: PortRange, opts?: { sampleSize?: number }) {
    this.range = range;
    this.sampleSize = opts?.sampleSize ?? 100;
  }

  /** Real bind-and-release test, mirrors Python's socket.bind() check. */
  async isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, this.range.host);
    });
  }

  /** Returns a free port not in `excludePorts`, verified via a real bind test. */
  async allocate(excludePorts: Set<number>): Promise<number> {
    const fullRange: number[] = [];
    for (let p = this.range.startPort; p <= this.range.endPort; p++) fullRange.push(p);

    const candidates = fullRange.filter((p) => !excludePorts.has(p));
    if (candidates.length === 0) throw new PortRangeExhaustedError(this.range);

    let sampled = candidates;
    if (candidates.length > this.sampleSize) {
      sampled = sample(candidates, this.sampleSize);
      sampled.push(candidates[0]!, candidates[Math.floor(candidates.length / 2)]!, candidates[candidates.length - 1]!);
    }

    for (const port of sampled) {
      if (await this.isPortFree(port)) return port;
    }

    // Fall back to a full linear scan over whatever wasn't already tried.
    const sampledSet = new Set(sampled);
    const remaining = candidates.filter((p) => !sampledSet.has(p));
    for (const port of remaining) {
      if (await this.isPortFree(port)) return port;
    }

    throw new PortRangeExhaustedError(this.range);
  }
}

function sample<T>(arr: T[], size: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  const n = Math.min(size, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool[idx]!);
    pool.splice(idx, 1);
  }
  return out;
}
