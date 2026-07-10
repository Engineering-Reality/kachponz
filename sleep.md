# Amadeus — Fix Recurring EADDRINUSE on Port 8081

Working directory: `microservice/transaction_tracker/`.

## The problem

Every `npm run dev` fails immediately with:

```
Error: listen EADDRINUSE: address already in use 127.0.0.1:8081
```

"Selalu gini" (always happens) means this isn't a one-off — something is reliably leaving port 8081 occupied between runs. Diagnose the actual cause before changing code; there are a few distinct possibilities and the fix differs for each.

## Step 1 — Find out what's actually holding the port, right now

```bash
# Linux
lsof -i :8081
# or if lsof isn't installed:
ss -ltnp | grep 8081
# or:
fuser 8081/tcp
```

Report the exact output — specifically the process name and PID. This immediately tells us which of the following is true:

- **A `node` or `tsx` process, PID unrelated to any terminal you currently have open** → a zombie from a previous session that never exited cleanly (Step 2).
- **Two entries, or a PID that matches a `tsx watch` you can see running in another terminal/tab right now** → you literally have two `npm run dev` instances running simultaneously (Step 3).
- **Something entirely unrelated to this project** (some other app/service on your machine happens to use 8081) → port collision with unrelated software (Step 4).

## Step 2 — If it's a zombie from a previous session (most likely, given "always")

Kill it and confirm the port frees up:

```bash
kill -9 <pid>
lsof -i :8081   # should now show nothing
npm run dev     # should start cleanly this time
```

This unblocks you immediately. But if it keeps coming back every session, the real bug is that **shutdown isn't actually killing everything it should** — fix the root cause below so you stop needing to do this manually.

### Root cause: the shutdown handler doesn't kill the spawned `mcpManager` child, and has no timeout

In `src/server.ts`:

```ts
const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down...`);
  await app.close();
  await closePool();
  process.exit(0);
};
```

Two problems:

1. **`mcpManager` (the spawned `tsx scripts/mcpAutoManager.ts` child process) is never killed here.** It's a separate OS process — closing the Fastify `app` and the DB pool does nothing to it. It keeps running as an orphan after the main process exits, and depending on what it's doing at the time (mid-spawn of an MCP tool, holding its own child processes), it can itself become a zombie that holds other ports, or in tsx watch mode, cause weird double-registration behavior on the next restart.

2. **No timeout on graceful shutdown.** If `app.close()` or `closePool()` hangs — e.g. `closePool()` waiting on a connection that's mid-transaction, or a client that never released back to the pool — `process.exit(0)` never gets called, and the process lingers holding port 8081 indefinitely. The next `npm run dev` then immediately collides.

**Fix:**

```ts
let mcpManager: ChildProcess | null = null; // already declared earlier in the file — confirm reference

const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down...`);

  // Kill the MCP process manager child first — it may itself have spawned
  // further children (individual MCP tool servers); killing it should cascade,
  // but give it a moment before force-killing anything still alive.
  if (mcpManager && !mcpManager.killed) {
    mcpManager.kill('SIGTERM');
  }

  // Force-exit if graceful shutdown hangs, instead of lingering forever
  // and blocking the next `npm run dev` with EADDRINUSE.
  const forceExitTimer = setTimeout(() => {
    app.log.error('Graceful shutdown timed out after 5s — forcing exit.');
    process.exit(1);
  }, 5000);
  forceExitTimer.unref(); // don't let this timer itself keep the process alive if everything else finishes first

  try {
    await app.close();
    await closePool();
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'Error during shutdown');
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
};
```

Also confirm `mcpAutoManager.ts` itself has its own SIGTERM handler that cleanly kills whatever MCP tool child processes *it* spawned (UiPath, etc.) — otherwise killing `mcpManager` still leaves grandchild processes orphaned, which could hold the dynamically-allocated MCP tool ports (10000-11999 range) even if it doesn't affect 8081 directly. Check for this and add it if missing:

```ts
// in scripts/mcpAutoManager.ts
process.on('SIGTERM', () => {
  for (const child of runningChildren.values()) { // whatever the actual tracking structure is called
    child.kill('SIGTERM');
  }
  process.exit(0);
});
```

## Step 3 — If it's genuinely two `npm run dev` instances at once

Check every terminal tab/window, VS Code integrated terminals, and any background task runners (VS Code "tasks.json" auto-start, tmux sessions, etc.) for a second instance. Kill the duplicate, keep one.

If this keeps happening because of an editor auto-restart behavior (e.g., a VS Code task configured to restart on file save, stacking on top of an already-running `npm run dev`), that's an editor/workspace config issue outside the codebase — fix the `.vscode/tasks.json` or equivalent to not auto-duplicate the dev server.

## Step 4 — Add a friendly, actionable error instead of the raw stack trace

Regardless of which cause applies today, make future occurrences self-explanatory instead of a bare Node stack trace. In `src/server.ts`, wrap the listen call:

```ts
try {
  await app.listen({ host: env.HOST, port: env.PORT });
  // ... existing mcpManager spawn logic
} catch (err: any) {
  if (err?.code === 'EADDRINUSE') {
    app.log.error(
      `\n🔴 Port ${env.PORT} is already in use.\n` +
      `   Another process (likely a previous "npm run dev" that didn't exit cleanly) is holding it.\n\n` +
      `   Find and stop it:\n` +
      `     lsof -i :${env.PORT}          # find the PID\n` +
      `     kill -9 <pid>                 # stop it\n\n` +
      `   Then run "npm run dev" again.\n`
    );
    process.exit(1);
  }
  app.log.error({ err }, 'gagal start server');
  process.exit(1);
}
```

## Step 5 — Optional: auto-detect and offer to clean up on dev start

If this is happening often enough to be annoying even after Step 2's fix, add a `predev` npm script that checks port availability before `tsx watch` even starts, so the failure (if it still happens for some unrelated reason) surfaces before the ASCII banner prints, not after:

```json
{
  "scripts": {
    "predev": "node scripts/check-port.mjs",
    "dev": "tsx watch src/server.ts"
  }
}
```

```js
// scripts/check-port.mjs
import net from 'node:net';

const PORT = process.env.PORT ?? 8081;

const server = net.createServer();
server.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n🔴 Port ${PORT} is already in use before we even started.`);
    console.error(`   Run: lsof -i :${PORT}   then   kill -9 <pid>\n`);
    process.exit(1);
  }
  throw err;
});
server.once('listening', () => {
  server.close();
});
server.listen(PORT, '127.0.0.1');
```

This is optional polish — Step 2's actual fix (killing the zombie + making shutdown reliable) is what stops the recurrence. This step just makes any *remaining* occurrence easier to diagnose at a glance.

## Verification

```bash
# 1. Confirm the current zombie is gone and a clean start works
lsof -i :8081  # should be empty before starting
npm run dev    # should start cleanly, no EADDRINUSE

# 2. Confirm shutdown is now reliable — start, then stop, then immediately restart
npm run dev
# wait for "Server listening at..."
# Ctrl+C
lsof -i :8081  # should be empty within 1-2 seconds of Ctrl+C, not lingering
npm run dev    # should start immediately without any EADDRINUSE, no manual kill needed

# 3. Repeat step 2 five times in a row — this is the real regression test,
#    since "always happens" implies it was failing consistently before
for i in 1 2 3 4 5; do
  npm run dev &
  PID=$!
  sleep 3
  kill -SIGINT $PID
  wait $PID 2>/dev/null
  sleep 1
  lsof -i :8081 && echo "FAIL: port still held after cycle $i" || echo "OK: cycle $i clean"
done

# 4. Confirm mcpManager child is also cleanly killed, not orphaned
ps aux | grep mcpAutoManager
# before Ctrl+C: should show one instance
# after Ctrl+C: should show none
```

All four must pass — especially step 3's five-cycle loop, since a fix that works once but still leaks on the second or third restart wouldn't actually explain "always happens."

## Constraints

- Don't change the port number as a workaround — fix why the shutdown doesn't release it.
- `mcpManager.kill('SIGTERM')` before force-exit, always give it a chance to clean up its own children first.
- Keep the force-exit timeout short (5s is reasonable) — don't let a hung shutdown block the terminal indefinitely, but don't force-kill so fast that normal cleanup never completes either.
