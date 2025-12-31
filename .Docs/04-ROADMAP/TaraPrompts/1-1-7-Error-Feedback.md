# Tara (Test Engineer) — Task 1.1 Step 7: Max‑Turns Handling

## Overview
We need to verify one enhancement to the `ToolOrchestrator` and `OrionAgent`:

**Max‑Turns Utilization:** When the `maxTurns` limit is reached, the system must inject a prompt instructing the model to provide a final answer based on the information gathered so far, instead of simply stopping the loop.

This change ensures that the agent delivers a useful output even when the conversation runs long, synthesizing a response from the accumulated context.

## File: `backend/scripts/probes/probe_max_turns.js`

### Probe Design
The probe must simulate the scenario where the turn limit is reached.

#### Scenario: Max‑turns reached with final‑answer prompt
- **Setup:** Configure the orchestrator with `maxTurns = 2` and provide a task that requires multiple turns (e.g., a multi‑step file‑system operation).
- **Expected Behavior:**
  1. After the second turn, the orchestrator detects that `maxTurns` has been reached.
  2. It injects a system message: `"You have reached the maximum number of turns. Please provide an answer based on the information you have gathered so far."`
  3. The model then generates a final answer using the accumulated context (tool results, previous messages).
  4. The loop ends with a `final` event containing that answer.
- **Verification:** The probe must confirm that:
  - The injected prompt is present in the messages.
  - The model’s final answer references earlier tool results.
  - No further tool calls are made after the prompt.

## Technical Details for Devon

### Max‑Turns Prompt Injection
- **Current State:** When `maxTurns` is reached, the orchestrator emits a `max_turns_reached` trace and yields a `max_turns` event, then stops.
- **Change Required:** In the `run` loop, when `currentTurn >= this.maxTurns` and `shouldContinue` is still true:
  1. Insert a system (or user) message into `currentMessages`:
     ```
     You have reached the maximum number of turns. Please provide an answer based on the information you have gathered so far.
     ```
  2. Make one additional LLM call (without counting it as a turn) to obtain a final answer.
  3. Yield that answer as a `final` event and end the loop.
- **Rationale:** The user expects a helpful answer even when the agent runs out of turns. The injected prompt nudges the model to synthesize a response from the available context.

## Acceptance Criteria (Tara)

### Unit Tests
- [ ] `ToolOrchestrator` unit test for max‑turns prompt injection and final‑answer generation.

### Integration Tests
- [ ] Probe runs without error and passes the scenario.
- [ ] The CLI (when used interactively) shows the max‑turns prompt and a final answer after the turn limit.

### Edge Cases
- **Max turns reached with no tool calls:** The injected prompt should still be added, and the model should provide a conversational answer.
- **Max turns reached during a tool‑call retry loop:** The prompt should be injected after the current retry cycle completes.

## Dependencies
- `ToolOrchestrator` must be updated to support the prompt injection and final‑answer generation.

## Decisions Locked
1. The max‑turns prompt must be injected as a system message (or a user message) to guide the model.
2. The final answer after max‑turns must be yielded as a `final` event (not a `max_turns` event) to maintain compatibility with existing clients.
3. **Error feedback remains specific** – we keep the current error‑handling behavior because specific error messages (e.g., "ENOENT: no such file or directory") have proven effective.

## Incremental Probe
Create `backend/scripts/probes/probe_max_turns.js` that:
1. Forces a max‑turns situation and verifies the injected prompt and final answer.
2. Prints trace events for manual inspection.

Running `node backend/scripts/probes/probe_max_turns.js` must pass with a clear success message.
