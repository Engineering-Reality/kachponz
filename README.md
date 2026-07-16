# Amadeus Platform: 4D Lifecycle
<img width="1920" height="1080" alt="Image" src="https://github.com/user-attachments/assets/fd2c7f01-3263-4161-9876-cbfee01d21e9" />
Amadeus is an orchestration platform designed to seamlessly integrate intelligent Agentic capabilities with deterministic tools and external APIs. This document outlines the project's journey through the 4D Lifecycle: Discover, Design, Develop, and Deploy.

---

## A. Discover -> Problem & Solution

### Why we need this? (Why?)
Organizations currently struggle with isolated automation bots and disconnected LLM models. While LLMs excel at reasoning, they lack the "hands" to execute actions. Conversely, traditional APIs and RPA bots can execute actions but lack the "brain" to reason dynamically. We need a unified platform where intelligent agents can dynamically select and use tools to solve complex user intents without hardcoded flows.

### What we gonna do? (What?)
We are building **Amadeus**, a central orchestration platform centered around:
1. **Agent Creator**: Allowing users to seamlessly design and configure intelligent agents.
2. **Tools Registry**: A centralized hub to register and manage capabilities (APIs, scripts).
3. **Agent Invoke**: A dynamic playground where agents can be summoned to execute tasks by reasoning and utilizing the attached tools.

### Detailed Agent Invoke & Orchestration Flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f8fafc', 'primaryTextColor': '#0f172a', 'primaryBorderColor': '#3b82f6', 'lineColor': '#94a3b8', 'noteBkgColor': '#e0f2fe', 'noteTextColor': '#0f172a', 'actorBkg': '#f1f5f9', 'actorTextColor': '#0f172a', 'signalColor': '#94a3b8'}}}%%
sequenceDiagram
    participant User as Canvas (Playground)
    participant Core as Brain (Amadeus Orchestrator)
    participant LC as LangChain / LangGraph Engine
    participant DB as PostgreSQL Storage
    participant MCP as Hands (MCP Adapters)
    participant External as External APIs / RPA

    User->>Core: 1. Send User Intent (Prompt via SSE)
    Core->>DB: 2. Fetch Agent Config & Chat History
    DB-->>Core: Agent Config (Role, Allowed Tools)
    Core->>LC: 3. Initialize Agentic Workflow (ReAct Loop)
    
    rect rgb(240, 248, 255)
        note right of LC: LangGraph Reasoning Cycle
        LC->>LC: 4. Analyze Intent & Planning
        
        alt Tool Required
            LC->>Core: 5. Tool Call Requested
            Core->>MCP: 6. Resolve MCP Standard Protocol
            MCP->>External: 7. Execute External API / RPA Script
            External-->>MCP: 8. Return Execution Data
            MCP-->>Core: 9. Format Data for LLM
            Core-->>LC: 10. Inject Tool Output into Context
            LC->>LC: 11. Synthesize Data (Re-evaluate Plan)
        else No Tool Required
            LC->>LC: Direct Synthesis
        end
    end
    
    LC-->>Core: 12. Final Response Generated
    Core-->>DB: 13. Persist New Chat State
    Core-->>User: 14. Stream Response to UI (Markdown)
```

---

## B. Design -> System Architecture

Our architecture is strictly divided into four specialized layers to ensure scalability and separation of concerns.

### 1. Presentation Layer -> Canvas (Front End)
The interactive interface where users configure agents and test them.
- **Tech**: React, Next.js, Tailwind CSS, React Flow.
- **Features**: Agent Creator UI, Interactive Playground (Agent Invoke), Streaming Chat UI.

### 2. Orchestration Core -> Brain (Back End)
The reasoning engine that manages agent states and tool selection.
- **Tech**: Node.js, Fastify, LangChain/LangGraph.
- **Features**: LLM Routing, Session Memory, Agent Configuration processing.

### 3. Integration Layer -> Hands (API Gateway, MCP)
The standardized protocol layer for tool execution.
- **Tech**: Model Context Protocol (MCP).
- **Features**: Standardized tool execution, dynamic tool discovery, external API bridging.

### 4. Data Layer -> Storage (Database)
The persistent memory and configuration storage.
- **Tech**: PostgreSQL.
- **Features**: Storing Agent configurations, Tool schemas, Chat history, and Feature Sharing links.

### System Architecture Flowchart

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f8fafc', 'primaryTextColor': '#0f172a', 'primaryBorderColor': '#3b82f6', 'lineColor': '#94a3b8', 'clusterBkg': '#1e293b', 'clusterBorder': '#334155'}}}%%
flowchart LR
    subgraph Canvas [Presentation Layer: Canvas]
        UI[Playground / Agent Creator]
    end
    
    subgraph Brain [Orchestration Core: Brain]
        Engine[Agentic Engine]
        Memory[Context & State]
    end
    
    subgraph Hands [Integration Layer: Hands]
        MCP[MCP Adapters]
        API[External Tools / APIs]
    end
    
    subgraph Storage [Data Layer: Storage]
        DB[(PostgreSQL)]
    end
    
    UI <-->|REST / SSE| Engine
    Engine <--> Memory
    Engine <-->|MCP Protocol| MCP
    MCP <--> API
    Engine <--> DB
```

### Enterprise DC / DRC Infrastructure Topology

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f8fafc', 'primaryTextColor': '#0f172a', 'primaryBorderColor': '#3b82f6', 'lineColor': '#94a3b8', 'clusterBkg': '#1e293b', 'clusterBorder': '#334155'}}}%%
flowchart TD
    subgraph ExternalServices [External Services]
        LDAP[LDAP Server]
        SMTP[Corporate SMTP]
        DNS_CR[DNS Load Balancer - Orchestrator]
        DNS_DB[DNS Load Balancer - Database]
    end

    subgraph DC [Site 1: Prod - DC]
        direction TB
        CR_DC[Amadeus Orchestrator Server]
        DB_DC[(PostgreSQL DB-DC)]
        Runner_DC[MCP Runners / Agents]
        Creator_DC[Agent Creator Node]
        
        CR_DC <-->|WSS / HTTPS| Runner_DC
        CR_DC <-->|WSS / HTTPS| Creator_DC
        CR_DC <-->|TCP 5432| DB_DC
    end

    subgraph DRC [Site 2: Prod - DRC]
        direction TB
        CR_DRC[Amadeus Orchestrator Server]
        DB_DRC[(PostgreSQL DB-DRC)]
        Runner_DRC[MCP Runners / Agents]
        Creator_DRC[Agent Creator Node]
        
        CR_DRC <-->|WSS / HTTPS| Runner_DRC
        CR_DRC <-->|WSS / HTTPS| Creator_DRC
        CR_DRC <-->|TCP 5432| DB_DRC
    end

    subgraph ManagedSystems [Managed Systems & APIs]
        Server[Internal Servers]
        WebApp[Web Applications]
        Desktop[Desktop / Legacy RPA]
        CoreDB[(Core Databases)]
    end

    %% DC to DRC Replication
    DB_DC <.->|DB Replication / Streaming| DB_DRC

    %% External Connections
    DNS_CR -.->|HTTPS / WSS| CR_DC
    DNS_CR -.->|HTTPS / WSS| CR_DRC
    
    DNS_DB -.->|TCP 5432| DB_DC
    DNS_DB -.->|TCP 5432| DB_DRC

    CR_DC <-->|Port 389| LDAP
    CR_DC <-->|Port 587| SMTP
    CR_DRC <-->|Port 389| LDAP
    CR_DRC <-->|Port 587| SMTP

    Runner_DC --> ManagedSystems
    Creator_DC --> ManagedSystems
    Runner_DRC --> ManagedSystems
    Creator_DRC --> ManagedSystems
```


---

## C. Develop -> Roadmap

The development of the platform is divided into iterative sprints focusing on core agent capabilities.

### Sprints & Feature Planning
- **Sprint 1: Core Orchestration**
  - Establish base LLM connectivity and streaming (SSE) capabilities.
  - Basic Agent Invoke interface.
- **Sprint 2: The "Hands" (Tool Integration)**
  - Implement MCP Adapters.
  - Build the Tools registry and enable dynamic tool calling from the Agent Invoke playground.
- **Sprint 3: The "Canvas" (Agent Creator)**
  - Develop the Agent Creator interface.
  - Implement intelligent field autofill and configuration saving.
- **Sprint 4: Ecosystem & Collaboration (Bonus)**
  - Feature Sharing (sharing agents/threads with other users).
  - UI Polish and Markdown/Table rendering enhancements.

### Timeline

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f8fafc', 'primaryTextColor': '#0f172a', 'primaryBorderColor': '#3b82f6', 'lineColor': '#94a3b8', 'titleColor': '#f8fafc'}}}%%
gantt
    title Amadeus Development Timeline
    dateFormat  YYYY-MM-DD
    
    section Phase 1 (Core)
    Agent Invoke & Streaming   :done,    p1, 2026-07-01, 14d
    
    section Phase 2 (Tools)
    MCP & Tools Registry       :active,  p2, 2026-07-15, 14d
    
    section Phase 3 (Creator)
    Agent Creator UI & Autofill:         p3, 2026-07-29, 14d
    
    section Phase 4 (Polish)
    Feature Sharing & UI Polish:         p4, 2026-08-12, 14d
```

---

## D. Deploy -> Test, Proof-of-Concept, Piloting Usecases

### Where we lie in the current condition?
We sit exactly at the bridge between **unstructured conversational AI** (like standard ChatGPT) and **rigid robotic process automation** (like legacy RPA). Amadeus provides the reasoning of the former with the deterministic execution of the latter.

### Piloting Usecase Examples

**Automated CX100 Danantara Survey Loop**
- **Scenario**: End-to-end automation of the Danantara survey and queue transaction process via the CX100 legacy application.
- **Execution**: The Agent (Brain) is configured with the *Danantara Survey Loop* recipe. It autonomously orchestrates a multi-step deterministic workflow: it triggers the initial `Danantara_LoginFlow` via RPA, waits for verification (OTP/Login resolution), and executes the transaction ("Buka aplikasi CX100, buat transaksi baru dengan nomor antrian berikutnya, lalu tutup"). This proves Amadeus's ability to wrap rigid, multi-stage legacy RPA scripts inside a resilient, state-aware agentic loop without losing track of context.
