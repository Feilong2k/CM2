# Worklog – Orion CLI Review & Conversation CLI Plan

**Date:** 2025‑12‑30 (late night into 2025‑12‑31)  
**Agent:** Adam (Architect)  
**Goal:** Understand why `bin/orion-cli.js` calls tools on simple greetings like “hi”, and design a separate CLI that uses `OrionAgent` with its default prompt to observe conversational behavior.

---

## 1. Current State

### 1.1 Orion CLI Behavior
- Running `node bin/orion-cli.js` and typing `hi orion` triggers:
  - `[TraceService Mock] tool_call Tool call: FileSystemTool.list_files`
  - `Tool execution error in retry loop: Error: Tool "FileSystemTool_list_files" execution failed: path is required`
  - Repeated retries, then `[TOOL_CALL] unknown` / `[TOOL_RESULT] failure`
  - CLI exits.

- The CLI is wired to:
  - Instantiate `OrionAgent` with `FileSystemTool` registry.
  - Use `OrionAgent`’s default system prompt (currently a short Orion‑orchestrator‑style prompt with no mention of tools).
  - Pass a `traceEmitter` that prints events.

- The model still decides to call `FileSystemTool.list_files` even on a greeting, despite the prompt not mentioning tools.

### 1.2 OrionAgent Default Prompt
From `backend/src/agents/OrionAgent.js`:

```js
_getDefaultSystemPrompt() {
  return `
You are Orion, the Orchestrator for the CodeMaestro TDD team. ou design systems, break down features into tasks, and you coordinate agents (Devon=Dev, Tara=Test) to deliver subtasks safely.
`.trim();
}
```

This prompt is **not** filesystem‑oriented and contains **no tool‑related instructions**. Yet the model still calls tools because:
- The tool registry is present (`FileSystemTool`).
- The model is trained to use available tools when uncertain.
- No explicit guardrails in the prompt forbid tool calls for greetings.

### 1.3 TraceService Mock
The `[TraceService Mock]` lines come from `backend/tools/ToolRunner.js`:

```js
let TraceService = null;
try {
  TraceService = require('../src/services/trace/TraceService');
} catch (e) {
  // Mock TraceService for probes when not available
  TraceService = {
    logEvent: async (event) => {
      console.log('[TraceService Mock]', event.type, event.summary || '');
    }
  };
}
```

This is a fallback because the real `TraceService` module doesn’t exist yet. It’s not an error, just noise.

---

## 2. User’s Request

The user wants:
- A CLI that uses `OrionAgent` (so we test that class).
- Uses the **default prompt** from `OrionAgent.js` (no custom prompt in the CLI).
- Still shows trace output.
- Lets them type `hi` and get a greeting back, without tool calls.
- Stays open until they quit.

They explicitly **do not** want:
- A separate “dumb” CLI that doesn’t use `OrionAgent`.
- A CLI with its own custom prompt.

---

## 3. Assumptions Made & Corrections

During earlier analysis, I made several assumptions that the user corrected:

1. **Assumed a separate, dumb hello CLI was useful**  
   - I proposed `hello-cli.js` that didn’t use `OrionAgent`.  
   - This contradicted the goal of testing `OrionAgent.js`.

2. **Assumed a per‑CLI custom prompt would be acceptable**  
   - I designed a CLI that passed a `systemPrompt` override.  
   - The user wants to use the prompt **as defined in `OrionAgent.js`**, not a custom one in the CLI. So that assumption was wrong for your use case.

3. **Speculated about `probe_fs_tools.js` behavior without validating**  
   - I inferred it might use a different prompt or wiring, without re‑reading the file in this session.  
   - That was a speculative leap; I should have either inspected it properly or explicitly labelled it as an unverified hypothesis.

4. **Implied prompt changes alone would reliably stop tool calls**  
   - I suggested stronger instructions would likely reduce spurious tool calls.  
   - Should have framed this more cautiously: “this *may* help, but the model can still ignore it.”

If you’d like, I can now write a very tight Devon spec specifically for:

- A new CLI that:

  - Uses `OrionAgent` with __no `systemPrompt` override__ (only `_getDefaultSystemPrompt()`).
  - Still wires a `traceEmitter` so you see trace.
  - Minimizes or ignores tool execution so you can focus on how that default prompt behaves on simple “hi” style inputs.

But I’ll wait for you to confirm that’s what you want, rather than assume again.

User: go ahead and create the prompt

Adam: [Provided the Devon implementation prompt for the new OrionAgent conversation CLI]
```

## 7. Rollback and Rebuild Decision (2025-12-31)

**Issue:**
- We discovered that `OrionAgent.js` (using `ToolOrchestrator` + `DS_ReasonerAdapter` + Streaming) behaved fundamentally differently than the simple `probe_fs_tools.js` (using direct fetch + non-streaming).
- The CLI was failing on "hi" because `OrionAgent`'s generic prompt + tool definitions led the model to hallucinate a `list_files({})` call with no arguments, while the probe succeeded because it had a specific task string.
- This misalignment meant `OrionAgent` was not a faithful implementation of the capabilities proven by the probe.

**Action:**
- **Rollback:** We deleted all backend code created post-probe (OrionAgent, ToolOrchestrator, DS_ReasonerAdapter, CLI files, and all related prompts/tests).
- **Reset:** We are back to a clean state where only `backend/tools/*` and `backend/scripts/probes/*` exist.
- **New Strategy:** "Probe-First TDD".
  - We will rebuild the system piece-by-piece.
  - For **each** new unit (Adapter, Orchestrator, Agent), we must write a **Probe** first that exercises that specific unit.
  - We will verify the probe passes before writing the actual implementation code for that unit.

**Next Step:**
- Create `probe_ds_adapter.js` (Test) for `DS_ReasonerAdapter` (Implementation).
- Create Devon prompt for `DS_ReasonerAdapter`.
- Git commit the clean slate.

## 8. Probe-First Rebuild Execution (2025-12-31)

### Phase 1.1 Step 1: DS_ReasonerAdapter
- **Created Probe:** `backend/scripts/probes/probe_ds_adapter.js`.
- **Created Implementation:** `backend/src/adapters/DS_ReasonerAdapter.js` (using native fetch, streaming, SSE parsing).
- **Verified:** Ran the probe. It successfully connected to DeepSeek and streamed chunks ("Hi").
- **Status:** **DONE**.

### Phase 1.1 Step 2: ToolOrchestrator
- **Created Probe:** `backend/scripts/probes/probe_fs_tools_orchestrator.js`.
  - Simulates a multi-step task ("Create a file... then read it back").
  - Mocks the "Brain" using the new Adapter.
- **Created Implementation:** `backend/src/orchestration/ToolOrchestrator.js`.
  - Implements the loop (maxTurns).
  - Handles streaming response aggregation.
  - Merges split tool call chunks.
  - Executes tools via `ToolRunner`.
- **Verified:** Ran the probe.
  - Trace output confirmed successful tool execution (write then read).
  - Model provided a final answer confirming the file content.
- **Status:** **DONE**.

### Phase 1.1 Step 3: OrionAgent
- **Created Probe:** `backend/scripts/probes/probe_orion_agent.js`.
  - Tests 3 scenarios: Greeting (no tools), Simple Task (tool), Multi-step (tools + orchestration).
- **Created Implementation:** `backend/src/agents/OrionAgent.js`.
  - Composes Adapter + Orchestrator.
  - Uses a new default prompt: "If request can be answered... conversationally, do NOT call tools."
  - Explicitly filters tools based on registry keys.
- **Verified:** Ran the probe.
  - "Hi" -> No tool calls (Fixed the original issue!).
  - "List files" -> Tool call (Success).
  - "Create/Read/Delete" -> Tool calls (Success + graceful handling of missing delete tool).
- **Status:** **DONE**.

### Phase 1.1 Step 4: Orion CLI
- **Created Probe:** `backend/scripts/probes/probe_interactive_cli.js`.
- **Created Implementation:** `bin/orion-cli.js`.
  - Interactive `readline` loop.
  - Streaming output.
  - Trace logging.
- **Verified:** Probe confirmed CLI instantiation and input handling logic.
- **Status:** **DONE**.

**Conclusion:**
We have successfully rebuilt the entire backend stack (Adapter -> Orchestrator -> Agent -> CLI) using strict TDD/Probe-First methodology. The original issue (crashing on "Hi") is resolved, and we have a suite of probes validating each layer.
