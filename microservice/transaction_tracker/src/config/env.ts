import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Startup env validation (fail-fast).
 *
 * CISO Code Security Review #40: connection string tidak boleh hardcoded di
 * source; hanya dibaca dari environment. CISO #34: informasi sensitif tidak
 * disimpan plaintext di source. Semua secret masuk lewat env di sini, satu
 * pintu, dan divalidasi sebelum proses menerima trafik.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),

  // Server
  HOST: z.string().default('127.0.0.1'), // bind localhost; TLS terminasi di reverse proxy
  PORT: z.coerce.number().int().positive().default(8080),

  // Database (on-prem PostgreSQL). WAJIB di-set, tidak ada default.
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL wajib di-set (contoh: postgres://user:pass@host:5432/amadeus)')
    .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
      message: 'DATABASE_URL harus koneksi PostgreSQL on-prem, bukan URL layanan cloud pihak ketiga',
    }),

  // Pool tuning
  PG_POOL_MAX: z.coerce.number().int().positive().default(10),
  PG_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  // Financial signature layer (HMAC-SHA512). Per-robot secret sebenarnya
  // disimpan di service_accounts.signing_secret_hash; nilai ini hanya pepper
  // opsional untuk memperkuat. Optional supaya dev tanpa step finansial tetap jalan.
  SIGNATURE_PEPPER: z.string().min(16).optional(),

  // Log level
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Skew toleransi timestamp signature (detik) — anti-replay window.
  SIGNATURE_MAX_SKEW_SEC: z.coerce.number().int().positive().default(300),

  // Endpoint LLM Air-gapped (mis. Qwen via Ollama/vLLM)
  // Opsional. Jika kosong, agent akan menggunakan fallback deterministik.
  AGENT_LLM_URL: z.string().url().optional(),

  // OAUTH2 JWT Secret (Untuk verifikasi token Bearer stateless)
  OAUTH2_JWT_SECRET: z.string().min(16).optional(),

  // ─── Qwen (LLM/VLM) ─────────────────────────────────────────────────
  // Mode: 'cloud' = DashScope Alibaba (⚠️ dev/demo saja, lihat qwenClient.ts).
  //       'on_prem' = Ollama/vLLM internal (untuk production nasabah).
  QWEN_MODE: z.enum(['cloud', 'on_prem']).default('cloud'),
  QWEN_BASE_URL: z
    .string()
    .url()
    .default('https://dashscope.aliyuncs.com/compatible-mode/v1'),
  QWEN_API_KEY: z.string().min(1).optional(),
  QWEN_VL_MODEL: z.string().default('qwen-vl-max'),
  QWEN_LLM_MODEL: z.string().default('qwen-plus'),
  QWEN_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

  // Hard wall-clock ceiling on a single runAgenticStep call (invoke or
  // stream). Paired with recursionLimit so a stuck multi-step UiPath chain
  // can't burn tokens/hold a connection indefinitely. 15 min default is
  // generous for one disposable-email→login→OTP→survey chain + one retry.
  AGENT_WALL_CLOCK_TIMEOUT_MS: z.coerce.number().int().positive().default(15 * 60_000),

  // ─── UiPath Automation Cloud ────────────────────────────────────────
  // These env vars are ONLY needed for the legacy direct UiPath executor
  // (non-MCP path, e.g. uipathExecutor.ts). For MCP-based invocation,
  // credentials are stored per-tool in the database `tools.versions[].released.env`
  // and injected at spawn time by mcpAutoManager.ts.
  UIPATH_BASE_URL: z.string().url().default('https://cloud.uipath.com'),
  UIPATH_ORG: z.string().optional(),
  UIPATH_TENANT: z.string().optional(),
  UIPATH_CLIENT_ID: z.string().optional(),
  UIPATH_CLIENT_SECRET: z.string().optional(),
  UIPATH_SCOPES: z.string().default('OR.Jobs OR.Robots.Read OR.Execution'),
  UIPATH_FOLDER_ID: z.string().default('0'),
  /**
   * Peta step→releaseKey, format: "step:type=releaseKey;step2=releaseKey2"
   * Contoh: "mt_converted:import_lc=abc-123;swift_released=def-456"
   */
  UIPATH_RELEASE_MAP: z.string().optional(),

  // ─── Power Automate Desktop ─────────────────────────────────────────
  PAD_DISPATCH_MODE: z
    .enum(['power_automate_http', 'custom_bridge', 'queued_only'])
    .default('queued_only'),
  PAD_DISPATCH_URL: z.string().url().optional(),
  PAD_DISPATCH_AUTH_HEADER: z.string().optional(),
  PAD_DISPATCH_AUTH_VALUE: z.string().optional(),

  // ─── MCP SSE dynamic port allocation ────────────────────────────────
  // Overrides for config/port_range.json — same defaults as the legacy
  // Python get_free_port() implementation.
  MCP_HOST: z.string().optional(),
  MCP_START_PORT: z.coerce.number().int().positive().optional(),
  MCP_END_PORT: z.coerce.number().int().positive().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Jangan bocorkan nilai; hanya nama field + pesan. (CISO #32)
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`[env] Validasi environment gagal:\n${issues}`);
    process.exit(1);
  }
  cached = parsed.data;
  return cached;
}

export const env = loadEnv();
