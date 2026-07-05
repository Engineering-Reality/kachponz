# UiPath Integration — Amadeus Orchestrator

Robot terhubung ke service **murni lewat HTTP/JSON**. Bahasa internal UiPath
(C#/.NET) tidak relevan ke pilihan bahasa service. Cukup pakai **HTTP Request
activity**.

## 1. Simpan credential di Orchestrator Asset (JANGAN hardcode)

1. Di UiPath Orchestrator → **Assets** → buat **Credential Asset**:
   - Nama: `Amadeus_RobotKey` (contoh).
   - Username: nama robot (mis. `rpa-mt-converter`).
   - Password: nilai `X-Robot-Key` dari `npm run robot:register`.
2. Untuk robot finansial, simpan `Signing-Secret` di asset terpisah
   `Amadeus_SigningSecret`.
3. Di workflow: **Get Credential** activity → ambil ke variabel `SecureString`.
   Jangan pernah menaruh key sebagai literal di workflow/argument.

## 2. Contoh: buat transaksi baru

**HTTP Request activity**
- Method: `POST`
- Endpoint: `https://amadeus.internal.bankmandiri.co.id/transactions`
- Headers:
  - `X-Robot-Key` = `{{ credential.Password }}`
  - `Content-Type` = `application/json`
- Body (JSON):

```json
{
  "type": "import_lc",
  "idempotencyKey": "lc-2026-000123-create",
  "payload": { "lcNumber": "LC2026000123", "applicant": "PT XYZ" }
}
```

Response `201`:
```json
{ "id": "…uuid…", "current_step": "submitted", "version": 1, "status": "in_progress", … }
```

Simpan `id` (transactionId) untuk langkah berikutnya.

## 3. Contoh: menyelesaikan step (handoff)

- Method: `POST`
- Endpoint: `.../transactions/{id}/steps/distributed_to_analyst/complete`
- Headers: `X-Robot-Key`, `Content-Type: application/json`
- Body:

```json
{ "idempotencyKey": "lc-2026-000123-distributed", "payload": { "analyst": "AGT-04" } }
```

**Idempotency**: pakai key deterministik per (transaksi, step). Bila robot
retry karena timeout, kirim key yang **sama** → server tidak dobel-insert,
mengembalikan hasil sebelumnya (`idempotentReplay: true`).

## 4. Step finansial (mt_converted / swift_released / settled)

Step finansial butuh **signature HMAC-SHA512** selain `X-Robot-Key`.
Kirim header tambahan:

- `X-Robot-Timestamp` = unix seconds saat ini
- `X-Robot-Signing-Secret` = nilai Signing-Secret dari asset
- `X-Signature` = `HMAC_SHA512( secret, payload )` dalam hex

di mana `payload` = gabungan baris:
```
POST
/transactions/{id}/steps/mt_converted/complete
{timestamp}
{sha256_hex(body)}
```

Di UiPath, hitung HMAC/SHA256 via **Invoke Code** (C#) sebelum HTTP Request.
Contoh C# (Invoke Code, argumen: `secret`, `method`, `path`, `ts`, `body` in;
`signature` out):

```csharp
using System.Security.Cryptography;
using System.Text;

string bodySha;
using (var sha = SHA256.Create()) {
    var h = sha.ComputeHash(Encoding.UTF8.GetBytes(body));
    bodySha = BitConverter.ToString(h).Replace("-", "").ToLower();
}
string payload = method + "\n" + path + "\n" + ts + "\n" + bodySha;
using (var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(secret))) {
    var sig = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
    signature = BitConverter.ToString(sig).Replace("-", "").ToLower();
}
```

> Jika Anda men-set `SIGNATURE_PEPPER` di server, kunci HMAC menjadi
> `secret:PEPPER`. Samakan di sisi robot bila pepper dipakai.

Anti-replay: timestamp harus dalam jendela `SIGNATURE_MAX_SKEW_SEC` (default
300 dtk). Pastikan jam robot & server tersinkron (NTP).

## 5. A2A (opsional, koordinasi antar-agent)

Alih-alih memanggil endpoint step langsung, robot bisa mengirim envelope A2A
ke `POST /a2a` untuk mendapat info **handoff** (siapa mengambil step
berikutnya). Lihat `docs/a2a_protocol.md`.
