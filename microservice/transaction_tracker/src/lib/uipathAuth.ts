/**
 * UiPath OAuth2 client_credentials helper — SINGLE implementation.
 * Replaces the duplicated logic previously in:
 *   - scripts/mcpAutoManager.ts → getUipathTokenForTool()
 *   - src/orchestrator/executors/uipathExecutor.ts → getAccessToken()
 *
 * The `cacheKey` parameter differentiates callers sharing this one cache:
 * the executor uses env-level credentials (cacheKey: 'env-default'), while the
 * job-trace poller uses per-tool credentials (cacheKey: toolId).
 */
export interface UiPathCredentials {
  baseUrl: string;
  org: string;
  tenant: string;
  clientId: string;
  clientSecret: string;
  scopes?: string;
  folderId?: string;
}

const DEFAULT_SCOPES = 'OR.Jobs OR.Robots.Read OR.Execution OR.Queues OR.Monitoring';

const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

export async function getUiPathToken(
  cacheKey: string,
  creds: UiPathCredentials,
): Promise<string> {
  const now = Date.now();
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > now + 30_000) return cached.accessToken;

  const res = await fetch(`${creds.baseUrl}/identity_/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      scope: creds.scopes ?? DEFAULT_SCOPES,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`UiPath OAuth2 failed ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set(cacheKey, {
    accessToken: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  });
  return json.access_token;
}

/** Extract UiPath credentials from a tool's stored registration config. */
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
