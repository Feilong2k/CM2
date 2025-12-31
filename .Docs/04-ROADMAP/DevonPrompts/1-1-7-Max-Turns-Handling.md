# Devon (Developer) — Task 1.1 Step 7: Implement Max‑Turns Handling

## Overview
Modify `ToolOrchestrator` to inject a prompt when the maximum turn limit is reached, prompting the model to provide a final answer based on the information gathered so far. This ensures the agent delivers a useful synthesis even when the conversation runs long.

## File: `backend/src/orchestration/ToolOrchestrator.js`

## Requirements

### 1. Behavior
- **Current:** When `maxTurns` is reached, the orchestrator emits a `max_turns_reached` trace and yields a `max_turns` event, then stops.
- **New:** When `maxTurns` is reached and the loop would otherwise stop, we should:
  1. Insert a system (or user) message into the conversation:
     ```
     You have reached the maximum number of turns. Please provide an answer based on the information you have gathered so far.
     ```
  2. Make one additional LLM call (without incrementing the turn counter) to obtain a final answer.
  3. Yield that answer as a `final` event (not `max_turns`) and end the loop.

### 2. Implementation Details

#### Step 1: Detect max‑turns condition
In the `run` method, the condition `currentTurn >= this.maxTurns` is already checked at the end of the while loop. We need to modify that section.

Current code near the end of `run`:
```js
// If we reached max turns without natural completion
if (this.currentTurn >= this.maxTurns && shouldContinue) {
  this._emitTrace('max_turns_reached', {
    turns: this.currentTurn,
    content: aggregatedContent
  });

  yield {
    type: 'max_turns',
    content: aggregatedContent,
    tool_calls: aggregatedToolCalls,
    turns: this.currentTurn
  };
}
```

We need to change it to:
1. Inject the prompt message.
2. Call the adapter one more time (with the updated messages) to get a final answer.
3. Yield that answer as a `final` event.

#### Step 2: Inject prompt and get final answer
We should add a helper method `_getFinalAnswer(messages, tools)` that:
- Appends the prompt message (role: 'system' or 'user') to the messages.
- Calls the adapter (non‑streaming or streaming) to get a response.
- Returns the response content.

Alternatively, we can do it inline in the `run` method.

#### Step 3: Yield final event
The final event should have type `'final'` and include the synthesized answer.

### 3. Edge Cases
- **No tool calls before max turns:** The injected prompt should still be added, and the model should provide a conversational answer.
- **Max turns reached during a tool‑call retry loop:** The prompt should be injected after the current retry cycle completes (i.e., after the tool results are added to the conversation).
- **Adapter error in final call:** If the final LLM call fails, we should still yield a `final` event with whatever aggregated content we have, and log the error.

### 4. Trace Events
- Keep the existing `max_turns_reached` trace (for monitoring).
- Add a new trace `max_turns_prompt_injected` when we add the prompt.
- Emit a `llm_call` trace for the final LLM call.

### 5. Unit Tests
Tara will write unit tests for this behavior. Ensure your implementation is testable:
- The prompt injection logic should be in a separate method that can be unit‑tested.
- The final‑answer generation should be mockable.

## Verification
- Run the existing probe `probe_fs_tools_orchestrator.js` to ensure no regression.
- The new probe `probe_max_turns.js` (written by Tara) should pass.

## Dependencies
- `DS_ReasonerAdapter` must support a non‑streaming call (or we can use streaming and aggregate). The adapter currently supports streaming via `callStreaming`. We can use that and collect the chunks.

## Decisions Locked
1. The prompt is injected as a system message (role: 'system') to avoid confusing the model with an extra user turn.
2. The final answer is yielded as a `final` event to maintain compatibility with clients expecting a single final answer.
3. The turn counter is not incremented for this final call (it’s not a new “turn” in the conversational sense).

## Example Flow
1. User asks: "List all files in the project and then summarize the architecture."
2. Turns 1‑2: Tool calls and results.
3. At the end of turn 2, `currentTurn` (2) >= `maxTurns` (2).
4. System message injected: "You have reached the maximum number of turns…"
5. LLM called with the full history (including the injected message).
6. LLM responds: "Based on the files I found, the architecture consists of…"
7. Orchestrator yields a `final` event with that response.
