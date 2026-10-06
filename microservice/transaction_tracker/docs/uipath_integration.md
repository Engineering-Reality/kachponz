# UiPath Integration Guide — Amadeus Transaction State Tracker

## Overview

The Transaction State Tracker exposes plain HTTP/JSON endpoints that any UiPath
workflow can call using the built-in **HTTP Request** activity. No custom
activity package (C#) is required.

Robot identity is verified via the `X-Robot-Key` header. The key is generated
once by an operator on the server using `npm run robot:register` and stored
securely in UiPath Orchestrator as a **Credential Asset**.

---

## 1. Storing the API Key in UiPath Orchestrator

> ⚠️ Never hardcode the API key in a workflow `.xaml` file or commit it to
> source control.

**Steps:**
1. In UiPath Orchestrator, go to **Tenant > Assets > New Asset**.
2. Set **Asset type** to **Credential**.
3. Name: `AmadeusTrackerKey` (or your naming convention).
4. Username: `<robot_name>` (e.g., `uipath-settlement-01`).
5. Password: `<api_key>` (the base64url string shown once by `robot:register`).
6. Save.

---

## 2. Retrieving the Key in a Workflow

Use the **Get Orchestrator Asset** activity (or **Get Credential** activity):

```xaml
<!-- Pseudo-XAML — simplified for illustration -->
<GetRobotCredential
    AssetName="AmadeusTrackerKey"
    Username="robotUserVar"
    Password="robotKeyVar" />
<!-- robotKeyVar now holds the API key as a SecureString -->

<!-- Convert SecureString → String when passing to HTTP Request -->
<InvokeCode>
    robotKeyString = New System.Net.NetworkCredential("", robotKeyVar).Password
</InvokeCode>
```

---

## 3. Example: Complete a Step at End of Job

Place this **HTTP Request** activity at the **end of your robot's Main sequence**,
after the robot's core work is finished.

### Variables to set before the activity

| Variable | Example value |
|---|---|
| `transactionId` | `"550e8400-e29b-41d4-a716-446655440000"` (from job input args) |
| `stepName` | `"distributed_to_analyst"` (hardcoded per workflow) |
| `jobRunId` | `System.Guid.NewGuid().ToString()` (used as idempotency key) |
| `apiKey` | from Orchestrator credential (see above) |
| `trackerBaseUrl` | `"https://tracker.internal.yourbank.com"` (behind TLS proxy) |

### HTTP Request Activity Settings

```
Activity:  HTTP Request
Endpoint:  {trackerBaseUrl}/transactions/{transactionId}/steps/{stepName}/complete
Method:    POST
Format:    application/json
Body (JSON):
{
  "status": "success",
  "actor": "uipath-settlement-01",
  "idempotency_key": "{jobRunId}",
  "payload": {
    "job_id": "{jobRunId}",
    "machine": "{System.Environment.MachineName}"
  }
}

Headers:
  Content-Type: application/json
  X-Robot-Key: {robotKeyString}
```

### On Failure (Try/Catch)

```xaml
<!-- If the HTTP Request throws, send a "failed" status before re-throwing -->
<TryCatch>
  <Try>
    <!-- ... robot core work ... -->
    <!-- HTTP Request: status="success" -->
  </Try>
  <Catches>
    <Catch TypeArgument="System.Exception" Name="ex">
      <!-- HTTP Request: status="failed", payload includes ex.Message -->
      <!-- Then: Throw ex  (or Rethrow) -->
    </Catch>
  </Catches>
</TryCatch>
```

---

## 4. Example: Create a New Transaction at Start

Call this at the **beginning of the first robot in the chain** (the one that
receives the LC document):

```
Endpoint:  {trackerBaseUrl}/transactions
Method:    POST
Body:
{
  "type": "import_lc",
  "company_id": "your-company-uuid"
}
Headers:
  Content-Type: application/json
  X-Robot-Key: {robotKeyString}
```

Save the `id` field from the JSON response as an Orchestrator Queue Item
argument or Job Input Argument so downstream robots can reference the same
`transaction_id`.

---

## 5. Step Names per Transaction Type

### `import_lc`
```
submitted → distributed_to_analyst → doc_examined → ee_ntf_created
→ ee_ntf_approved → mt_converted → swift_released → settled → advised
```

### `skbdn`
```
submitted → distributed_to_analyst → doc_examined → ee_ntf_created
→ ee_ntf_approved → swift_released → settled → advised
```

### `sblc`
```
submitted → distributed_to_analyst → doc_examined → claim_evaluated
→ claim_approved → swift_released → settled → advised
```

---

## 6. Idempotency Key

The `idempotency_key` field ensures that if UiPath retries the HTTP call
(e.g., due to a network timeout), the step is recorded only once.

**Recommended values:**
- UiPath job run ID: `System.Guid.NewGuid().ToString()` generated once at the
  start of the job and reused on all retries.
- Or any deterministic key derived from the business document ID:
  `$"{lcReferenceNumber}_{stepName}"`.

If the server returns the same event as before (with `"idempotent": true`),
the robot should treat it as success.

---

## 7. Expected Response Shapes

### Success (first call)
```json
{
  "transaction": { "id": "...", "current_step": "distributed_to_analyst", "version": 2, ... },
  "event": { "id": "...", "step": "distributed_to_analyst", "status": "success", ... }
}
```

### Idempotent replay
```json
{
  "idempotent": true,
  "event": { ... },
  "transaction": { ... }
}
```

### Error (structured)
```json
{
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Cannot skip from 'submitted' to 'doc_examined'. Next allowed step is 'distributed_to_analyst'",
    "additional_info": { "current_step": "submitted", "target_step": "doc_examined" }
  }
}
```
