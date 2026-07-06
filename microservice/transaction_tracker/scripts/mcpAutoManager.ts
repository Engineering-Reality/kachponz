import { spawn, ChildProcess } from 'child_process';
import pg from 'pg';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const activeProcesses = new Map<string, ChildProcess>();

// Helper to safely parse command line arguments respecting single and double quotes
function parseArgs(argsString: string): string[] {
  const args: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escapeNext = false;

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }
  
  if (current.length > 0) {
    args.push(current);
  }
  return args;
}

async function syncMcpServers() {
  try {
    const res = await pool.query("SELECT * FROM tools WHERE on_status = 'Online' OR on_status = 'true'");
    const tools = res.rows;

    const expectedServerIds = new Set<string>();

    for (const tool of tools) {
      // Find the latest valid version
      const versions = typeof tool.versions === 'string' ? JSON.parse(tool.versions) : tool.versions;
      if (!versions || versions.length === 0) continue;
      
      const release = versions[versions.length - 1]?.released;
      if (!release || release.method !== 'sse' || !release.args) continue;

      const toolId = tool.tool_id;
      expectedServerIds.add(toolId);

      if (!activeProcesses.has(toolId)) {
        console.log(`[MCP AutoManager] Starting ${tool.name}...`);
        
        const parsedArgs = parseArgs(release.args);
        if (parsedArgs.length === 0) continue;

        const cmd = parsedArgs[0];
        const cmdArgs = parsedArgs.slice(1);
        
        // Merge process env with tool-specific env
        const env = { ...process.env, ...release.env };
        if (release.port) env.PORT = release.port.toString();

        const child = spawn(cmd, cmdArgs, {
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false // must be false so JSON double quotes are not stripped by the shell
        });

        child.stdout?.on('data', (data) => {
          process.stdout.write(`[${tool.name}] ${data}`);
        });

        child.stderr?.on('data', (data) => {
          process.stderr.write(`[${tool.name}] ${data}`);
        });

        child.on('close', (code) => {
          console.log(`[MCP AutoManager] ${tool.name} exited with code ${code}`);
          activeProcesses.delete(toolId);
        });

        child.on('error', (err) => {
          console.error(`[MCP AutoManager] Failed to start ${tool.name}:`, err);
        });

        activeProcesses.set(toolId, child);
      }
    }

    // Kill removed or offline processes
    for (const [toolId, child] of activeProcesses.entries()) {
      if (!expectedServerIds.has(toolId)) {
        console.log(`[MCP AutoManager] Stopping obsolete MCP process for tool ${toolId}`);
        child.kill('SIGTERM');
        activeProcesses.delete(toolId);
      }
    }

  } catch (err) {
    console.error("[MCP AutoManager] Error syncing MCP servers:", err);
  }
}

// Check every 10 seconds for changes in the DB
setInterval(syncMcpServers, 10000);
syncMcpServers(); // Initial check

console.log("[MCP AutoManager] Daemon started. Monitoring database for Online MCP servers...");

// Cleanup on exit
process.on('SIGINT', () => {
  console.log("[MCP AutoManager] Shutting down all MCP servers...");
  for (const child of activeProcesses.values()) {
    child.kill('SIGKILL');
  }
  process.exit(0);
});
process.on('SIGTERM', () => {
  for (const child of activeProcesses.values()) {
    child.kill('SIGKILL');
  }
  process.exit(0);
});
