The Amadeus platform provides a unified Next.js App Router console (`microservice/frontend`) to monitor, manage, and execute agentic operations across the LC Settlement Stack.

> [!WARNING]
> Please note that there is a legacy Vite + React SPA located in the root `/frontend` directory (`amedus-ai`). That is a completely standalone marketing site. It shares no codebase or runtime with this console and can be safely ignored when working on the LC Settlement Stack.

## Core Console Pages (`microservice/frontend`)

| Route | Purpose | Backend Integration |
|---|---|---|
| `/` | Landing page featuring the Live Settlement Graph and architecture highlights. | — |
| `/dashboard` | Advanced Transaction Ledger. Provides split views for transaction lists, immutable event logs, A2A interaction history, and flow graphs. | `transaction_tracker` REST (`/transactions`) |
| `/dashboard/amadeus` | Executive overview dashboard with KPI cards and a clickable state-machine pipeline view. | `transaction_tracker` REST (Polled every 5s) |
| `/agent-invoke` | The primary interactive console. Streams real-time LangGraph agent reasoning over a selected transaction via SSE. Features a system log for raw tool execution output. | `transaction_tracker` (`/orchestrator/run-agentic`) |
| `/agent-creator` | Interactive UX for designing new agents via natural language descriptions, featuring an "LC Settlement Orchestrator" preset. | — |
| `/agents` | Agent Matrix registry. Used to define personas (`agent_style`) and assign specific MCP tools to the LangGraph agents. | `transaction_tracker` REST (`/agents`) |
| `/tools` | MCP Tool Registry. Used to configure dynamic MCP connections (SSE or STDIO) and manage their active states. | `transaction_tracker` REST (`/tools`) |
| `/docs/*` | This markdown documentation viewer powered by `react-markdown` and `remark-gfm`. | Static Files |

---

## API Configuration

Every single page within this Next.js console derives its target backend URL from the `NEXT_PUBLIC_API_URL` environment variable.

By default, this points to `http://localhost:8080`, which is the default operating port for the `transaction_tracker` Fastify service.

If you deploy the backend to a cloud environment (e.g., AWS, GCP, or a dedicated on-prem server), simply update the `.env.local` file in the `microservice/frontend` directory:

```bash
NEXT_PUBLIC_API_URL=https://amadeus-tracker.your-enterprise.internal
```

The frontend will immediately route all ledger requests, LangGraph streaming connections, and tool registry configurations to the remote instance.
