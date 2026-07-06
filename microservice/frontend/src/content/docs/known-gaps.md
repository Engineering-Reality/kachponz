This document outlines the current technical limitations and known gaps within the **Amadeus TypeScript Stack**. Review these caveats before deploying to production or assuming specific end-to-end automations are fully realized.

---

## 1. Executor & Dispatch Limitations

### Empty Dispatch Payload
Currently, `dispatch_step` passes an empty payload (`data: {}`) to the underlying executors. 
- **Impact**: The Qwen VL `doc_examined` LLM executor fails with *"imageRef dokumen tidak tersedia"* when triggered via standard dispatch, because it expects a document reference.
- **Workaround**: The `e2e-demo.ts` script works around this by falling back to a simulated `complete_step` when the dispatch does not return a `completed` state. 

### PAD Executor Trigger
The Power Automate Desktop (PAD) executor (`padExecutor.ts`) acts as a generic HTTP dispatcher, but `PAD_DISPATCH_MODE` defaults to `queued_only`.
- **Impact**: No real external trigger is sent to Power Automate. It merely records the intent to execute in the database.
- **Next Steps**: Await infrastructure team confirmation on the actual PAD webhook/trigger mechanism. An `mcp-pad` server will be built following the exact same OAuth2 pattern as `mcp-uipath`.

---

## 2. MCP Server Scaling

The `amadeus-mcp` and `mcp-uipath` tool servers currently support exactly **one connected SSE client at a time**. 
- **Architecture**: They utilize a module-level `transport` variable rather than a session map. 
- **Impact**: This is perfectly fine for MVP demos and single-agent execution in the Next.js console, but it will drop connections if multiple concurrent LangGraph agents attempt to bind to the SSE transport simultaneously.

---

## 3. Cryptographic Signature Constraints

As noted in the Architecture Overview, financial steps (`mt_converted`, `swift_released`, `settled`) enforce an HMAC-SHA512 signature layer.

### The `SIGNATURE_PEPPER` Pitfall
If `AMADEUS_SIGNATURE_PEPPER` is defined in the `transaction_tracker` environment, it **must** be exactly replicated in the environment of every connecting client (`amadeus-mcp`, `e2e-demo.ts`, or any custom RPA script). 
- **Impact**: A missing or mismatched pepper will cause the HMAC computation to fail silently, resulting in a persistent `SIGNATURE_REQUIRED` rejection from the tracker.

### Secret Transmission
Currently, `X-Robot-Signing-Secret` is transmitted in the clear (over HTTP headers). The server hashes this rapidly via Argon2 and compares it against the database.
- **Security Posture**: This is a deliberate interim design for the MVP. 
- **Roadmap**: Hardening this layer with strict OAuth2 or mTLS is required before exposing the service outside of the internal air-gapped network.
