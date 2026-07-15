/**
 * Agent Sandbox CLI — dev loop lokal ala LangGraph/LlamaIndex, tapi on-prem &
 * tanpa dependency eksternal. Untuk mengembangkan & menguji agent sendiri
 * sebelum dipasang ke orchestrator.
 *
 * Pakai:
 *   npm run agent:sandbox -- list
 *   npm run agent:sandbox -- run <agentId> --type import_lc --data '{"imageRef":"lc-001.png"}'
 *
 * Sandbox menjalankan agent.handle() LANGSUNG (tanpa DB/HTTP), mencetak outcome.
 * Ini memisahkan logika agent dari plumbing state tracker sehingga iterasi cepat.
 */
import { registry } from '../src/orchestrator/agents/base.js';
import { docExamAgent } from '../src/orchestrator/agents/docExamAgent.js';

// Registrasi agent yang mau diuji di sandbox.
try {
  registry.register(docExamAgent);
} catch {
  /* noop */
}

function parseFlags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a?.startsWith('--')) out[a.slice(2)] = argv[++i] ?? '';
  }
  return out;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === 'list') {
    console.log('Agent terdaftar:');
    for (const a of registry.all()) {
      const caps = a.descriptor.capabilities
        .map((c) => `${c.step}[${c.types.join('|')}]${c.financial ? ' $' : ''}`)
        .join(', ');
      console.log(`  - ${a.descriptor.id} (${a.descriptor.agentic ? 'agentic' : 'rpa'}) :: ${caps}`);
    }
    return;
  }

  if (cmd === 'run') {
    const agentId = rest[0];
    const flags = parseFlags(rest.slice(1));
    if (!agentId) {
      console.error('Pakai: run <agentId> --type <type> [--data <json>]');
      process.exit(2);
    }
    const agent = registry.get(agentId);
    if (!agent) {
      console.error(`Agent tidak ditemukan: ${agentId}`);
      process.exit(3);
    }
    if (!agent.handle) {
      console.error(`Agent ${agentId} tidak punya handle() (agent eksternal/RPA).`);
      process.exit(3);
    }
    let data: Record<string, unknown> = {};
    if (flags.data) {
      try {
        data = JSON.parse(flags.data);
      } catch {
        console.error('--data bukan JSON valid');
        process.exit(2);
      }
    }
    const cap = agent.descriptor.capabilities[0];
    const outcome = await agent.handle({
      transactionId: '00000000-0000-0000-0000-000000000000',
      step: cap?.step ?? 'unknown',
      type: flags.type ?? cap?.types[0] ?? 'import_lc',
      data,
    });
    console.log('Outcome:', JSON.stringify(outcome, null, 2));
    return;
  }

  console.log('Perintah: list | run <agentId> [flags]');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
