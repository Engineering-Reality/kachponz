# Amadeus — Migrate MCP Credentials from `args` JSON Blob to `env` DB Field

Working directories: `microservice/transaction_tracker/`, `microservice/mcp-uipath/`, `microservice/frontend/`.

## The problem

Right now, UiPath credentials are stored in the `tools` table like this:

```json
{
  "method": "sse",
  "command": "npx",
  "args": [
    "-y", "amadeus-uipath-mcp@latest",
    "{\"baseUrl\":\"https://cloud.uipath.com\",\"org\":\"anakindia\",\"tenant\":\"DefaultTenant\",\"clientId\":\"0b7fd08e-...\",\"clientSecret\":\"ki!YJ#Yqi*7kLr89...\",\"scopes\":\"OR.Jobs OR.Robots.Read\",\"folderId\":\"997942\"}",
    "--stdio"
  ],
  "env": {}
}
```

The credentials — including `clientSecret` — are embedded as a JSON string inside `args[2]`. This is wrong for three reasons:

1. **Security**: `args` are visible in `ps aux` process listings, in crash dumps, and in any log line that prints the spawn command. `mcpAutoManager.ts` has `redactArgs()` to try to hide secrets before logging, but that's a band-aid — the secrets still exist in the `args` array passed to `execvp`. Environment variables don't appear in process listings and are only visible to the process itself and its parent.

2. **Architecture**: MCP servers are supposed to be **stateless packages** that read configuration from environment variables. That's what `mcp-uipath`'s `getUiPathToken()` already does — it reads `process.env.UIPATH_CLIENT_ID` etc. The JSON-blob-in-args pattern is a legacy workaround from when the tool was spawned as a local file (`node build/index.js '{"clientId":...}'`) and needed to receive credentials somehow. Now that it's an npx package, the correct channel is env vars.

3. **Coupling**: `extractCredentialsFromToolRow()` (in `src/lib/uipathAuth.ts`, from the prior refactor) has to dig into `args`, find the string that starts with `{`, JSON-parse it, and extract credential fields — all because the data is stored in the wrong place. If credentials were in `env`, it would just read `release.env.UIPATH_CLIENT_ID` directly, no parsing needed.

The infrastructure to do it correctly **already exists** — `mcpAutoManager.ts` already does:

```ts
const env = { ...process.env, ...release.env, PORT: String(port) };
const child = spawn(command, args, { env, ... });
```

So `release.env` values are already injected as real environment variables into the child process. The field just isn't being used for credentials because the registration form doesn't guide users toward it and the existing tool registrations were created before this mechanism existed.

## Phase 1 — Update the data contract: credentials go in `env`, not `args`

### 1a. Define the canonical shape for a UiPath tool registration

The correct stored shape in `tools.versions[latest].released` should be:

```json
{
  "method": "sse",
  "command": "npx",
  "args": ["-y", "amadeus-uipath-mcp@latest"],
  "env": {
    "UIPATH_BASE_URL": "https://cloud.uipath.com",
    "UIPATH_ORG": "anakindia",
    "UIPATH_TENANT": "DefaultTenant",
    "UIPATH_CLIENT_ID": "0b7fd08e-...",
    "UIPATH_CLIENT_SECRET": "ki!YJ#Yqi*7kLr89...",
    "UIPATH_SCOPES": "OR.Jobs OR.Robots.Read OR.Execution OR.Queues OR.Monitoring",
    "UIPATH_FOLDER_ID": "997942"
  }
}
```

Note what changed: `args` is now just `["-y", "amadeus-uipath-mcp@latest"]` — no credentials JSON blob. All secrets live in `env`, which is injected by `mcpAutoManager` as real environment variables at spawn time and never appears in process arguments.

### 1b. Update `extractCredentialsFromToolRow()` in `src/lib/uipathAuth.ts`

Currently this function digs through `release.args` looking for a JSON string. Change it to read from `release.env` **first**, falling back to the old args-parsing path for backward compatibility with existing registrations that haven't been migrated yet:

```ts
export function extractCredentialsFromToolRow(toolRow: any): UiPathCredentials | null {
  let versions = toolRow.versions;
  if (typeof versions === 'string') {
    try { versions = JSON.parse(versions); } catch { return null; }
  }
  const release = versions?.[versions.length - 1]?.released;
  if (!release) return null;

  // ── Preferred path: credentials in release.env ──
  const env = release.env;
  if (env?.UIPATH_CLIENT_ID && env?.UIPATH_CLIENT_SECRET && env?.UIPATH_ORG && env?.UIPATH_TENANT) {
    return {
      baseUrl: env.UIPATH_BASE_URL || 'https://cloud.uipath.com',
      org: env.UIPATH_ORG,
      tenant: env.UIPATH_TENANT,
      clientId: env.UIPATH_CLIENT_ID,
      clientSecret: env.UIPATH_CLIENT_SECRET,
      scopes: env.UIPATH_SCOPES,
      folderId: env.UIPATH_FOLDER_ID,
    };
  }

  // ── Legacy fallback: credentials embedded in args JSON blob ──
  // This path exists only for backward compatibility with existing tool rows
  // that haven't been migrated to the env-based format yet. New registrations
  // must never use this path — the form enforces env-based storage (see Phase 2).
  const rawCredsArg: string | undefined = Array.isArray(release.args)
    ? release.args.find((a: string) => typeof a === 'string' && a.trim().startsWith('{'))
    : undefined;
  if (!rawCredsArg) return null;
  try {
    const parsed = JSON.parse(rawCredsArg);
    if (!parsed.clientId || !parsed.clientSecret || !parsed.org || !parsed.tenant) return null;
    return {
      baseUrl: parsed.baseUrl || 'https://cloud.uipath.com',
      org: parsed.org,
      tenant: parsed.tenant,
      clientId: parsed.clientId,
      clientSecret: parsed.clientSecret,
      folderId: parsed.folderId,
    };
  } catch {
    return null;
  }
}
```

Add `folderId?: string` to the `UiPathCredentials` interface if it's not already there — the poller and the proactive-context endpoint both need it.

### 1c. Data migration for existing tool rows

Add `migrations/1790000000000_migrate_creds_to_env.ts`:

```ts
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Find all tool rows where credentials are stored in the args JSON blob
  // and move them to the env field instead.
  pgm.sql(`
    -- This is a data-only migration. It reads each tool row, checks if any
    -- element in the args array looks like a JSON credentials blob, extracts
    -- the credential fields into the env JSONB field, and removes the blob
    -- from args. Rows that already have credentials in env are skipped.
    -- Rows where the extraction is ambiguous are left untouched with a
    -- migration_note added for manual review.
    --
    -- Because tools.versions is a JSONB array and the transformation is
    -- non-trivial, this is implemented as a PL/pgSQL DO block rather than
    -- a single UPDATE statement.
    DO $$
    DECLARE
      r RECORD;
      v_versions JSONB;
      v_release JSONB;
      v_args JSONB;
      v_env JSONB;
      v_creds_arg TEXT;
      v_creds JSONB;
      v_new_args JSONB;
      v_new_env JSONB;
      v_idx INT;
    BEGIN
      FOR r IN SELECT tool_id, versions FROM tools LOOP
        v_versions := r.versions;
        IF v_versions IS NULL OR jsonb_array_length(v_versions) = 0 THEN CONTINUE; END IF;

        v_idx := jsonb_array_length(v_versions) - 1;
        v_release := v_versions -> v_idx -> 'released';
        IF v_release IS NULL THEN CONTINUE; END IF;

        v_env := COALESCE(v_release -> 'env', '{}'::jsonb);
        -- Skip if env already has credentials
        IF v_env ? 'UIPATH_CLIENT_ID' THEN CONTINUE; END IF;

        v_args := v_release -> 'args';
        IF v_args IS NULL OR jsonb_typeof(v_args) != 'array' THEN CONTINUE; END IF;

        -- Find the args element that looks like a JSON credentials blob
        v_creds_arg := NULL;
        FOR i IN 0..jsonb_array_length(v_args)-1 LOOP
          IF jsonb_typeof(v_args -> i) = 'string'
             AND (v_args ->> i) LIKE '{%"clientId"%'
          THEN
            v_creds_arg := v_args ->> i;
            -- Build new args without this element
            v_new_args := '[]'::jsonb;
            FOR j IN 0..jsonb_array_length(v_args)-1 LOOP
              IF j != i THEN
                v_new_args := v_new_args || jsonb_build_array(v_args -> j);
              END IF;
            END LOOP;
            EXIT;
          END IF;
        END LOOP;

        IF v_creds_arg IS NULL THEN CONTINUE; END IF;

        BEGIN
          v_creds := v_creds_arg::jsonb;
        EXCEPTION WHEN OTHERS THEN
          CONTINUE; -- not valid JSON, skip
        END;

        -- Build the new env with credential fields
        v_new_env := v_env
          || jsonb_build_object('UIPATH_BASE_URL', COALESCE(v_creds ->> 'baseUrl', 'https://cloud.uipath.com'))
          || jsonb_build_object('UIPATH_ORG', v_creds ->> 'org')
          || jsonb_build_object('UIPATH_TENANT', v_creds ->> 'tenant')
          || jsonb_build_object('UIPATH_CLIENT_ID', v_creds ->> 'clientId')
          || jsonb_build_object('UIPATH_CLIENT_SECRET', v_creds ->> 'clientSecret')
          || jsonb_build_object('UIPATH_FOLDER_ID', COALESCE(v_creds ->> 'folderId', '0'))
          || jsonb_build_object('UIPATH_SCOPES', COALESCE(v_creds ->> 'scopes', 'OR.Jobs OR.Robots.Read OR.Execution OR.Queues OR.Monitoring'));

        -- Update the release object: new env, cleaned args
        v_release := v_release
          || jsonb_build_object('env', v_new_env)
          || jsonb_build_object('args', v_new_args);

        v_versions := jsonb_set(v_versions, ARRAY[v_idx::text, 'released'], v_release);

        UPDATE tools SET versions = v_versions WHERE tool_id = r.tool_id;
        RAISE NOTICE 'Migrated credentials for tool %', r.tool_id;
      END LOOP;
    END $$;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  -- No-op: we don't un-migrate credentials back into args.
  -- The legacy fallback path in extractCredentialsFromToolRow handles both formats.
}
```

After migration, verify:
```bash
psql $DATABASE_URL -c "SELECT tool_id, name, versions->-1->'released'->'env' as env, versions->-1->'released'->'args' as args FROM tools WHERE name ILIKE '%uipath%';"
# env should contain UIPATH_CLIENT_ID etc.
# args should NOT contain any JSON blob with clientSecret
```

## Phase 2 — Update the frontend registration form

In `microservice/frontend/src/app/tools/page.tsx`, the tool registration form currently has a generic `env` textarea. Replace it with a structured credential form that adapts to the tool type:

### 2a. Add a "UiPath credentials" sub-form

When the user is registering a tool whose `command` is `npx` with `args` containing `amadeus-uipath-mcp` (or any future tool type you want to support), show dedicated credential fields instead of a raw JSON textarea:

```tsx
// Detect UiPath-type tool from the command/args
const isUiPathTool = formData.args?.some(a => a.includes('uipath-mcp'));

{isUiPathTool && (
  <div className="space-y-3 border rounded-xl p-4 bg-amber-50/50">
    <h4 className="text-sm font-semibold text-amber-800">UiPath Credentials</h4>
    <p className="text-xs text-amber-600">
      Stored securely in the database. Injected as environment variables at runtime — 
      never embedded in CLI arguments or visible in process listings.
    </p>
    <input required placeholder="Organization slug (e.g. anakindia)"
           value={formData.env?.UIPATH_ORG ?? ''}
           onChange={e => setFormData({...formData, env: {...formData.env, UIPATH_ORG: e.target.value}})}
           className="form-input w-full" />
    <input required placeholder="Tenant slug (e.g. DefaultTenant)"
           value={formData.env?.UIPATH_TENANT ?? ''}
           onChange={e => setFormData({...formData, env: {...formData.env, UIPATH_TENANT: e.target.value}})}
           className="form-input w-full" />
    <input required placeholder="Client ID"
           value={formData.env?.UIPATH_CLIENT_ID ?? ''}
           onChange={e => setFormData({...formData, env: {...formData.env, UIPATH_CLIENT_ID: e.target.value}})}
           className="form-input w-full" />
    <input required type="password" placeholder="Client Secret"
           value={formData.env?.UIPATH_CLIENT_SECRET ?? ''}
           onChange={e => setFormData({...formData, env: {...formData.env, UIPATH_CLIENT_SECRET: e.target.value}})}
           className="form-input w-full" />
    <input required placeholder="Folder ID (numeric, from URL ?fid=XXXXX)"
           value={formData.env?.UIPATH_FOLDER_ID ?? ''}
           onChange={e => setFormData({...formData, env: {...formData.env, UIPATH_FOLDER_ID: e.target.value}})}
           className="form-input w-full" />
  </div>
)}
```

For non-UiPath tools, keep the generic key-value env editor — but improve it from a raw textarea to an actual key-value pair input (add/remove rows), so users don't have to write JSON by hand. Mark any key matching `/secret|password|token|key/i` as `type="password"` automatically.

### 2b. Mask secrets in the tool detail/edit view

When displaying an existing tool's configuration (GET /tools/:id response rendered on the tools page), mask any `env` value whose key matches the secret pattern. Show `ki!YJ#Y••••••••` (first 6 chars + dots) instead of the full value. The full value stays in the DB and is injected at spawn time — only the display is masked.

### 2c. Update the sample presets

The presets (around line 355) from the prior refactor already use `npx -y amadeus-uipath-mcp@latest`. Update them to also show the env fields populated with placeholder values:

```ts
{
  name: "UiPath MCP",
  versions: [{
    released: {
      method: "sse",
      command: "npx",
      args: ["-y", "amadeus-uipath-mcp@latest"],
      env: {
        UIPATH_ORG: "<your-org-slug>",
        UIPATH_TENANT: "<your-tenant>",
        UIPATH_CLIENT_ID: "<from-external-app-registration>",
        UIPATH_CLIENT_SECRET: "<from-external-app-registration>",
        UIPATH_FOLDER_ID: "<numeric-folder-id>",
        UIPATH_SCOPES: "OR.Jobs OR.Robots.Read OR.Execution OR.Queues OR.Monitoring",
      },
    }
  }]
}
```

## Phase 3 — Backend: reject credentials in `args`, validate `env`

### 3a. Validation on tool create/update

In `src/routes/tools.ts`, add validation to `POST /tools` and `PUT /tools/:id`:

```ts
// After parsing the release object from the request body:
if (Array.isArray(release.args)) {
  for (const arg of release.args) {
    if (typeof arg === 'string' && /clientSecret|client_secret|password/i.test(arg)) {
      return reply.code(400).send({
        code: 'CREDENTIALS_IN_ARGS',
        message: 'Credentials must be stored in the "env" field, not embedded in "args". ' +
                 'Move your clientId/clientSecret/etc. to env as UIPATH_CLIENT_ID, UIPATH_CLIENT_SECRET, etc.',
      });
    }
  }
}
```

This prevents new registrations from using the old pattern. Existing rows that were migrated (Phase 1c) are already in the correct format; the legacy fallback in `extractCredentialsFromToolRow` handles any that somehow weren't caught by the migration.

### 3b. Never log `env` values that match the secret pattern

`mcpAutoManager.ts` already has `redactArgs()`. Add a symmetric `redactEnv()` (it may already exist from prior work — check first, don't duplicate):

```ts
// already exists in current code:
function redactEnv(env: Record<string, string> | undefined): Record<string, string> { ... }

// Verify it's used in the log line that prints spawn details:
console.log(`... env=${JSON.stringify(redactEnv(release.env))} ...`);
```

### 3c. API endpoint to return env with secrets masked

Add or update `GET /tools/:id` response to mask secret env values before returning to the frontend:

```ts
function maskSecrets(env: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    masked[k] = SECRET_KEY_RE.test(k) && v.length > 6
      ? v.slice(0, 6) + '••••••••'
      : v;
  }
  return masked;
}
```

The full values are never sent to the frontend on read — only on write (the form submits the real values, the API stores them, and subsequent reads get the masked version). This is the same pattern most credential-management UIs use (AWS Console, Stripe Dashboard, etc.).

## Phase 4 — Clean up the `.env` file in the monorepo

After the migration, these env vars in `microservice/transaction_tracker/.env` are no longer needed at the **monorepo level** (they now live per-tool in the DB):

```
UIPATH_BASE_URL
UIPATH_ORG
UIPATH_TENANT
UIPATH_CLIENT_ID
UIPATH_CLIENT_SECRET
UIPATH_SCOPES
UIPATH_FOLDER_ID
```

Check `src/config/env.ts` — if these are still in the Zod schema as required/optional fields, make them all optional with a comment explaining they're only needed if `uipathExecutor.ts` is used directly (the legacy executor path), not for MCP-based invocation which reads credentials from the tool's DB row.

Do NOT delete them from `.env.example` — keep them there as documentation with a comment: `# Only needed for direct UiPath executor (non-MCP path). For MCP tools, credentials are stored per-tool in the database.`

## Verification

```bash
npm run migrate:up

# 1. Confirm existing UiPath tool credentials migrated to env
psql $DATABASE_URL -c "
  SELECT name,
         versions->-1->'released'->'args' as args,
         versions->-1->'released'->'env'->>'UIPATH_CLIENT_ID' as client_id_in_env
  FROM tools WHERE name ILIKE '%uipath%';
"
# args should NOT contain any JSON blob with clientSecret
# client_id_in_env should show the real client ID

# 2. Confirm the tool still works after migration (credentials now come from env, not args)
# Restart the server, let mcpAutoManager respawn the UiPath tool
# Then in agent-invoke: "list my queues" → should work without any folder link pasting

# 3. Confirm new registrations are blocked from putting credentials in args
curl -X POST http://127.0.0.1:8080/tools -d '{
  "name": "Bad Registration",
  "on_status": "Online",
  "versions": [{"released": {
    "method": "sse",
    "command": "npx",
    "args": ["-y", "amadeus-uipath-mcp@latest", "{\"clientSecret\":\"xxx\"}"],
    "env": {}
  }}]
}'
# expect 400 CREDENTIALS_IN_ARGS

# 4. Confirm secrets are masked in the API response
curl http://127.0.0.1:8080/tools/<tool-id>
# env.UIPATH_CLIENT_SECRET should show "ki!YJ#••••••••", not the full value

# 5. ps aux check — confirm no secrets visible in process arguments
ps aux | grep uipath-mcp
# should show: npx -y amadeus-uipath-mcp@latest
# should NOT show: clientSecret or any JSON blob
```

## Constraints

- Migrations additive only, backward-compatible (legacy fallback path stays until all rows are confirmed migrated).
- `shell: false` on all spawns, always.
- Secrets never logged, never returned unmasked to frontend, never in process arguments.
- The `env` field in the DB is the **single source of truth** for per-tool credentials going forward.
