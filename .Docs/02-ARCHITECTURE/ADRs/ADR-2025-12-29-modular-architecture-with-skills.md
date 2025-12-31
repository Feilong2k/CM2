# ADR-2025-12-29: Modular Architecture with Agent Skills

## Status
**Proposed** – Awaiting review and approval

## Context
After a fresh start from the previous Orion implementation, we have a working core consisting of:
- **DeepSeek Reasoner API** integration via direct `fetch` calls (proven in `probe_fs_tools.js`)
- **ToolRunner** with function definitions and a clean tool execution pipeline
- **FileSystemTool**, **DatabaseTool**, and other modular tools that are already isolated and reusable
- **TraceService** (mocked for probes) for observability

The previous architecture suffered from:
1. **Over‑abstraction**: Multiple protocol layers (StandardProtocol, TwoStageProtocol) that obscured failures
2. **Poor observability**: Tool execution was not visible in the UI, leading to “hallucinated” tool results
3. **Tight coupling**: Adapters were heavy and difficult to extend for multiple models

We now have an opportunity to rebuild with a strict modular, skill‑based approach that aligns with the team’s long‑term vision.

## Decision
We will design the new Orion around the following principles:

### 1. **Modular Adapters**
- `DS_ReasonerAdapter.js` will be kept **lightweight** and focused solely on converting between the DeepSeek API format and our internal message/tool‑call format.
- All tool‑calling logic, retry logic, and conversation state management will be extracted into separate modules (e.g., `ToolOrchestrator`, `ConversationManager`) that can be used by any adapter (future Gemini, OpenAI, etc.).

### 2. **Modular Tools**
- Continue the existing pattern: each tool is a self‑contained module with a clear interface (e.g., `FileSystemTool.js`, `DatabaseTool.js`).
- Tools are registered in a central `toolRegistry` and are exposed to the agent via `functionDefinitions.js`.
- **No tool‑specific logic in the adapter** – the adapter only knows how to pass tool calls to the `ToolRunner`.

### 3. **OrionAgent as a Thin Coordinator**
- `OrionAgent.js` will be the main entry point that:
  - Loads the appropriate adapter based on configuration.
  - Loads the required skills (see below) for the current task.
  - Coordinates the multi‑turn loop (Think → Tool → Result → Answer) using the adapter and `ToolRunner`.
  - Emits trace events for every significant step.

### 4. **Agent Skills (Anthropic‑style)**
- A **Skill** is a directory containing:
  - `SKILL.md` – YAML frontmatter (name, description) + detailed operating instructions.
  - `/scripts` – Optional executable scripts (Python/JavaScript) for deterministic operations.
  - `/references` – Reference files, templates, or static assets.
- Skills are **progressively loaded**:
  1. Orion initially loads only skill names and descriptions.
  2. When a task matches a skill’s description, the full `SKILL.md` and necessary scripts are loaded.
  3. Skills can be activated/deactivated per‑task to keep the context window small.
- **Initial skills for Orion**:
  - `file_operations` – Wraps FileSystemTool with higher‑level procedures (e.g., “scaffold a Vue component”).
  - `database_operations` – Wraps DatabaseTool with common queries (e.g., “get all open tasks for project X”).
  - `code_review` – Steps for reviewing a single file (using Aider‑based sub‑agents).

### 5. **Integration with Aider‑based Sub‑agents**
- For implementation (Devon) and testing (Tara) tasks, Orion will **delegate to specialized sub‑agents** (TaraAider, DevonAider).
- Each sub‑agent is invoked via a skill that:
  - Breaks the subtask into **single‑file changes**.
  - Provides **all necessary context** (file content, requirements, acceptance criteria) in the prompt.
  - Uses Aider’s editing capabilities to make the change.
- Orion’s role is to **orchestrate** these sub‑agents, not to write code or tests directly.

## Consequences

### Positive
- **Clear separation of concerns**: Each component has a single responsibility.
- **Easier testing**: Isolated modules can be unit‑tested; integration tests can run the full loop with a probe.
- **Extensibility**: Adding a new model (Gemini, OpenAI) requires only a new lightweight adapter.
- **Observability**: Every tool call, skill activation, and agent decision will be traceable in the UI.
- **Scalability**: Skills can be developed independently and shared across projects.

### Negative
- **Initial overhead**: Designing the skill system and adapter interface will take more upfront time than a monolithic approach.
- **Coordination complexity**: Managing skill loading and sub‑agent handoffs adds new failure modes.
- **Documentation burden**: Each skill must be well‑documented in `SKILL.md` to be effective.

### Risks
- **Skill proliferation**: Without discipline, the number of skills could grow and become unmanageable.
- **Context‑window bloat**: If skills are not progressively loaded carefully, the token count may become excessive.
- **Sub‑agent reliability**: The Aider‑based sub‑agents must be prompted precisely to avoid mis‑edits.

## Alternatives Considered

### Alternative A: Monolithic Agent
- A single large OrionAgent that contains all logic, prompts, and tool‑calling code.
- **Rejected** because it would repeat the mistakes of the previous architecture (hard to debug, hard to extend).

### Alternative B: Plugin‑based Tools Only (No Skills)
- Keep the current tool system but avoid the skill abstraction.
- **Rejected** because skills provide a structured way to package **procedural knowledge** (not just tool calls) and are essential for the Aider‑sub‑agent workflow.

## Implementation Plan (High‑Level)

1. **Phase 1 – Core Modularity** (MVP)
   - Refactor `DS_ReasonerAdapter.js` to be minimal.
   - Create `ToolOrchestrator` and `ConversationManager` modules.
   - Write integration tests that verify the full loop with the existing tools.

2. **Phase 2 – Skill System**
   - Define the skill directory structure and loading mechanism.
   - Implement 2‑3 example skills (file_operations, database_operations).
   - Update OrionAgent to load skills dynamically.

3. **Phase 3 – Aider Sub‑agents**
   - Create prompts for TaraAider and DevonAider.
   - Build skills that delegate single‑file changes to these sub‑agents.
   - Test end‑to‑end with a real task (e.g., “add a new API endpoint”).

4. **Phase 4 – UI Integration**
   - Expose the new OrionAgent via a REST endpoint.
   - Stream progress and trace events to the frontend.
   - Ensure the UI shows tool calls, skill activations, and sub‑agent steps in real time.

## Notes
- This ADR will be considered **approved** after review by the team.
- All subsequent implementation tasks (for Devon and Tara) must reference this ADR and adhere to its decisions.
- The worklog (`.Docs/07‑WORKLOG/2025‑12/2025‑12‑29_tool_trace_gap.md`) has been updated to reflect the fresh start and the decisions captured here.

## References
- TransferPlan.md (in 00‑INBOX) – outlines the proven components to carry forward.
- Anthropic Agent Skills documentation (summarized in the user’s feedback).
- Existing probe (`probe_fs_tools.js`) that demonstrates the working core.
