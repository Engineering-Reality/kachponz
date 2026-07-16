# Amadeus Platform: 4D Lifecycle
<img width="1920" height="1080" alt="Image" src="https://github.com/user-attachments/assets/fd2c7f01-3263-4161-9876-cbfee01d21e9" />
Amadeus is an orchestration platform designed to seamlessly integrate intelligent Agentic capabilities with deterministic tools and external APIs. This document outlines the project's journey through the 4D Lifecycle: Discover, Design, Develop, and Deploy.

---

## A. Discover -> Problem & Solution

### Why we need this? (The Philosophy)
**Human. AI Agent. Robot.**

**Humans** want automation, but humans also demand compliance.  
**AI Agents** want to automate. They connect to applications via MCP (Model Context Protocol), which requires an API Key. But not all applications have API keys available due to compliance restrictions. This results in *high automation, less compliance, and restricted access.*  
**Robots** want to automate too, but within compliance. They connect to applications via UI without API keys. This results in *high compliance, less automation*. But robots cannot talk to each other, nor can they talk to humans.

This creates disorganization between automated business processes. Where humans are fully replaced by AI, *wallahi we’re doomed.* AI doesn’t fix a disorganized company—it turns your disorganization into a system.

### The Data-Driven Reality
**Your roadmap to enterprise-ready APA.**

> 📊 *“More than 90% of so-called ‘agentic’ AI solutions are simply repackaged generative AI layered atop legacy systems, with only around 130 vendors among thousands actually delivering genuine agent-driven orchestration, according to Gartner.”*

**A Practical Playbook for Enterprise-Ready Automation**
- **Ask Yourself:** Are you Solving Problems or Just Chasing AI?
- **Assess:** How to Define an APA Maturity Model.
- **Execute:** How to Make Your Business Case for APA Investment.

While competitors struggle to bridge the gap, enterprise architects recognize the need for mature orchestration. As Venkata K., Solution Architect at CMG Mortgage, Inc., noted:
> 🗣️ *"We also explored Microsoft’s Power Automate. However, it wasn’t as mature or up to enterprise level at the time. Automation Anywhere had good standards and excellent support, in terms of architecture, design, and user interface, we chose Automation Anywhere. It also has good community support."*

The industry demands the maturity and stability of legacy RPA, combined with genuine agentic intelligence.

### What we gonna do? (The Solution: Amadeus)
**Humans Whoops. Agents Loop. Robots Shoot.**

Prompt Engineering is Outdated. Welcome to the **Loop Era**. Talk once, let agents decide. Enterprise-grade critical tasks are executed by Robots and orchestrated by AI Agents.

So, **RPA + Agents = APA (Agentic Process Automation)**.

We are building **Amadeus**, a central orchestration platform bridging this exact gap through:
1. **Agent Creator**: Allowing users to seamlessly design and configure intelligent agents.
2. **Tools Registry**: A centralized hub to register and manage capabilities (APIs, scripts).
3. **Agent Invoke**: A dynamic playground where agents can be summoned to execute tasks by reasoning and utilizing the attached tools.

### Objective Benchmark: Amadeus APA vs. Traditional RPA (e.g., Automation Anywhere)
*Playing devil's advocate: Where do we shine, and where do we fall short?*

| Feature / Aspect | 🤖 Traditional RPA (Automation Anywhere) | 🧠 Amadeus APA (Agentic Process Automation) |
| :--- | :--- | :--- |
| **Core Paradigm** | **Deterministic & Rules-Based.** Strict step-by-step logic. AI is treated as an add-on (Copilot). | **AI-Native & Intent-Based.** Agents reason the best path to execute deterministic tools. |
| **Development Speed** | **Slow.** Requires specialized RPA developers, rigid scripting, and complex UI mapping. | **Fast.** "Talk once, let agents decide." Natural language configuration via Agent Creator. |
| **Handling Unstructured Data** | **Rigid.** Relies on specialized document templates (IQ Bot). Fails when formats change. | **Highly Flexible.** LLMs natively understand context, parsing messy data seamlessly. |
| **Predictability & Compliance** | 🥇 **Superior.** 100% deterministic execution. Extremely robust audit trails; enterprise compliance is built-in. | ⚠️ **Challenging.** Agents can hallucinate or take unpredictable paths. Compliance relies heavily on strictly defined MCP limits. |
| **Integration Ecosystem** | 🥇 **Superior.** Decades of mature, enterprise-certified connectors (SAP, Oracle, Mainframes). | ⚠️ **Developing.** Highly extensible via MCP, but currently lacks the massive library of legacy system connectors. |

**Verdict:** Amadeus is not here to replace Automation Anywhere. We are here to **orchestrate** it. Amadeus acts as the intelligent "Brain" that can call existing RPA bots as its "Hands" via MCP, turning rigid automation into an adaptive, intelligent system.

### Detailed Agent Invoke & Orchestration Flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#F3E8FF', 'primaryTextColor': '#1E1B4B', 'primaryBorderColor': '#D946EF', 'lineColor': '#3B82F6', 'noteBkgColor': '#FCE7F3', 'noteTextColor': '#1E1B4B', 'actorBkg': '#E0E7FF', 'actorTextColor': '#1E1B4B', 'signalColor': '#D946EF'}}}%%
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
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#F3E8FF', 'primaryTextColor': '#1E1B4B', 'primaryBorderColor': '#D946EF', 'lineColor': '#3B82F6', 'clusterBkg': '#E0F2FE', 'clusterBorder': '#3B82F6'}}}%%
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
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#F3E8FF', 'primaryTextColor': '#1E1B4B', 'primaryBorderColor': '#D946EF', 'lineColor': '#3B82F6', 'clusterBkg': '#E0F2FE', 'clusterBorder': '#3B82F6'}}}%%
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

    subgraph NetraCloud [Netra Private AI Cloud: Localized LLM Inference]
        direction TB
        subgraph EdgeLayer [Edge + Router Layer]
            NetraAPI[OpenAI-Compatible API]
            KVRouter[KV-Aware Router]
            NetraAPI --> KVRouter
        end

        subgraph DisaggregatedInference [Disaggregated Inference Architecture]
            direction LR
            subgraph Node0 [Node 0 - HGX H100 8-GPU]
                Prefill[Prefill GPUs: Qwen Context Processing]
                NVLink0((NVLink All-to-All))
                Prefill <--> NVLink0
            end
            
            subgraph Node1 [Node 1 - HGX H100 8-GPU]
                Decode[Decode GPUs: Qwen Auto-Regressive Generation]
                NVLink1((NVLink All-to-All))
                Decode <--> NVLink1
            end
            
            Node0 <-->|RDMA / InfiniBand: Cross-Node KV Transfer| Node1
        end

        subgraph KVCache [KV Cache Hierarchy]
            L1[L1: GPU HBM - Hot]
            L2[L2: Host DRAM + NVMe - Warm]
            L3[L3: Shared/Distributed Storage - Cold]
            L1 <--> L2 <--> L3
        end
        
        KVRouter -->|Assigns requests based on prefix affinity| Node0
        Node0 --> KVCache
        Node1 --> KVCache
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

    %% Amadeus to Netra LLM Connection
    CR_DC <-->|HTTPS REST: Invokes Qwen Model| NetraAPI
    CR_DRC <-->|HTTPS REST: Invokes Qwen Model| NetraAPI

    %% Agents to Internal Tools
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
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#F3E8FF', 'primaryTextColor': '#1E1B4B', 'primaryBorderColor': '#D946EF', 'lineColor': '#3B82F6', 'titleColor': '#D946EF'}}}%%
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
