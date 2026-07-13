/**
 * UiPath OAuth2 client_credentials helper — SINGLE implementation.
 * Replaces the duplicated logic previously in:
 *   - scripts/mcpAutoManager.ts → getUipathTokenForTool()
 *   - src/orchestrator/executors/uipathExecutor.ts → getAccessToken()
 *
 * The `cacheKey` parameter differentiates callers sharing this one cache:
 * the executor uses env-level credentials (cacheKey: 'env-default'), while the
 * job-trace poller uses per-tool credentials (cacheKey: toolId).
 *
 * Retry/backoff/negative-cache: "Auth failed: fetch failed" used to be
 * thrown verbatim for any network-class failure (DNS/TCP/TLS), indistinguishable
 * from a real 401/403 credential rejection, with no retry and no protection
 * against a caller hammering a dead identity endpoint (e.g. the frontend's
 * 4-second UiPathLiveGraph poll). getUiPathToken now classifies failures into
 * UipathAuthError.cause and retries only the classes where retrying can help.
 */
import { logger } from './logger.js';

const authLogger = logger.child({ module: 'uipathAuth' });

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

export type UipathAuthFailureCause = 'network' | 'credentials' | 'server' | 'rate_limit';

/**
 * Typed failure surfaced by getUiPathToken so callers can distinguish "UiPath
 * identity endpoint unreachable" from "credentials rejected" instead of both
 * collapsing into the same opaque "fetch failed" string.
 */
export class UipathAuthError extends Error {
  readonly cause: UipathAuthFailureCause;
  readonly status?: number;

  constructor(message: string, cause: UipathAuthFailureCause, status?: number) {
    super(message);
    this.name = 'UipathAuthError';
    this.cause = cause;
    this.status = status;
  }
}

const NETWORK_ERROR_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'UND_ERR_SOCKET']);

/** How long a cached failure short-circuits new attempts, per cause. */
const NEGATIVE_CACHE_MS: Record<UipathAuthFailureCause, number> = {
  network: 10_000,
  server: 10_000,
  rate_limit: 10_000,
  credentials: 60_000, // longer — retrying quickly on bad creds risks locking the account
};

/** 1 initial attempt + 3 retries, same shape as engine.ts's withMcpRetry. */
const BACKOFF_MS = [500, 1500, 4500];

function isNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const code = (e as { cause?: { code?: string } }).cause?.code;
  if (code && NETWORK_ERROR_CODES.has(code)) return true;
  return /fetch failed/i.test(e.message);
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const asSeconds = Number(header);
  if (Number.isFinite(asSeconds)) return asSeconds * 1000;
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

function jittered(ms: number): number {
  const jitter = ms * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(ms + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();
const failureCache = new Map<string, { at: number; error: UipathAuthError }>();

/** Clears both the success and failure cache for a key (or every key if omitted). */
export function resetUiPathTokenCache(cacheKey?: string): void {
  if (cacheKey) {
    tokenCache.delete(cacheKey);
    failureCache.delete(cacheKey);
    return;
  }
  tokenCache.clear();
  failureCache.clear();
}

export async function getUiPathToken(
  cacheKey: string,
  creds: UiPathCredentials,
): Promise<string> {
  const now = Date.now();
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > now + 30_000) return cached.accessToken;

  const cachedFailure = failureCache.get(cacheKey);
  if (cachedFailure) {
    const windowMs = NEGATIVE_CACHE_MS[cachedFailure.error.cause];
    if (Date.now() - cachedFailure.at < windowMs) {
      throw cachedFailure.error;
    }
    failureCache.delete(cacheKey);
  }

  let lastErr: UipathAuthError | null = null;
  let retryAfterMs: number | null = null;

  for (let attempt = 1; attempt <= BACKOFF_MS.length + 1; attempt++) {
    const attemptStart = Date.now();

    try {
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

      if (res.ok) {
        const json = (await res.json()) as { access_token: string; expires_in: number };
        tokenCache.set(cacheKey, { accessToken: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 });
        failureCache.delete(cacheKey);
        authLogger.info(
          { cacheKey, outcome: 'success', attempt, durationMs: Date.now() - attemptStart, status: res.status },
          'UiPath auth attempt',
        );
        return json.access_token;
      }

      const text = await res.text().catch(() => '');

      if (res.status === 429) {
        retryAfterMs = parseRetryAfterMs(res.headers.get('retry-after'));
        lastErr = new UipathAuthError(`UiPath identity rate-limited (429): ${text.slice(0, 200)}`, 'rate_limit', 429);
        authLogger.info(
          { cacheKey, outcome: 'rate_limit', attempt, durationMs: Date.now() - attemptStart, status: 429 },
          'UiPath auth attempt',
        );
      } else if (res.status >= 500) {
        lastErr = new UipathAuthError(`UiPath identity service is unhealthy — retry later (${res.status}): ${text.slice(0, 200)}`, 'server', res.status);
        authLogger.info(
          { cacheKey, outcome: 'server', attempt, durationMs: Date.now() - attemptStart, status: res.status },
          'UiPath auth attempt',
        );
      } else {
        // 4xx (excluding 429): credentials rejected — never retry, never lock the account further.
        const err = new UipathAuthError(
          `UiPath credentials rejected — check UIPATH_CLIENT_ID / UIPATH_CLIENT_SECRET (${res.status}): ${text.slice(0, 200)}`,
          'credentials',
          res.status,
        );
        authLogger.info(
          { cacheKey, outcome: 'credentials', attempt, durationMs: Date.now() - attemptStart, status: res.status },
          'UiPath auth attempt',
        );
        failureCache.set(cacheKey, { at: Date.now(), error: err });
        throw err;
      }
    } catch (e) {
      if (e instanceof UipathAuthError) throw e; // credentials — already logged + cached above

      if (!isNetworkError(e)) throw e; // genuinely unexpected (programmer error) — don't swallow

      lastErr = new UipathAuthError(
        `UiPath identity endpoint unreachable from this host: ${e instanceof Error ? e.message : String(e)}`,
        'network',
      );
      authLogger.info(
        { cacheKey, outcome: 'network', attempt, durationMs: Date.now() - attemptStart, status: null },
        'UiPath auth attempt',
      );
    }

    const isLastAttempt = attempt === BACKOFF_MS.length + 1;
    if (isLastAttempt) break;

    const base = BACKOFF_MS[attempt - 1]!;
    const delay = retryAfterMs != null ? Math.max(base, retryAfterMs) : jittered(base);
    retryAfterMs = null;
    await sleep(delay);
  }

  failureCache.set(cacheKey, { at: Date.now(), error: lastErr! });
  throw lastErr!;
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
