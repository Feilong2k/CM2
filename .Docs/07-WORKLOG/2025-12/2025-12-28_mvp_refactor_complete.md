# Worklog: 2025-12-28 (Orion MVP Refactor & DeepSeek Reasoner Alignment)

## 1. Overview
Today we completed a major refactor to align the Orion MVP with the ADR "De-Scoping Two-Stage Protocol from MVP". The core goal was to establish **StandardProtocol + DeepSeek Reasoner** as the primary execution path, while retaining **TwoStageProtocol** as a gated, future-facing feature.

This work covered the entire backend stack: adapters, protocols, agents, tools, routes, and comprehensive trace observability.

## 2. Key Accomplishments

### A. DeepSeek Reasoner Integration (Checklist #2)
- Implemented **`DS_ReasonerAdapter`**:
  - Specialized adapter for `deepseek-reasoner`.
  - Supports streaming `reasoning_content` (chain-of-thought) alongside standard content.
  - Handles model-specific parameters (e.g., temperature overrides).
- Updated `AdapterFactory` to select `DS_ReasonerAdapter` when `ORION_MODEL_PROVIDER=DeepSeek`.

### B. Protocol & Agent Realignment (Checklist #3 & #4)
- **StandardProtocol (Primary):**
  - Updated to handle streaming reasoning + content.
  - Integrated with **ToolRunner** for tool execution (single cycle for now).
  - Logs rich trace events (`llm_call`, `orion_response`) including full reasoning.
- **OrionAgentV2:**
  - Simplified constructor to default to StandardProtocol.
  - Dynamic temperature selection: `1.3` for Plan Mode (Standard), `0.0` for Act Mode (Standard/Tools).
- **TwoStageProtocol (Gated):**
  - Preserved but moved behind `TWO_STAGE_ENABLED` flag.
  - Aligned event types with the standard contract.

### C. Tooling Robustness (Checklist #5)
- Validated **ToolRunner** logic:
  - Per-request duplicate blocking (soft-stop).
  - Correct `context` propagation (`projectId`, `requestId`, `turnIndex`).
  - Trace logging for `tool_call` / `tool_result`.
- Confirmed **DatabaseToolAgentAdapter** works correctly for core MVP tools (`create_task`, `create_subtask`, `get_feature_overview`, etc.).

### D. Routes & Trace Observability (Checklist #6)
- **Chat Route (`/api/chat/messages`):**
  - Protocol gating: uses StandardProtocol by default, TwoStage only if configured.
  - **Trace Enhancement (TRACE-004):** Now logs `user_message` events for every request.
- **Trace Persistence:**
  - `trace_events` table now captures:
    - `reasoning` in `details` (for Reasoner).
    - `turn` index (per-request numbering) for `llm_call`, `orion_response`, and tool events.
  - **TRACE-005:** StandardProtocol logs both `llm_call` and `orion_response` for explicit trace visibility.
  - **TRACE-006/007:** Turn numbering implemented for both protocols (Standard = turn 1; TwoStage = turn N based on cycle index).

### E. Verification & Legacy Cleanup (Checklist #7 & #8)
- **Testing:**
  - Added comprehensive tests for `DS_ReasonerAdapter`, `StandardProtocol`, `OrionAgentV2`, routes, and trace logic.
  - All `PROTO-`, `TOOL-`, and `TRACE-` series tests are green.
- **Probes:**
  - Created `probe_orion_standard_protocol.js`: verified end-to-end StandardProtocol + Reasoner flow.
  - Created `probe_db_tools.js`: diagnostic probe that revealed some missing DB tool implementations (documented as future work).
- **Legacy Cleanup:**
  - Confirmed all v1 agents (`OrionAgent.js`, `BaseAgent.js`) are archived.
  - No legacy code remains in the active `backend/src` path.

## 3. Current Architecture State

- **Default Path:** `OrionAgentV2` → `StandardProtocol` → `DS_ReasonerAdapter` (DeepSeek Reasoner).
- **Trace:** Always-on, DB-backed, with per-request turn numbering (`turn 1`, `turn 2`...) covering user messages, LLM calls, tools, and final responses.
- **Tools:** Centralized via `ToolRunner` + `functionDefinitions.js`, supporting both FileSystem and Database capabilities.

## 4. Next Steps (Post-Refactor)

1. **ContextService Extraction:** Centralize context building (system prompt, chat history, docs) into a dedicated service.
2. **Skills / StateMachine:** Formalize "Skills" (layered markdown workflows) and an orchestrator to drive multi-step agent tasks.
3. **Database Tool Completeness:** Implement missing adapter methods for advanced DB tools (e.g. `list_subtasks_for_task`) or trim definitions to match MVP.
