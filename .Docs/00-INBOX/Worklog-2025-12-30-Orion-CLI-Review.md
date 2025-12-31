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

---

## 4. Plan: New OrionAgent Conversation CLI

We will create a **new CLI entry point** that:

- Uses `OrionAgent` with its **default prompt** (no `systemPrompt` override).
- Still wires a `traceEmitter` so trace events are visible.
- Runs an interactive REPL that:
  - Starts with `agent.systemPrompt` as the system message.
  - Accepts user input, calls `OrionAgent` (streaming), aggregates assistant content.
  - Prints assistant response after each turn.
  - Stays open until `exit`/`quit` or Ctrl+C.

This CLI is **not** about changing how tools work; it’s about observing `OrionAgent`’s behavior with its current prompt and tool registry.

### 4.1 Implementation Details for Devon

**File:** `bin/orion-agent-convo-cli.js`

**Key points:**
- Import `OrionAgent` from `backend/src/agents/OrionAgent.js`.
- Construct agent **without** `systemPrompt` option:
  ```js
  const agent = new OrionAgent({
    toolRegistry: { /* same as main CLI or minimal stub */ },
    orchestratorOptions: {
      maxTurns: 10,
      traceEmitter
    }
  });
  ```
- Conversation memory starts with:
  ```js
  let messages = [
    { role: 'system', content: agent.systemPrompt }
  ];
  ```
- Implement `createTraceEmitter(debug)` similar to `bin/orion-cli.js`.
- Use `readline` for REPL loop.
- On each user input:
  - Append user message to `messages`.
  - Call `agent.orchestrator.run(messages, tools)` (or `agent.processTaskStreaming()`).
  - Aggregate assistant `content` from streaming chunks.
  - Print assistant response.
  - Append assistant message back to `messages`.

**Scope constraints:**
- Do **not** modify `backend/src/agents/OrionAgent.js`.
- Do **not** modify `backend/src/orchestration/ToolOrchestrator.js`.
- Do **not** modify `bin/orion-cli.js`.
- Focus only on adding the new CLI file and wiring.

### 4.2 Acceptance Criteria

- `node bin/orion-agent-convo-cli.js` starts an interactive REPL with a short banner.
- The CLI:
  - Imports and uses `OrionAgent`.
  - Does **not** pass a `systemPrompt` override.
  - Uses `agent.systemPrompt` as the system message.
  - Passes a `traceEmitter` into `orchestratorOptions`.
- When typing `hi` or `hi orion`:
  - I see trace output (at least `[LLM_CALL]` and possibly other events).
  - I see Orion’s natural‑language response printed once.
- The CLI remains open until `exit`/`quit` or Ctrl+C.

---

## 5. Next Steps

1. **Devon** implements `bin/orion-agent-convo-cli.js` as described in `.Docs/00-INBOX/DevonPrompt-OrionAgent-Conversation-CLI.md`.
2. **User** tests the new CLI:
   - Does it greet back on `hi`?
   - Does it still show trace?
   - Does it stay open?
3. **Adam** can then analyze the results and propose any adjustments to the default prompt or tool‑calling behavior if needed.

---

## 6. Conversation Log (User → Adam)

Below is the exact conversation that led to this plan:

```
User: I don't want it's own custom prompt, I wan to use the prompt in OrinoAgent.js, what other assumptions did you make randomly?

Adam: You’re right to push on this; let me be precise and also own the assumptions I made.

## 1. Using the prompt in `OrionAgent.js`

Given your current `OrionAgent`:

```js
this.systemPrompt = options.systemPrompt || this._getDefaultSystemPrompt();
```

If you want the new CLI to __use exactly the prompt defined in `_getDefaultSystemPrompt()`__, then for that CLI:

- __Do not pass `systemPrompt`__ when constructing `OrionAgent`.
- Just do something like:

```js
const agent = new OrionAgent({
  toolRegistry: { /* whatever Devon wires here */ },
  orchestratorOptions: {
    maxTurns: 10,
    traceEmitter
  }
});
```

In that case:

- `agent.systemPrompt` is __whatever is currently in `_getDefaultSystemPrompt()`__.
- The CLI’s conversation memory can start with:

```js
let messages = [
  { role: 'system', content: agent.systemPrompt }
];
```

Exactly like your existing `bin/orion-cli.js` already does.

So: for the “OrionAgent conversation CLI” I described, the correction to the Devon prompt is:

- __Remove__ any `systemPrompt: ...` override.
- Explicitly __rely on `OrionAgent`’s default__ by omitting that option.

Everything else (REPL, trace, etc.) can stay the same idea, but the prompt source is now strictly `OrionAgent.js`.

## 2. Assumptions I made that you didn’t ask for

You also asked what other assumptions I made “randomly”. Concretely:

1. __Assumed a separate, dumb hello CLI was useful__

   - I initially proposed a `hello-cli.js` that didn’t use `OrionAgent` at all.
   - That contradicted your stated goal (you want to test `OrionAgent.js`), so that was misaligned.

2. __Assumed you’d accept a per-CLI custom prompt__

   - I then designed a CLI that passed a `systemPrompt` override into `OrionAgent`.
   - You’ve now made it clear you want to use the prompt *as defined in `OrionAgent.js`*, not a custom one in the CLI. So that assumption was wrong for your use case.

3. __Speculated about why `probe_fs_tools.js` behaves differently without fully validating it__

   - I inferred that it might be using a different prompt or wiring without first re-reading that file in this session (the parallel tool call for it got blocked).
   - That’s a speculative leap; I should have either inspected it properly or explicitly labelled it as an unverified hypothesis.

4. __Implied that prompt changes alone would reliably stop tool calls__

   - I suggested that stronger instructions in the prompt would likely reduce spurious tool calls, which is generally true directionally, but I spoke too confidently given we’re working against an LLM’s learned behavior and you’re seeing it ignore constraints.
   - That should have been framed more cautiously as: “this *may* help, but the model can still ignore it.”

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

We now have a working Adapter and a working Orchestrator, both verified by dedicated probes.

**Next:** Implement `OrionAgent.js`.
