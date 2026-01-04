# Feature: No-Tools-Used Tool Guard

**Goal:** Prevent Orion from getting stuck when DeepSeek (or any model) responds with text-only answers instead of using tools.

---

## 1. Problem & Motivation

### Observed Issue
- DeepSeek sometimes "forgets" to use tools and responds with plain text (e.g., "I'll list the files now…").
- Without a guard, the agent loop would treat this as a valid response and continue, leading to:
  - **Timeouts** (waiting for a tool that never arrives).
  - **Infinite loops** (model keeps chatting without acting).
  - **User frustration** (agent appears broken).

### Root Cause
- DeepSeek (and other models) can produce **text-only responses** even when the system prompt explicitly demands tool usage.
- The agent must **detect** this condition and **force** the model back on track.

### Cline’s Solution
Cline implements a **No-Tools-Used Guard** that:
1. **Detects** when the assistant message contains **no `tool_use` blocks**.
2. **Injects** a corrective user message: "You didn't use any tools. You MUST either call a tool (e.g., read_file, list_files, execute_command, etc.) or explicitly call attempt_completion if the task is done."
3. **Retries** the loop with this new message.
4. **Counts** consecutive mistakes; after a limit (e.g., 3), it escalates to the user.

This pattern eliminates the "forgotten tool call" problem and dramatically improves reliability.

---

## 2. Behavior Specification

### Detection Logic
- After each API response, parse the assistant message into content blocks.
- Check if **any block** has `type === "tool_use"` (native tool calls) or equivalent for chat-based tool schemas.
- If **no tool_use blocks** are present → trigger the guard.

### Guard Action
1. **Increment** `consecutiveMistakeCount`.
2. **Push** a corrective user message to the conversation history.
3. **Continue** the loop (call the API again with the updated history).

### Mistake Limit
- Default limit: **3 consecutive mistakes**.
- When limit reached:
  - **Stop** the automatic loop.
  - **Notify** the user (via UI) that the model is stuck.
  - **Ask** the user whether to:
    - Continue anyway (reset counter).
    - Switch models.
    - Adjust instructions.

---

## 3. Integration Points in CodeMaestro

### Primary Location: `OrionAgent.js`
- The agent’s main loop (`runTask` or `processStep`) should call a helper `checkForMissingTools()` after receiving the model response.
- If missing, call `handleMissingTools()` which:
  - Updates mistake counter.
  - Builds corrective message.
  - Returns `true` to indicate "retry with new user message".

### Secondary Location: `ToolOrchestrator.js`
- Could also be placed in the orchestrator’s `executeStep` method.
- Advantage: Centralized tool‑call validation.
- Disadvantage: Might be too low‑level; the agent should own the loop logic.

### Data Structures
- **`consecutiveMistakeCount`** stored in the agent’s state (or in the task’s DB record).
- **Corrective message templates** defined in a constants file.

---

## 4. Implementation Pseudocode

```javascript
// In OrionAgent.js
async function processStep(conversationHistory) {
  const response = await callModel(conversationHistory);
  const assistantBlocks = parseResponse(response);

  const hasToolUse = assistantBlocks.some(block => block.type === 'tool_use');
  
  if (!hasToolUse) {
    // Guard triggered
    this.state.consecutiveMistakeCount++;
    
    if (this.state.consecutiveMistakeCount >= MISTAKE_LIMIT) {
      await this.escalateToUser();
      return; // Stop loop
    }
    
    // Add corrective message
    conversationHistory.push({
      role: 'user',
      content: NO_TOOLS_USED_MESSAGE
    });
    
    // Retry with updated history
    return await this.processStep(conversationHistory);
  }
  
  // Reset mistake counter on successful tool use
  this.state.consecutiveMistakeCount = 0;
  
  // Proceed with tool execution
  await this.executeTools(assistantBlocks);
}
```

---

## 5. Configuration & Tuning

### Environment Variables / Settings
- `NO_TOOLS_GUARD_ENABLED`: boolean (default `true`).
- `MISTAKE_LIMIT`: number (default `3`).
- `NO_TOOLS_MESSAGE`: string (customizable).

### Model‑Specific Adjustments
- Some models (e.g., GPT‑5) rarely forget tools; guard could be disabled.
- For DeepSeek, keep guard **always on**.

### UX Considerations
- When guard triggers, log a **warning** to the console (or UI) so the user knows the model was corrected.
- At mistake limit, show a **clear alert** with options.

---

## 6. Testing Strategy

### Unit Tests
- Test `checkForMissingTools` with various assistant block structures.
- Test mistake‑counter increment/reset logic.
- Test escalation at limit.

### Integration Tests
- Simulate a DeepSeek text‑only response in a probe.
- Verify that the guard injects the corrective message and the loop continues.
- Verify that after 3 mistakes, the agent stops and notifies the user.

### Probe Design
- Create a probe that sends a prompt like "What’s in the current directory?" and expects a `list_files` tool call.
- If the model responds with text, the guard should catch it and force a retry.
- Measure success rate before/after guard implementation.

---

## 7. Next Steps

1. **Implement** the guard in `OrionAgent.js` (or `ToolOrchestrator`).
2. **Add** configuration knobs to settings.
3. **Write** unit/integration tests.
4. **Create** a probe to validate the guard works with DeepSeek.
5. **Deploy** and monitor timeouts/loops in production.

---

## 8. References
- Cline’s `Task.ts` `recursivelyMakeClineRequests` method (lines ~1320‑1350).
- Cline’s `formatResponse.noToolsUsed` function.
- This document: `.Docs/09-FUTURE/analysis_cline.md` (section "No-Op Handling").
