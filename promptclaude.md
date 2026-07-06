Prompt — Fix Bugs + Wire Real UiPath Cloud ke MCP

Bug yang HARUS diperbaiki sekarang

Bug 1 — KRITIS: microservice/amadeus-mcp/src/client/trackerClient.ts baris 79-82

ts// SALAH — mengirim signing secret mentah sebagai signature header!
extraHeaders["X-Signature"] = params.signature.secret;

Fix: Compute HMAC-SHA512 dari signature payload, bukan kirim secret mentah.

tsimport { createHmac, createHash } from 'node:crypto';

// Di function completeStep(), ganti block signature:
if (params.signature) {
  const method = 'POST';
  const path = `/transactions/${encodeURIComponent(params.transactionId)}/steps/${encodeURIComponent(params.step)}/complete`;
  const timestamp = params.signature.timestamp;
  const bodyStr = JSON.stringify({
    idempotencyKey: params.idempotencyKey,
    payload: params.payload ?? {},
  });
  const bodySha = createHash('sha256').update(bodyStr).digest('hex');
  const signaturePayload = `${method}\n${path}\n${timestamp}\n${bodySha}`;
  const hmac = createHmac('sha512', params.signature.secret)
    .update(signaturePayload)
    .digest('hex');

  extraHeaders["X-Robot-Timestamp"] = timestamp;
  extraHeaders["X-Signature"] = hmac;
  // JANGAN kirim secret di header — secret TIDAK boleh keluar dari client
}

HAPUS baris extraHeaders["X-Robot-Signing-Secret"] = params.signature.secret; — signing secret TIDAK PERNAH dikirim di wire. Hanya dipakai lokal untuk compute HMAC.

Bug 2 — KRITIS: microservice/mcp-uipath/src/index.ts masih STUB

Seluruh tool trigger_uipath_job adalah fake (Math.random()). Ganti dengan integrasi UiPath Automation Cloud yang asli.

UBAH microservice/mcp-uipath/src/index.ts — ganti tool handler:

tsimport { createHmac } from 'node:crypto';

// OAuth2 token cache
interface TokenCache { accessToken: string; expiresAt: number; }
let tokenCache: TokenCache | null = null;

async function getUiPathToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.accessToken;

  const clientId = process.env.UIPATH_CLIENT_ID ?? '';
  const clientSecret = process.env.UIPATH_CLIENT_SECRET ?? '';
  const baseUrl = process.env.UIPATH_BASE_URL ?? 'https://cloud.uipath.com';

  if (!clientId || !clientSecret) throw new Error('UIPATH_CLIENT_ID / SECRET not set');

  const res = await fetch(`${baseUrl}/identity_/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: process.env.UIPATH_SCOPES ?? 'OR.Jobs OR.Robots.Read OR.Execution',
    }).toString(),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`UiPath OAuth2 failed ${res.status}: ${t.slice(0, 200)}`);
  }

  const json = await res.json() as { access_token: string; expires_in: number };
  tokenCache = { accessToken: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return json.access_token;
}

// Ganti handler tool trigger_uipath_job:
server.tool(
  "trigger_uipath_job",
  "Trigger a UiPath Automation Cloud job via Orchestrator API. Returns job ID and status.",
  {
    releaseKey: z.string().describe("Release key of the process to run (from UiPath Orchestrator)"),
    arguments: z.record(z.any()).optional().describe("InputArguments JSON to pass to the process"),
    folderId: z.string().optional().describe("Orchestrator folder ID (Modern Folder). Defaults to env UIPATH_FOLDER_ID"),
  },
  async (args) => {
    const baseUrl = process.env.UIPATH_BASE_URL ?? 'https://cloud.uipath.com';
    const org = process.env.UIPATH_ORG ?? '';
    const tenant = process.env.UIPATH_TENANT ?? '';
    const folderId = args.folderId ?? process.env.UIPATH_FOLDER_ID ?? '0';

    if (!org || !tenant) {
      return { content: [{ type: "text", text: "Error: UIPATH_ORG and UIPATH_TENANT must be set." }] };
    }

    let token: string;
    try {
      token = await getUiPathToken();
    } catch (e) {
      return { content: [{ type: "text", text: `Auth failed: ${e instanceof Error ? e.message : String(e)}` }] };
    }

    const url = `${baseUrl}/${org}/${tenant}/orchestrator_/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs`;
    const body = {
      startInfo: {
        ReleaseKey: args.releaseKey,
        Strategy: 'ModernJobsCount',
        JobsCount: 1,
        InputArguments: args.arguments ? JSON.stringify(args.arguments) : '{}',
      },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-UIPATH-OrganizationUnitId': folderId,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();

      if (!res.ok) {
        return { content: [{ type: "text", text: `UiPath StartJobs failed (${res.status}): ${text.slice(0, 300)}` }] };
      }

      const json = JSON.parse(text) as { value?: Array<{ Id: number; Key: string; State: string }> };
      const job = json.value?.[0];

      return {
        content: [{
          type: "text",
          text: job
            ? `✅ UiPath job started.\nJob ID: ${job.Id}\nJob Key: ${job.Key}\nState: ${job.State}\nRelease: ${args.releaseKey}`
            : `Job submitted but no details returned. Raw: ${text.slice(0, 200)}`
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }] };
    }
  }
);

TAMBAH 2 tools baru di mcp-uipath:

ts// Tool: list_uipath_processes
server.tool(
  "list_uipath_processes",
  "List available UiPath processes/releases in the current folder",
  {
    folderId: z.string().optional().describe("Folder ID, defaults to env"),
  },
  async (args) => {
    const token = await getUiPathToken();
    const baseUrl = process.env.UIPATH_BASE_URL ?? 'https://cloud.uipath.com';
    const org = process.env.UIPATH_ORG ?? '';
    const tenant = process.env.UIPATH_TENANT ?? '';
    const folderId = args.folderId ?? process.env.UIPATH_FOLDER_ID ?? '0';

    const res = await fetch(
      `${baseUrl}/${org}/${tenant}/orchestrator_/odata/Releases`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-UIPATH-OrganizationUnitId': folderId,
        },
      }
    );
    const data = await res.json() as { value?: Array<{ Key: string; Name: string; ProcessKey: string }> };
    const list = (data.value ?? []).map(r => `• ${r.Name} (key: ${r.Key})`).join('\n');
    return { content: [{ type: "text", text: list || "No processes found in this folder." }] };
  }
);

// Tool: get_uipath_job_status
server.tool(
  "get_uipath_job_status",
  "Check the status of a UiPath job by ID",
  {
    jobId: z.string().describe("Job ID to check"),
  },
  async (args) => {
    const token = await getUiPathToken();
    const baseUrl = process.env.UIPATH_BASE_URL ?? 'https://cloud.uipath.com';
    const org = process.env.UIPATH_ORG ?? '';
    const tenant = process.env.UIPATH_TENANT ?? '';

    const res = await fetch(
      `${baseUrl}/${org}/${tenant}/orchestrator_/odata/Jobs(${args.jobId})`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const job = await res.json() as Record<string, unknown>;
    return {
      content: [{
        type: "text",
        text: `Job ${args.jobId}:\nState: ${job.State}\nStart: ${job.StartTime ?? 'pending'}\nEnd: ${job.EndTime ?? 'running'}\nInfo: ${job.Info ?? 'none'}`
      }],
    };
  }
);

TAMBAH console.log → process.stderr.write di seluruh file (stdout = MCP protocol).

Bug 3 — MINOR: SSE single-client di kedua MCP server

Untuk MVP ini acceptable, tapi tambahkan komentar di kedua index.ts:

ts// TODO: Support multi-client SSE — use Map<sessionId, SSEServerTransport>
// Current: single client only (sufficient for MVP testing)

Env yang dibutuhkan untuk test UiPath Cloud

BUAT file: microservice/mcp-uipath/.env.example

PORT=10001
UIPATH_BASE_URL=https://cloud.uipath.com
UIPATH_ORG=<slug org kamu di cloud.uipath.com>
UIPATH_TENANT=<slug tenant>
UIPATH_CLIENT_ID=<dari External Application di Admin > External Applications>
UIPATH_CLIENT_SECRET=<secret dari External Application>
UIPATH_SCOPES=OR.Jobs OR.Robots.Read OR.Execution OR.Folders.Read
UIPATH_FOLDER_ID=<ID folder Modern Folder di Orchestrator>

Cara dapat credential UiPath untuk test

Dokumentasikan di microservice/mcp-uipath/README.md:


Login ke cloud.uipath.com
Klik Admin (gear icon) > External Applications > Add Application
Pilih "Confidential" application type
Scopes: centang OR.Jobs, OR.Execution, OR.Robots.Read, OR.Folders.Read (Orchestrator scope)
Save → catat Client ID + Client Secret
Org slug: lihat URL cloud.uipath.com/{org-slug}/{tenant-slug}/orchestrator_/
Folder ID: buka Orchestrator > folder yang mau dipakai > URL-nya ada angka folder ID, atau GET /odata/Folders API
Untuk releaseKey: publish 1 process sederhana dari UiPath Studio, lalu GET /odata/Releases → ambil field Key


Langkah test manual

bash# 1. Start mcp-uipath
cd microservice/mcp-uipath
npm install && npm run build
UIPATH_ORG=xxx UIPATH_TENANT=yyy UIPATH_CLIENT_ID=zzz UIPATH_CLIENT_SECRET=www UIPATH_FOLDER_ID=123 npm run start

# 2. Test via MCP Inspector (terminal lain)
npx @modelcontextprotocol/inspector http://localhost:10001/sse

# 3. Di Inspector UI:
#   a. Call "list_uipath_processes" → lihat daftar process di folder
#   b. Copy releaseKey dari hasil
#   c. Call "trigger_uipath_job" dengan releaseKey itu → lihat job ID
#   d. Call "get_uipath_job_status" dengan job ID → lihat state (Pending/Running/Successful)

# 4. Kalau belum ada robot yang pick up, state akan tetap Pending — itu NORMAL
#    Ini sudah membuktikan: MCP → OAuth2 → UiPath API → Job Created ✅

Urutan kerja


Fix Bug 1 (HMAC di amadeus-mcp trackerClient.ts)
Fix Bug 2 (rewire mcp-uipath ke UiPath Cloud asli)
npm run build kedua MCP server
Test mcp-uipath via MCP Inspector (langkah di atas)
Kalau berhasil, test amadeus-mcp via MCP Inspector juga


Deliverable


 microservice/amadeus-mcp/src/client/trackerClient.ts — HMAC fix
 microservice/mcp-uipath/src/index.ts — rewrite ke UiPath Cloud real
 microservice/mcp-uipath/.env.example — baru
 microservice/mcp-uipath/README.md — credential setup + test steps
 Kedua MCP: npm run build clean, no error
