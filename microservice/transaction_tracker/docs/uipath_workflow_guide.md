# UiPath Workflow untuk Amadeus (End-to-End)

Panduan ini menunjukkan bagaimana workflow UiPath berperan sebagai executor di
alur Amadeus — menerima dispatch, melakukan kerjaan, lalu **wajib** melapor
balik lewat A2A supaya state tracker maju.

Ada dua **pola** yang bisa dipakai tim RPA:

- **Pola A — Robot dispatched dari Amadeus** (recommended untuk step
  mt_converted / swift_released / settled): Amadeus panggil UiPath Jobs API
  → UiPath robot mulai → robot lapor balik ke Amadeus.
- **Pola B — Robot polling / triggered manual** (untuk transisi): robot cek
  papan skor Amadeus, ambil kerjaan yang cocok, kerjakan, lapor balik. Cocok
  untuk migrasi bertahap tanpa mengubah UiPath Orchestrator dulu.

## Pola A: Dispatched — struktur workflow

Saat Amadeus dispatch job, ia meneruskan input arguments berikut ke workflow
UiPath (via UiPath Orchestrator Jobs API `InputArguments`):

```json
{
  "AmadeusTransactionId": "…uuid…",
  "AmadeusStep": "mt_converted",
  "AmadeusType": "import_lc",
  "AmadeusPayload": { "…any domain data…": "…" }
}
```

Deklarasikan variabel-in ini di workflow UiPath:

| Argument name              | Direction | Type   |
|----------------------------|-----------|--------|
| `in_AmadeusTransactionId`  | In        | String |
| `in_AmadeusStep`           | In        | String |
| `in_AmadeusType`           | In        | String |
| `in_AmadeusPayload`        | In        | String (JSON) |

### Struktur workflow (Main.xaml)

```
Try
├── (1) Get Credentials
│   └── Get Credential activity: "Amadeus_RobotKey"
│       out → RobotKey (SecureString → String)
│   └── Get Credential activity: "Amadeus_SigningSecret"  (jika step finansial)
│       out → SigningSecret
│
├── (2) Do the actual work
│   ├── Login ke EE / SAA / dll (sesuai step)
│   ├── Konversi MT103 / MT202 (untuk mt_converted)
│   ├── Release ke SWIFT (untuk swift_released)
│   ├── Settlement D/K (untuk settled)
│   └── … (business logic tim RPA)
│
├── (3) Kompute hasil untuk laporan
│   └── Assign resultPayload = new JObject() with:
│         "mt103_reference": …
│         "swift_response_code": …
│         "settled_at": DateTime.UtcNow.ToString("o")
│
└── (4) LAPOR KE AMADEUS (WAJIB!)
    ├── Invoke Code (C#, kompute HMAC signature — hanya bila step finansial):
    │
    │   [in]  string secret, method, path, timestamp, bodyJson
    │   [out] string signature
    │
    │   using System.Security.Cryptography;
    │   using System.Text;
    │   string bodySha;
    │   using (var sha = SHA256.Create()) {
    │       var h = sha.ComputeHash(Encoding.UTF8.GetBytes(bodyJson));
    │       bodySha = BitConverter.ToString(h).Replace("-", "").ToLower();
    │   }
    │   string payload = method + "\n" + path + "\n" + timestamp + "\n" + bodySha;
    │   using (var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(secret))) {
    │       var sig = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
    │       signature = BitConverter.ToString(sig).Replace("-", "").ToLower();
    │   }
    │
    ├── HTTP Request activity → POST /a2a
    │       URL: https://amadeus.internal/a2a
    │       Headers:
    │         X-Robot-Key = RobotKey
    │         (bila finansial:)
    │         X-Robot-Timestamp = timestamp
    │         X-Robot-Signing-Secret = SigningSecret
    │         X-Signature = signature (hasil Invoke Code)
    │       Body (JSON):
    │       {
    │         "protocol": "amadeus.a2a/0",
    │         "type": "task.complete",
    │         "transactionId": in_AmadeusTransactionId,
    │         "step": in_AmadeusStep,
    │         "idempotencyKey": in_AmadeusTransactionId + ":" + in_AmadeusStep + ":uipath",
    │         "correlationId": "uipath:" + Environment.MachineName + ":" + JobId,
    │         "data": resultPayload,
    │         "sentAt": DateTime.UtcNow.ToString("o")
    │       }
    │
    └── If response.status != 200:
          Throw BusinessRuleException("Amadeus report failed: " + response.body)

Catch (any exception)
    ├── Log message + rollback (bila perlu, tergantung step)
    │
    └── HTTP Request → POST /a2a (task.failed)
            Same auth headers as above
            Body:
            {
              "protocol": "amadeus.a2a/0",
              "type": "task.failed",
              "transactionId": in_AmadeusTransactionId,
              "step": in_AmadeusStep,
              "idempotencyKey": in_AmadeusTransactionId + ":" + in_AmadeusStep + ":uipath-fail",
              "correlationId": "uipath-fail:" + JobId,
              "reason": exception.Message.Substring(0, Math.Min(400, exception.Message.Length)),
              "sentAt": DateTime.UtcNow.ToString("o")
            }
```

### Kenapa `idempotencyKey` deterministik dari `transactionId:step`?

Supaya kalau Amadeus retry dispatch (mis. UiPath job gagal transient dan
di-restart oleh Orchestrator UiPath), robot yang kedua akan pakai key yang
sama → state tracker mendeteksi replay dan tidak dobel-post event.

## Pola B: Robot Polling / Manual Trigger

Untuk migrasi bertahap — belum siap konfigurasi UiPath Jobs API dispatch.

Robot dijadwal (Scheduler UiPath) atau attended-triggered, dengan alur:

```
Loop:
├── GET /transactions?status=in_progress&type=import_lc&limit=50
│   Filter di sisi robot: yang current_step-nya = step yang di-handle robot ini.
│
├── For each matching transaction:
│   ├── (opsional) POST /a2a { type: task.assign, … }  ← reserve intent
│   ├── Lakukan pekerjaan
│   └── POST /a2a { type: task.complete, … }  ← lapor selesai
```

**Catatan**: pola B ada race condition kecil (dua robot ambil tx yang sama).
State tracker akan menolak yang kedua dengan `STEP_MISMATCH` atau
`VERSION_CONFLICT` — jadi tetap safe, hanya kurang efisien. Pola A lebih
disukai bila UiPath Jobs API sudah aktif.

## Contoh Idempotency key strategy (best practice)

| Konteks | Format idempotencyKey | Kenapa |
|---------|----------------------|--------|
| Dispatched, sukses | `{txId}:{step}:uipath` | Jelas 1:1 dengan step; retry tidak dobel. |
| Dispatched, gagal | `{txId}:{step}:uipath-fail:{jobId}` | Setiap job attempt beda; bila retry berhasil setelah gagal, tetap tercatat. |
| Poll pattern | `{txId}:{step}:{robotName}` | Robot berbeda tidak menabrak; robot sama retry idempoten. |

## Testing lokal (tanpa robot asli)

Bisa demo Pola A dengan `curl` yang meniru workflow UiPath:

```bash
# 1) Amadeus dispatch step (misal ee_ntf_created via PAD queued_only)
curl -X POST http://localhost:8080/orchestrator/dispatch \
  -H "X-Robot-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"transactionId":"...","idempotencyKey":"lc-001:disp:1"}'

# → response: { "outcome": "dispatched", "executor": "executor.pad.ee_create", ... }

# 2) Simulasikan robot melapor selesai
curl -X POST http://localhost:8080/a2a \
  -H "X-Robot-Key: $ROBOT_KEY" -H "Content-Type: application/json" \
  -d '{
    "protocol": "amadeus.a2a/0",
    "type": "task.complete",
    "transactionId": "...",
    "step": "ee_ntf_created",
    "idempotencyKey": "lc-001:ee_ntf_created:sim",
    "correlationId": "test",
    "sentAt": "2026-07-05T09:00:00Z"
  }'

# → response: state tracker maju ke ee_ntf_approved
```

Verifikasi via GET `/transactions/:id` → `current_step` sudah maju,
`transaction_events` bertambah 1 dengan `actor` = nama robot yang melapor.
