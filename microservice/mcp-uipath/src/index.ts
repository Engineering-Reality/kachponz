import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";

const app = express();

const server = new McpServer({
  name: "UiPath MCP Server",
  version: "1.0.0",
});

// ── UiPath Automation Cloud OAuth2 (client_credentials) ─────────────────────

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}
let tokenCache: TokenCache | null = null;

async function getUiPathToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.accessToken;

  const clientId = process.env.UIPATH_CLIENT_ID ?? "";
  const clientSecret = process.env.UIPATH_CLIENT_SECRET ?? "";
  const baseUrl = process.env.UIPATH_BASE_URL ?? "https://cloud.uipath.com";

  if (!clientId || !clientSecret) throw new Error("UIPATH_CLIENT_ID / SECRET not set");

  const res = await fetch(`${baseUrl}/identity_/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: process.env.UIPATH_SCOPES ?? "OR.Jobs OR.Robots.Read OR.Execution",
    }).toString(),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`UiPath OAuth2 failed ${res.status}: ${t.slice(0, 200)}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { accessToken: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return json.access_token;
}

// ── Tools ─────────────────────────────────────────────────────────────────

server.tool(
  "trigger_uipath_job",
  "Trigger a UiPath Automation Cloud job via Orchestrator API. Returns job ID and status.",
  {
    releaseKey: z.string().describe("Release key of the process to run (from UiPath Orchestrator)"),
    arguments: z.record(z.any()).optional().describe("InputArguments JSON to pass to the process"),
    folderId: z.string().optional().describe("Orchestrator folder ID (Modern Folder). Defaults to env UIPATH_FOLDER_ID"),
  },
  async (args) => {
    const baseUrl = process.env.UIPATH_BASE_URL ?? "https://cloud.uipath.com";
    const org = process.env.UIPATH_ORG ?? "";
    const tenant = process.env.UIPATH_TENANT ?? "";
    const folderId = args.folderId ?? process.env.UIPATH_FOLDER_ID ?? "0";

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
        Strategy: "ModernJobsCount",
        JobsCount: 1,
        InputArguments: args.arguments ? JSON.stringify(args.arguments) : "{}",
      },
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-UIPATH-OrganizationUnitId": folderId,
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
        content: [
          {
            type: "text",
            text: job
              ? `✅ UiPath job started.\nJob ID: ${job.Id}\nJob Key: ${job.Key}\nState: ${job.State}\nRelease: ${args.releaseKey}`
              : `Job submitted but no details returned. Raw: ${text.slice(0, 200)}`,
          },
        ],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }] };
    }
  }
);

server.tool(
  "list_uipath_processes",
  "List available UiPath processes/releases in the current folder",
  {
    folderId: z.string().optional().describe("Folder ID, defaults to env"),
  },
  async (args) => {
    const baseUrl = process.env.UIPATH_BASE_URL ?? "https://cloud.uipath.com";
    const org = process.env.UIPATH_ORG ?? "";
    const tenant = process.env.UIPATH_TENANT ?? "";
    const folderId = args.folderId ?? process.env.UIPATH_FOLDER_ID ?? "0";

    if (!org || !tenant) {
      return { content: [{ type: "text", text: "Error: UIPATH_ORG and UIPATH_TENANT must be set." }] };
    }

    let token: string;
    try {
      token = await getUiPathToken();
    } catch (e) {
      return { content: [{ type: "text", text: `Auth failed: ${e instanceof Error ? e.message : String(e)}` }] };
    }

    try {
      const res = await fetch(`${baseUrl}/${org}/${tenant}/orchestrator_/odata/Releases`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-UIPATH-OrganizationUnitId": folderId,
        },
      });

      const text = await res.text();
      if (!res.ok) {
        return { content: [{ type: "text", text: `UiPath Releases failed (${res.status}): ${text.slice(0, 300)}` }] };
      }

      const data = JSON.parse(text) as { value?: Array<{ Key: string; Name: string; ProcessKey: string }> };
      const list = (data.value ?? []).map((r) => `• ${r.Name} (key: ${r.Key})`).join("\n");
      return { content: [{ type: "text", text: list || "No processes found in this folder." }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }] };
    }
  }
);

server.tool(
  "get_uipath_job_status",
  "Check the status of a UiPath job by ID",
  {
    jobId: z.string().describe("Job ID to check"),
  },
  async (args) => {
    const baseUrl = process.env.UIPATH_BASE_URL ?? "https://cloud.uipath.com";
    const org = process.env.UIPATH_ORG ?? "";
    const tenant = process.env.UIPATH_TENANT ?? "";

    if (!org || !tenant) {
      return { content: [{ type: "text", text: "Error: UIPATH_ORG and UIPATH_TENANT must be set." }] };
    }

    let token: string;
    try {
      token = await getUiPathToken();
    } catch (e) {
      return { content: [{ type: "text", text: `Auth failed: ${e instanceof Error ? e.message : String(e)}` }] };
    }

    try {
      const res = await fetch(`${baseUrl}/${org}/${tenant}/orchestrator_/odata/Jobs(${args.jobId})`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await res.text();
      if (!res.ok) {
        return { content: [{ type: "text", text: `UiPath job lookup failed (${res.status}): ${text.slice(0, 300)}` }] };
      }

      const job = JSON.parse(text) as Record<string, unknown>;
      return {
        content: [
          {
            type: "text",
            text: `Job ${args.jobId}:\nState: ${job.State}\nStart: ${job.StartTime ?? "pending"}\nEnd: ${job.EndTime ?? "running"}\nInfo: ${job.Info ?? "none"}`,
          },
        ],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }] };
    }
  }
);

// TODO: Support multi-client SSE — use Map<sessionId, SSEServerTransport>
// Current: single client only (sufficient for MVP testing)
let transport: SSEServerTransport;

app.get("/sse", async (_req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(500).send("Transport not initialized");
  }
});

const PORT = process.env.PORT || 10001;

app.listen(PORT, () => {
  process.stderr.write(`[mcp-uipath] UiPath MCP Server running on SSE at http://localhost:${PORT}/sse\n`);
});
