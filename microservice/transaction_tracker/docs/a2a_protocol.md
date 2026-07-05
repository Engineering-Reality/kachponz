# Amadeus A2A Protocol — v0

Protokol Agent-to-Agent untuk koordinasi robot UiPath/PAD & agent internal
di alur settlement Import LC/SKBDN/SBLC. Menggantikan handoff email manual.

## Prinsip

1. **Satu sumber kebenaran**: state tracker (Layer 1). Tidak ada state paralel
   di orchestrator. Semua invariant (transisi sah, idempotency, optimistic
   lock, financial gate) ditegakkan di sana.
2. **Transport-neutral**: HTTP/JSON. UiPath (C#/.NET) & PAD cukup HTTP Request.
3. **Identitas by service account**, bukan self-declared. Auth di Layer 1.
4. **Handoff = penyelesaian step yang membuka step berikutnya** untuk agent lain.

## Envelope

```jsonc
{
  "protocol": "amadeus.a2a/0",
  "type": "task.complete",         // task.assign | task.complete | task.failed | task.status
  "transactionId": "…uuid…",
  "step": "doc_examined",          // step yang diselesaikan/dimaksud
  "idempotencyKey": "lc-123-docexam",
  "correlationId": "conv-abc",     // korelasi lintas message
  "reason": null,                  // wajib utk task.failed & transisi mundur
  "data": { "…": "…" },            // muatan domain (opsional)
  "sentAt": "2026-07-03T08:00:00Z"
}
```

## Tipe pesan

| type | efek |
|------|------|
| `task.assign` | Informasional (koordinator mencatat niat). Handoff nyata terjadi saat complete. Mengembalikan status kini. |
| `task.complete` | Selesaikan `step`, majukan state, hitung `nextStep` + `nextActorHint`. Idempoten. |
| `task.failed` | Catat kegagalan (wajib `reason`); step tetap untuk retry. |
| `task.status` | Query status transaksi + siapa pemegang step berikutnya. |

## Response (`A2AResult`)

```jsonc
{
  "accepted": true,
  "transactionId": "…",
  "currentStep": "ee_ntf_created",
  "status": "in_progress",
  "nextStep": "ee_ntf_created",       // yang kini terbuka (null bila selesai)
  "nextActorHint": "maker_agent",     // hint siapa mengambil (bukan otoritatif)
  "idempotentReplay": false
}
```

`nextActorHint` berasal dari `stepFlows.ts` (`actorHint`). Ini **hint routing**,
bukan otorisasi — otorisasi tetap by service account `allowed_types`.

## Alur contoh (memetakan diagram "Usulan Agentic AI New UI Path")

```
Contact Point  --task.complete(submitted)-->        next: distributed_to_analyst (rpa_distributor)
RPA 1          --task.complete(distributed)-->      next: doc_examined (analyst_or_agent)
Agentic AI     --run-agentic / task.complete(doc)-->next: ee_ntf_created (maker_agent)
RPA 2 (Maker)  --task.complete(ee_ntf_created)-->   next: ee_ntf_approved (checker_human)
Checker        --task.complete(ee_ntf_approved)-->  next: mt_converted (rpa_mt_converter) [FINANSIAL]
RPA (MT)       --task.complete(mt_converted)+SIG--> next: swift_released (saa_gateway) [FINANSIAL]
SAA            --task.complete(swift_released)+SIG-->next: settled [FINANSIAL]
Settlement     --task.complete(settled)+SIG-->      next: advised (kopra_notify)
KOPRA          --task.complete(advised)-->          status: completed
```

## Agent in-process (agentic)

Agent agentic (mis. Document Examination) dijalankan orchestrator lewat
`POST /orchestrator/run-agentic`. Registry (`src/orchestrator/agents/base.ts`)
memetakan step→agent. Slot LLM/VLM air-gapped tersedia di
`docExamAgent.ts` (belum diisi — keputusan model terpisah).

## Sandbox CLI

```bash
npm run agent:sandbox -- list
npm run agent:sandbox -- run agent.doc_exam.v0 --type import_lc --data '{"imageRef":"lc-001.png"}'
```

Menjalankan `agent.handle()` langsung tanpa DB/HTTP — iterasi cepat saat
mengembangkan agent baru.

## Versi & evolusi

`protocol: "amadeus.a2a/0"` memungkinkan negosiasi versi ke depan. Perluasan
terencana: event `failed` formal + kompensasi, task artifact (referensi
dokumen), streaming status.
