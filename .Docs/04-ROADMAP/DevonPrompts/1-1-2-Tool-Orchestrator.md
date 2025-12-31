# Devon (Developer) — Task 1.1 Step 4: Implement Tool Orchestrator

## Overview
Implement the `ToolOrchestrator` class. This is the core "brain" that manages the conversation loop, executes tools, and emits trace events.

## File: `backend/src/orchestration/ToolOrchestrator.js`

## Requirements

### 1. Constructor
-   **Inputs:** `adapter`, `toolRegistry`, `options`.
-   **Options:** `maxTurns` (default 10), `traceEmitter` (default: console log), `projectId`, `requestId`.
-   Initialize internal state (UUIDs if needed).

### 2. Method: `run(messages, tools)`
-   **Inputs:** `messages` (history), `tools` (definitions).
-   **Returns:** `AsyncIterator` (yielding chunks).
-   **Logic:**
    1.  **Loop** until `maxTurns` reached or no tool calls.
    2.  **Call Adapter:** `await this.adapter.callStreaming(currentMessages, tools)`.
    3.  **Process Stream:**
        -   Yield `chunk` events as they come.
        -   Aggregate `content` and `tool_calls` (handling split chunks/JSON merging).
    4.  **Emit Trace:** `llm_call` (with full turn response).
    5.  **Check for Tool Calls:**
        -   If none -> **Break Loop** (Turn End).
    6.  **Execute Tools:**
        -   Yield `tool_call` events.
        -   Use `ToolRunner.executeToolCalls(this.toolRegistry, ...)` to execute them safely.
        -   Yield `tool_result` events.
        -   Emit `tool_call` and `tool_result` traces.
    7.  **Update History:** Append assistant message (with tool calls) and tool messages (results) to `currentMessages`.
    8.  **Repeat Loop.**
    9.  **Final:** Yield `final` event with aggregated content and trace summary.

### 3. Tool Call Merging (`_mergeToolCalls`)
-   Implement robust logic to merge streaming tool call chunks.
-   Handle partial JSON arguments (accumulate strings, parse only when needed or at end).
-   **Critical:** Ensure arguments like `{"path":` + ` "."}` correctly merge to `{"path": "."}`.

## Verification
-   Run the probe created by Tara:
    ```bash
    node backend/scripts/probes/probe_fs_tools_orchestrator.js
    ```
-   It should perform the multi-step task (write then read) and exit successfully.

## Dependencies
-   `uuid` (for request IDs).
-   `../../tools/ToolRunner` (for execution).
