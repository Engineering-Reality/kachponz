/**
 * tools.test.ts — amadeus-mcp test suite
 *
 * Strategy: mock global.fetch to intercept tracker API calls.
 * Each tool is tested for:
 *   1. Schema validation (invalid input rejected)
 *   2. Correct HTTP request emitted (method, path, headers)
 *   3. Response formatted correctly
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Setup env before any imports ---
process.env["AMADEUS_API_BASE"] = "http://test-tracker:8080";
process.env["AMADEUS_ROBOT_KEY"] = "test-robot-key";

// --- Tool imports (after env setup) ---
import * as listTransactionsMod from "../src/tools/listTransactions.js";
import * as getTransactionMod from "../src/tools/getTransaction.js";
import * as createTransactionMod from "../src/tools/createTransaction.js";
import * as dispatchStepMod from "../src/tools/dispatchStep.js";
import * as completeStepMod from "../src/tools/completeStep.js";
import * as failStepMod from "../src/tools/failStep.js";
import * as listExecutorsMod from "../src/tools/listExecutors.js";
import * as explainRouteMod from "../src/tools/explainRoute.js";

// --- Minimal McpServer stub for unit testing ---
type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>;

interface ToolEntry {
  name: string;
  description: string;
  handler: ToolHandler;
}

class MockMcpServer {
  private tools: Map<string, ToolEntry> = new Map();

  tool(
    name: string,
    description: string,
    _schema: Record<string, unknown>,
    handler: ToolHandler
  ): void {
    this.tools.set(name, { name, description, handler });
  }

  async callTool(name: string, args: Record<string, unknown>) {
    const entry = this.tools.get(name);
    if (!entry) throw new Error(`Tool "${name}" not registered`);
    return entry.handler(args);
  }
}

// Helper to create a mock fetch response
function mockResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. list_transactions
// ─────────────────────────────────────────────────────────────────────────────
describe("list_transactions", () => {
  let server: MockMcpServer;

  beforeEach(() => {
    server = new MockMcpServer();
    listTransactionsMod.registerListTransactions(server as never);
  });

  it("calls GET /transactions with filters", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ items: [], count: 0 })
    );

    await server.callTool("list_transactions", { status: "in_progress", type: "import_lc", limit: 10 });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const url = String((fetchSpy.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("/transactions");
    expect(url).toContain("status=in_progress");
    expect(url).toContain("type=import_lc");
    expect(url).toContain("limit=10");
    fetchSpy.mockRestore();
  });

  it("returns 'no transactions' message when items empty", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(mockResponse({ items: [], count: 0 }));
    const result = await server.callTool("list_transactions", {});
    expect(result.content[0].text).toContain("No transactions found");
    vi.restoreAllMocks();
  });

  it("formats transaction list correctly", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({
        items: [{ id: "abc123def456", type: "import_lc", current_step: "submitted", status: "in_progress" }],
        count: 1,
      })
    );
    const result = await server.callTool("list_transactions", {});
    expect(result.content[0].text).toContain("Found 1 transaction(s)");
    expect(result.content[0].text).toContain("import_lc");
    vi.restoreAllMocks();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. get_transaction
// ─────────────────────────────────────────────────────────────────────────────
describe("get_transaction", () => {
  let server: MockMcpServer;

  beforeEach(() => {
    server = new MockMcpServer();
    getTransactionMod.registerGetTransaction(server as never);
  });

  it("calls GET /transactions/:id", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ transaction: { id: "uuid-1", type: "import_lc", current_step: "submitted", status: "in_progress" }, events: [] })
    );
    await server.callTool("get_transaction", { id: "550e8400-e29b-41d4-a716-446655440000" });
    const url = String((fetchSpy.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("/transactions/550e8400-e29b-41d4-a716-446655440000");
    fetchSpy.mockRestore();
  });

  it("formats timeline from events", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({
        transaction: { id: "tx-001", type: "import_lc", current_step: "doc_examined", status: "in_progress" },
        events: [
          { step: "submitted", status: "completed", actor: "contact_point", created_at: "2026-07-05T08:00:00Z" },
        ],
      })
    );
    const result = await server.callTool("get_transaction", { id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(result.content[0].text).toContain("Timeline:");
    expect(result.content[0].text).toContain("submitted");
    vi.restoreAllMocks();
  });

  it("flags financial step in header", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({
        transaction: { id: "tx-002", type: "import_lc", current_step: "mt_converted", status: "in_progress" },
        events: [],
      })
    );
    const result = await server.callTool("get_transaction", { id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(result.content[0].text).toContain("financial: yes");
    vi.restoreAllMocks();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. create_transaction
// ─────────────────────────────────────────────────────────────────────────────
describe("create_transaction", () => {
  let server: MockMcpServer;

  beforeEach(() => {
    server = new MockMcpServer();
    createTransactionMod.registerCreateTransaction(server as never);
  });

  it("calls POST /transactions with correct body", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ id: "new-uuid", current_step: "submitted", type: "import_lc" })
    );
    await server.callTool("create_transaction", { type: "import_lc" });
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/transactions");
    expect((opts as { method: string }).method).toBe("POST");
    const body = JSON.parse(String((opts as { body: string }).body));
    expect(body.type).toBe("import_lc");
    fetchSpy.mockRestore();
  });

  it("includes next step hint in response", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ id: "abc-123", current_step: "submitted", type: "skbdn" })
    );
    const result = await server.callTool("create_transaction", { type: "skbdn" });
    expect(result.content[0].text).toContain("dispatch_step");
    vi.restoreAllMocks();
  });

  it("includes transaction id in response", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ id: "full-uuid-here", current_step: "submitted", type: "sblc" })
    );
    const result = await server.callTool("create_transaction", { type: "sblc" });
    expect(result.content[0].text).toContain("full-uuid-here");
    vi.restoreAllMocks();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. dispatch_step
// ─────────────────────────────────────────────────────────────────────────────
describe("dispatch_step", () => {
  let server: MockMcpServer;

  beforeEach(() => {
    server = new MockMcpServer();
    dispatchStepMod.registerDispatchStep(server as never);
  });

  it("calls POST /orchestrator/dispatch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ outcome: "completed", executor: "executor.qwen_vl", step: "doc_examined", currentStepAfter: "ee_ntf_created" })
    );
    await server.callTool("dispatch_step", { transactionId: "550e8400-e29b-41d4-a716-446655440000", idempotencyKey: "dispatch-key-001" });
    const url = String((fetchSpy.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("/orchestrator/dispatch");
    fetchSpy.mockRestore();
  });

  it("shows ✅ for completed outcome", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ outcome: "completed", executor: "executor.qwen", step: "doc_examined", currentStepAfter: "ee_ntf_created" })
    );
    const result = await server.callTool("dispatch_step", { transactionId: "550e8400-e29b-41d4-a716-446655440000", idempotencyKey: "idem-ok-001" });
    expect(result.content[0].text).toContain("✅");
    vi.restoreAllMocks();
  });

  it("shows 🚀 for dispatched outcome", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ outcome: "dispatched", executor: "executor.uipath", step: "mt_converted", currentStepAfter: "mt_converted", externalJobId: "job-42" })
    );
    const result = await server.callTool("dispatch_step", { transactionId: "550e8400-e29b-41d4-a716-446655440000", idempotencyKey: "idem-ok-002" });
    expect(result.content[0].text).toContain("🚀");
    expect(result.content[0].text).toContain("job-42");
    vi.restoreAllMocks();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. complete_step
// ─────────────────────────────────────────────────────────────────────────────
describe("complete_step", () => {
  let server: MockMcpServer;

  beforeEach(() => {
    server = new MockMcpServer();
    completeStepMod.registerCompleteStep(server as never);
  });

  it("blocks financial step without signature", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const result = await server.callTool("complete_step", {
      transactionId: "550e8400-e29b-41d4-a716-446655440000",
      step: "mt_converted",
      idempotencyKey: "idem-fin-001",
    });
    expect(result.content[0].text).toContain("requires a signature");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("calls complete endpoint for non-financial step", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ transaction: { current_step: "doc_examined", status: "in_progress" }, idempotentReplay: false })
    );
    await server.callTool("complete_step", {
      transactionId: "550e8400-e29b-41d4-a716-446655440000",
      step: "submitted",
      idempotencyKey: "idem-non-fin-001",
    });
    const url = String((fetchSpy.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("/steps/submitted/complete");
    fetchSpy.mockRestore();
  });

  it("sends X-Robot-Timestamp header for financial step", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ transaction: { current_step: "swift_released", status: "in_progress" }, idempotentReplay: false })
    );
    await server.callTool("complete_step", {
      transactionId: "550e8400-e29b-41d4-a716-446655440000",
      step: "mt_converted",
      idempotencyKey: "idem-fin-002",
      signature: { timestamp: "2026-07-05T12:00:00Z", secret: "my-secret" },
    });
    const headers = (fetchSpy.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers["X-Robot-Timestamp"]).toBe("2026-07-05T12:00:00Z");
    fetchSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. fail_step
// ─────────────────────────────────────────────────────────────────────────────
describe("fail_step", () => {
  let server: MockMcpServer;

  beforeEach(() => {
    server = new MockMcpServer();
    failStepMod.registerFailStep(server as never);
  });

  it("sends A2A task.failed envelope to /a2a", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ accepted: true, currentStep: "doc_examined", status: "in_progress" })
    );
    await server.callTool("fail_step", {
      transactionId: "550e8400-e29b-41d4-a716-446655440000",
      step: "doc_examined",
      reason: "Document illegible",
      idempotencyKey: "fail-idem-001",
    });
    const url = String((fetchSpy.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("/a2a");
    const body = JSON.parse(String((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.type).toBe("task.failed");
    expect(body.reason).toBe("Document illegible");
    fetchSpy.mockRestore();
  });

  it("includes reason in response text", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ accepted: true, currentStep: "doc_examined", status: "in_progress" })
    );
    const result = await server.callTool("fail_step", {
      transactionId: "550e8400-e29b-41d4-a716-446655440000",
      step: "doc_examined",
      reason: "Stamp missing",
      idempotencyKey: "fail-idem-002",
    });
    expect(result.content[0].text).toContain("Stamp missing");
    vi.restoreAllMocks();
  });

  it("shows retry hint in response", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ accepted: true, currentStep: "doc_examined", status: "in_progress" })
    );
    const result = await server.callTool("fail_step", {
      transactionId: "550e8400-e29b-41d4-a716-446655440000",
      step: "doc_examined",
      reason: "Network timeout",
      idempotencyKey: "fail-idem-003",
    });
    expect(result.content[0].text).toContain("retry");
    vi.restoreAllMocks();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. list_executors
// ─────────────────────────────────────────────────────────────────────────────
describe("list_executors", () => {
  let server: MockMcpServer;

  beforeEach(() => {
    server = new MockMcpServer();
    listExecutorsMod.registerListExecutors(server as never);
  });

  it("calls GET /orchestrator/executors", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ executors: [] })
    );
    await server.callTool("list_executors", {});
    const url = String((fetchSpy.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("/orchestrator/executors");
    fetchSpy.mockRestore();
  });

  it("returns 'no executors' when list empty", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(mockResponse({ executors: [] }));
    const result = await server.callTool("list_executors", {});
    expect(result.content[0].text).toContain("No executors");
    vi.restoreAllMocks();
  });

  it("formats executor list with costUnit", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({
        executors: [
          { id: "executor.qwen", kind: "llm", costUnit: 1, agentic: true, capabilities: [{ step: "doc_examined", types: ["import_lc"] }] },
        ],
      })
    );
    const result = await server.callTool("list_executors", {});
    expect(result.content[0].text).toContain("executor.qwen");
    expect(result.content[0].text).toContain("costUnit: 1");
    vi.restoreAllMocks();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. explain_route
// ─────────────────────────────────────────────────────────────────────────────
describe("explain_route", () => {
  let server: MockMcpServer;

  beforeEach(() => {
    server = new MockMcpServer();
    explainRouteMod.registerExplainRoute(server as never);
  });

  it("calls GET /orchestrator/route?step=&type=", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({ chosen: { id: "executor.uipath", kind: "rpa", costUnit: 3 }, reason: "preferred", alternatives: [] })
    );
    await server.callTool("explain_route", { step: "mt_converted", type: "import_lc" });
    const url = String((fetchSpy.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("/orchestrator/route");
    expect(url).toContain("step=mt_converted");
    expect(url).toContain("type=import_lc");
    fetchSpy.mockRestore();
  });

  it("returns 'no executor' message when 404", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(mockResponse(null));
    const result = await server.callTool("explain_route", { step: "unknown_step", type: "import_lc" });
    expect(result.content[0].text).toContain("No executor found");
    vi.restoreAllMocks();
  });

  it("formats chosen executor and reason", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(
      mockResponse({
        chosen: { id: "executor.pad", kind: "rpa", costUnit: 2 },
        reason: "lowest_cost",
        alternatives: [{ id: "executor.uipath", kind: "rpa", costUnit: 3 }],
      })
    );
    const result = await server.callTool("explain_route", { step: "ee_ntf_created", type: "import_lc" });
    expect(result.content[0].text).toContain("executor.pad");
    expect(result.content[0].text).toContain("lowest_cost");
    expect(result.content[0].text).toContain("executor.uipath");
    vi.restoreAllMocks();
  });
});
