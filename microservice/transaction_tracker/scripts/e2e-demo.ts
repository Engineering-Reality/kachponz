/**
 * End-to-end LC settlement demo.
 *
 * Menunjukkan satu "orchestrator agent" menggerakkan seluruh alur
 * settlement Import LC dari submitted sampai advised, menggunakan
 * amadeus-orchestrator-mcp + amadeus-uipath-mcp sebagai tools (via HTTP
 * langsung — bukan MCP protocol; lihat catatan di README/demo_setup_guide.md
 * soal kenapa).
 *
 * Catatan: kedua MCP server sekarang paket npm mandiri, bukan folder di
 * monorepo. Amadeus men-spawn-nya lewat `npx` saat tool diregistrasi di
 * halaman Tools — tidak perlu `cd` ke folder lokal lagi.
 *
 * Jalankan:
 *   1. Start transaction_tracker:  cd transaction_tracker && npm run start
 *   2. (opsional, untuk debug manual di luar Amadeus):
 *        npx -y amadeus-orchestrator-mcp@latest
 *        npx -y amadeus-uipath-mcp@latest       (hanya DEMO_MODE=live)
 *   3. Jalankan demo:              npx tsx scripts/e2e-demo.ts
 *
 * Env:
 *   AMADEUS_API_BASE        default http://127.0.0.1:8080
 *   AMADEUS_ROBOT_KEY       X-Robot-Key robot (lihat scripts/registerRobot.ts)
 *   AMADEUS_SIGNING_SECRET  signing secret robot (WAJIB untuk financial steps)
 *   AMADEUS_SIGNATURE_PEPPER opsional, harus sama dengan SIGNATURE_PEPPER tracker
 *   DEMO_MODE               'simulate' (default) | 'live'
 *   UIPATH_*                hanya dipakai saat DEMO_MODE=live (lihat README amadeus-uipath-mcp)
 *   UIPATH_RELEASE_MAP      "mt_converted=<key>;swift_released=<key>;settled=<key>"
 *
 * Output: log narasi step-by-step yang bisa di-screenshot.
 */
import { createHash, createHmac, randomUUID } from "node:crypto";

const AMADEUS_API = process.env.AMADEUS_API_BASE ?? "http://127.0.0.1:8080";
const AMADEUS_KEY = process.env.AMADEUS_ROBOT_KEY ?? "";
const SIGNING_SECRET = process.env.AMADEUS_SIGNING_SECRET ?? "";
const SIGNATURE_PEPPER = process.env.AMADEUS_SIGNATURE_PEPPER ?? "";
const DEMO_MODE = (process.env.DEMO_MODE ?? "simulate") as "simulate" | "live";

const UIPATH_BASE_URL = process.env.UIPATH_BASE_URL ?? "https://cloud.uipath.com";
const UIPATH_ORG = process.env.UIPATH_ORG ?? "";
const UIPATH_TENANT = process.env.UIPATH_TENANT ?? "";
const UIPATH_CLIENT_ID = process.env.UIPATH_CLIENT_ID ?? "";
const UIPATH_CLIENT_SECRET = process.env.UIPATH_CLIENT_SECRET ?? "";
const UIPATH_SCOPES = process.env.UIPATH_SCOPES ?? "OR.Default";
const UIPATH_FOLDER_ID = process.env.UIPATH_FOLDER_ID ?? "0";
const UIPATH_RELEASE_MAP = process.env.UIPATH_RELEASE_MAP ?? "";

const LC_STEPS = [
  "submitted",
  "distributed_to_analyst",
  "doc_examined",
  "ee_ntf_created",
  "ee_ntf_approved",
  "mt_converted",
  "swift_released",
  "settled",
  "advised",
] as const;

const FINANCIAL_STEPS = new Set(["mt_converted", "swift_released", "settled"]);
const DISPATCHABLE_STEPS = ["distributed_to_analyst", "doc_examined", "ee_ntf_created"] as const;

function nowHms(): string {
  return new Date().toTimeString().slice(0, 8);
}

function narrate(msg: string): void {
  console.log(`[${nowHms()}] ${msg}`);
}

function idem(tag: string): string {
  return `e2e-${tag}-${randomUUID().slice(0, 8)}`;
}

interface Transaction {
  id: string;
  type: string;
  current_step: string;
  status: string;
  version: number;
}

interface RouteChoice {
  chosen: { id: string; kind: string; costUnit: number };
  reason: string;
}

interface DispatchResult {
  outcome: "completed" | "dispatched" | "failed";
  executor: string;
  step: string;
  currentStepAfter: string;
  status: string;
  externalJobId?: string;
  reason?: string;
}

interface CompleteResult {
  transaction: Transaction;
  idempotentReplay?: boolean;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<unknown> {
  const res = await fetch(`${AMADEUS_API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Robot-Key": AMADEUS_KEY,
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  narrate(`🔧 ${method} ${path} → ${res.status}`);
  if (!res.ok) {
    throw new ApiError(res.status, `${method} ${path} failed: ${text.slice(0, 300)}`);
  }
  return text.length > 0 ? JSON.parse(text) : null;
}

function signCompleteStep(
  transactionId: string,
  step: string,
  body: { idempotencyKey: string; payload: Record<string, unknown> },
): Record<string, string> {
  const path = `/transactions/${encodeURIComponent(transactionId)}/steps/${encodeURIComponent(step)}/complete`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodySha = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const signaturePayload = `POST\n${path}\n${timestamp}\n${bodySha}`;
  const hmacKey = SIGNATURE_PEPPER ? `${SIGNING_SECRET}:${SIGNATURE_PEPPER}` : SIGNING_SECRET;
  const hmac = createHmac("sha512", hmacKey).update(signaturePayload).digest("hex");
  return {
    "X-Robot-Timestamp": timestamp,
    "X-Robot-Signing-Secret": SIGNING_SECRET,
    "X-Signature": hmac,
  };
}

async function createTransaction(type: string): Promise<Transaction> {
  return (await apiRequest("POST", "/transactions", {
    type,
    idempotencyKey: idem("create"),
    payload: {},
  })) as Transaction;
}

async function getTransaction(id: string): Promise<{ transaction: Transaction; events: unknown[] }> {
  return (await apiRequest("GET", `/transactions/${id}`)) as {
    transaction: Transaction;
    events: unknown[];
  };
}

async function explainRoute(step: string, type: string): Promise<RouteChoice | null> {
  try {
    return (await apiRequest("GET", `/orchestrator/route?step=${step}&type=${type}`)) as RouteChoice;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

async function dispatchStep(transactionId: string): Promise<DispatchResult> {
  return (await apiRequest("POST", "/orchestrator/dispatch", {
    transactionId,
    idempotencyKey: idem("dispatch"),
  })) as DispatchResult;
}

async function completeStep(
  transactionId: string,
  step: string,
  financial: boolean,
): Promise<CompleteResult> {
  const body = { idempotencyKey: idem(`complete-${step}`), payload: {} };
  const headers = financial ? signCompleteStep(transactionId, step, body) : undefined;
  return (await apiRequest(
    "POST",
    `/transactions/${transactionId}/steps/${step}/complete`,
    body,
    headers,
  )) as CompleteResult;
}

async function failStep(transactionId: string, step: string, reason: string): Promise<unknown> {
  return apiRequest("POST", "/a2a", {
    protocol: "amadeus.a2a/0",
    type: "task.failed",
    transactionId,
    step,
    idempotencyKey: idem(`fail-${step}`),
    correlationId: `e2e-demo:${step}`,
    reason,
    data: {},
    sentAt: new Date().toISOString(),
  });
}

// ── UiPath Cloud direct REST (DEMO_MODE=live only) ──────────────────────────

let uipathToken: { accessToken: string; expiresAt: number } | null = null;

async function getUiPathToken(): Promise<string> {
  const now = Date.now();
  if (uipathToken && uipathToken.expiresAt > now + 30_000) return uipathToken.accessToken;
  const res = await fetch(`${UIPATH_BASE_URL}/identity_/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: UIPATH_CLIENT_ID,
      client_secret: UIPATH_CLIENT_SECRET,
      scope: UIPATH_SCOPES,
    }).toString(),
  });
  if (!res.ok) throw new Error(`UiPath OAuth2 failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  uipathToken = { accessToken: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return json.access_token;
}

function releaseKeyFor(step: string): string | null {
  for (const entry of UIPATH_RELEASE_MAP.split(";").map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = entry.split("=");
    if (k === step && v) return v;
  }
  return null;
}

async function listUiPathProcesses(): Promise<Array<{ Name: string; Key: string }>> {
  const token = await getUiPathToken();
  const res = await fetch(`${UIPATH_BASE_URL}/${UIPATH_ORG}/${UIPATH_TENANT}/orchestrator_/odata/Releases`, {
    headers: { Authorization: `Bearer ${token}`, "X-UIPATH-OrganizationUnitId": UIPATH_FOLDER_ID },
  });
  if (!res.ok) throw new Error(`UiPath Releases failed ${res.status}`);
  const json = (await res.json()) as { value?: Array<{ Name: string; Key: string }> };
  return json.value ?? [];
}

async function triggerUiPathJob(
  releaseKey: string,
  args: Record<string, unknown>,
): Promise<{ jobId: string }> {
  const token = await getUiPathToken();
  const res = await fetch(
    `${UIPATH_BASE_URL}/${UIPATH_ORG}/${UIPATH_TENANT}/orchestrator_/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-UIPATH-OrganizationUnitId": UIPATH_FOLDER_ID,
      },
      body: JSON.stringify({
        startInfo: {
          ReleaseKey: releaseKey,
          Strategy: "ModernJobsCount",
          JobsCount: 1,
          InputArguments: JSON.stringify(args),
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`UiPath StartJobs failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { value?: Array<{ Id: number }> };
  const job = json.value?.[0];
  if (!job) throw new Error("UiPath StartJobs returned no job");
  return { jobId: String(job.Id) };
}

async function getUiPathJobStatus(jobId: string): Promise<string> {
  const token = await getUiPathToken();
  const res = await fetch(`${UIPATH_BASE_URL}/${UIPATH_ORG}/${UIPATH_TENANT}/orchestrator_/odata/Jobs(${jobId})`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`UiPath job lookup failed ${res.status}`);
  const job = (await res.json()) as { State?: string };
  return job.State ?? "Unknown";
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Demo flow ────────────────────────────────────────────────────────────

async function runAutomatableStep(transactionId: string, step: string): Promise<void> {
  try {
    const result = await dispatchStep(transactionId);
    if (result.outcome === "completed") {
      narrate(`✅ Step ${step} completed by ${result.executor}`);
      return;
    }
    if (result.outcome === "dispatched") {
      narrate(`🚀 Step ${step} dispatched to ${result.executor} — waiting for robot`);
      narrate(`🎭 Simulating robot completion callback for ${step} (no live PAD/robot attached)...`);
      await completeStep(transactionId, step, false);
      narrate(`✅ Step ${step} completed (simulated robot report-back)`);
      return;
    }
    narrate(`❌ Step ${step} failed: ${result.reason ?? "unknown"} [SKIPPED — simulating completion to continue demo]`);
    await completeStep(transactionId, step, false);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    narrate(`❌ Step ${step} dispatch error: ${msg} [SKIPPED — simulating completion to continue demo]`);
    await completeStep(transactionId, step, false);
  }
  const { transaction } = await getTransaction(transactionId);
  narrate(`📋 Transaction now at: ${transaction.current_step} (status: ${transaction.status})`);
}

async function runFinancialStep(transactionId: string, step: string): Promise<void> {
  if (DEMO_MODE === "simulate") {
    narrate(`🏦 Financial step ${step} — would dispatch to UiPath, simulating...`);
    if (!SIGNING_SECRET) {
      narrate(`⚠️  AMADEUS_SIGNING_SECRET not set — signature will fail. See demo_setup_guide.md.`);
    }
    await completeStep(transactionId, step, true);
    narrate(`✅ Financial step ${step} completed (simulated)`);
    return;
  }

  // MODE B — live UiPath Cloud
  const releaseKey = releaseKeyFor(step);
  if (!releaseKey) {
    narrate(`❌ No releaseKey configured for ${step} in UIPATH_RELEASE_MAP [SKIPPED — simulating]`);
    await completeStep(transactionId, step, true);
    return;
  }

  const processes = await listUiPathProcesses();
  narrate(`📦 ${processes.length} UiPath process(es) available in folder ${UIPATH_FOLDER_ID}`);

  const { jobId } = await triggerUiPathJob(releaseKey, {
    AmadeusTransactionId: transactionId,
    AmadeusStep: step,
  });
  narrate(`🚀 UiPath job ${jobId} started for step ${step}`);

  const deadline = Date.now() + 60_000;
  let state = "Pending";
  while (Date.now() < deadline) {
    await sleep(5000);
    state = await getUiPathJobStatus(jobId);
    narrate(`⏳ UiPath job ${jobId} state: ${state}`);
    if (state === "Successful" || state === "Faulted" || state === "Stopped") break;
  }

  if (state === "Successful") {
    await completeStep(transactionId, step, true);
    narrate(`✅ Financial step ${step} completed (UiPath job ${jobId})`);
  } else {
    await failStep(transactionId, step, `UiPath job ${jobId} ended in state ${state}`);
    narrate(`❌ Financial step ${step} failed (UiPath job ${jobId}: ${state})`);
  }
}

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════");
  console.log(" AMADEUS END-TO-END SETTLEMENT DEMO");
  console.log(` Mode: ${DEMO_MODE}`);
  console.log("═══════════════════════════════════════════════════\n");

  // STEP 1: Create transaction
  const tx = await createTransaction("import_lc");
  narrate(`📋 LC-${tx.id.slice(0, 8)} created. Status: ${tx.status}, step: ${tx.current_step}`);

  // STEP 2: Explain routing plan
  console.log("\nStep                    │ Executor                       │ Kind   │ Cost");
  console.log("────────────────────────┼────────────────────────────────┼────────┼─────");
  const routePlan = new Map<string, RouteChoice | null>();
  for (const step of LC_STEPS) {
    const route = await explainRoute(step, "import_lc");
    routePlan.set(step, route);
    const label = route ? route.chosen.id : "(manual — human)";
    const kind = route ? route.chosen.kind : "—";
    const cost = route ? String(route.chosen.costUnit) : "—";
    console.log(`${step.padEnd(24)}│ ${label.padEnd(31)}│ ${kind.padEnd(7)}│ ${cost}`);
  }
  console.log();

  // STEP 2.5: "submitted" is a manual Contact Point intake — no automatic
  // executor (see routePlan above). Must be completed before the state
  // machine can advance to the first automatable step.
  narrate("📇 Step submitted is manual (Contact Point intake). Simulating acknowledgement...");
  await completeStep(tx.id, "submitted", false);
  narrate("✅ Contact Point acknowledged submission");

  // STEP 3-6: Dispatch automatable steps
  for (const step of DISPATCHABLE_STEPS) {
    await runAutomatableStep(tx.id, step);
  }

  // STEP 7: Simulate checker approval
  narrate("⏸️  Step ee_ntf_approved requires human checker. Simulating approval...");
  await completeStep(tx.id, "ee_ntf_approved", false);
  narrate("✅ Checker approved EE/NTF");

  // STEP 8-10: Financial steps
  for (const step of ["mt_converted", "swift_released", "settled"]) {
    await runFinancialStep(tx.id, step);
  }

  // STEP 11: Last step (advised)
  await runAutomatableStep(tx.id, "advised");
  narrate("✅ Step advised completed. LC settlement DONE!");

  // STEP 12: Final summary
  const { transaction: finalTx, events } = await getTransaction(tx.id);

  let totalCost = 0;
  const byKind: Record<string, { count: number; cost: number }> = {};
  for (const step of LC_STEPS) {
    const route = routePlan.get(step);
    const kind = route ? route.chosen.kind : "manual";
    const cost = route ? route.chosen.costUnit : 0;
    totalCost += cost;
    byKind[kind] = byKind[kind] ?? { count: 0, cost: 0 };
    byKind[kind]!.count += 1;
    byKind[kind]!.cost += cost;
  }
  const allUipathCost = LC_STEPS.length * 100;
  const savingsPct = Math.round(((allUipathCost - totalCost) / allUipathCost) * 100);

  console.log("\n═══════════════════════════════════════════════════");
  console.log(" AMADEUS END-TO-END SETTLEMENT DEMO — COMPLETE");
  console.log(` Transaction: ${finalTx.id}`);
  console.log(` Type: ${finalTx.type}`);
  console.log(` Total steps: ${LC_STEPS.length}`);
  console.log(` Total events: ${events.length}`);
  console.log(" Executors used:");
  for (const [kind, stats] of Object.entries(byKind)) {
    console.log(`   ${kind.padEnd(10)}: ${stats.count} step(s) — cost ~${stats.cost} units`);
  }
  console.log(` Total cost: ~${totalCost} units`);
  console.log(` vs. All-UiPath: ~${allUipathCost} units`);
  console.log(` SAVINGS: ~${savingsPct}%`);
  console.log("═══════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error(`\n💥 Demo aborted: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
