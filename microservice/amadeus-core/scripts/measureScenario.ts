/**
 * owo.md LANJUTAN C driver — runs one scenario (S1/S2/S3/S5) for N iterations
 * directly against the real orchestrator (runAgenticStep / extractTextFromImage),
 * bypassing the HTTP/auth layer since we're not testing auth here. Telemetry is
 * written to llm_usage_events by the instrumentation already wired into
 * engine.ts / visionExtract.ts, gated by LLM_USAGE_TELEMETRY=on.
 *
 * Env controls (set by the orchestrating shell, one process per
 * scenario x thinking-mode combo so env.ts's module-level cache picks up
 * the right values):
 *   SCENARIO_LABEL        S1 | S2 | S3 | S5
 *   SCENARIO_ITERATIONS   default 20
 *   LLM_USAGE_TELEMETRY   on
 *   LLM_MEASUREMENT_SCENARIO   same as SCENARIO_LABEL (tags DB rows)
 *   LLM_MEASUREMENT_REASONING on|off
 *   LLM_MEASUREMENT_PROVIDER  coreweave (text) | deepinfra (vision, S3)
 *   OPENROUTER_LLM_MODEL / OPENROUTER_VL_MODEL  candidate slugs (this process only)
 *
 * Usage: npx tsx scripts/measureScenario.ts
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { runAgenticStep } from '../src/orchestrator/engine.js';
import { extractTextFromImage } from '../src/orchestrator/executors/visionExtract.js';
import type { AuthContext } from '../src/types/domain.js';
import { closePool } from '../src/db/pool.js';

const PONZ_PATH = '/home/firania/Downloads/ponzgen/ponz.txt';
const IMG_DIR = '/tmp/qwen-tok-test/images';

const AUTH: AuthContext = {
  serviceAccountId: 'e8dbc00f-b6fa-482c-871d-9fb1d1fd7cb1',
  robotName: 'test-openrouter-migration-2',
  companyId: '455bbe68-f931-4c1a-ad06-402f92292099',
  allowedTypes: null,
  financiallySigned: false,
};

const AGENTS = {
  swiftMt: '41720d75-e025-4e0a-9f4a-ad9ad7d44c4c', // SwiftMTApuPptDetector
  researchAssistant: 'd5291c85-5aef-4443-8d3b-121e80e480c6', // Research Assistant, tools: []
};

function loadPonzMessages(): string[] {
  const raw = fs.readFileSync(PONZ_PATH, 'utf8');
  return raw
    .split(/^---$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

const S5_PROMPTS = [
  'What are the key differences between an MT103 and an MT202 SWIFT message?',
  'Summarize the main categories of AML red flags for correspondent banking in 3 bullet points.',
  'Explain what a nostro/vostro account relationship is, in plain terms.',
  'What is the difference between sanctions screening and PEP screening?',
  'In one paragraph, explain why trade-based money laundering is hard to detect.',
];

async function main() {
  const scenario = process.env.SCENARIO_LABEL;
  const iterations = Number(process.env.SCENARIO_ITERATIONS ?? '20');
  if (!scenario) {
    console.error('SCENARIO_LABEL env var required (S1|S2|S3|S5)');
    process.exit(2);
  }

  const messages = scenario === 'S1' ? loadPonzMessages() : [];
  const batchText = scenario === 'S2' ? fs.readFileSync(PONZ_PATH, 'utf8') : '';

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < iterations; i++) {
    const startedAt = Date.now();
    try {
      if (scenario === 'S1') {
        const msg = messages[i % messages.length]!;
        await runAgenticStep(AUTH, undefined, randomUUID(), msg, undefined, AGENTS.swiftMt, 'playground');
      } else if (scenario === 'S2') {
        await runAgenticStep(AUTH, undefined, randomUUID(), batchText, undefined, AGENTS.swiftMt, 'playground');
      } else if (scenario === 'S3') {
        const buf = fs.readFileSync(`${IMG_DIR}/a4_300dpi.jpg`);
        await extractTextFromImage(buf, 'image/jpeg');
      } else if (scenario === 'S5') {
        const prompt = S5_PROMPTS[i % S5_PROMPTS.length]!;
        await runAgenticStep(AUTH, undefined, randomUUID(), prompt, undefined, AGENTS.researchAssistant, 'playground');
      } else {
        throw new Error(`Unknown scenario: ${scenario}`);
      }
      ok++;
      console.log(`[${scenario}] iter ${i + 1}/${iterations} OK (${Date.now() - startedAt}ms)`);
    } catch (err) {
      failed++;
      console.error(`[${scenario}] iter ${i + 1}/${iterations} FAILED (${Date.now() - startedAt}ms):`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\n[${scenario}] done — ${ok} ok, ${failed} failed, out of ${iterations}`);
  await closePool();
  // tsx's persistent esbuild worker keeps the event loop alive after this
  // point, so the process never exits on its own — force it.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
