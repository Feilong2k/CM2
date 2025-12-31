# Tara (Test Engineer) — Task 1.1 Step 3: Probe for OrionAgent

## Overview
We need to verify the `OrionAgent` class (Task 1.1 Step 3). This is the high-level facade that:
1.  Composes `DS_ReasonerAdapter`, `ToolOrchestrator`, and `ToolRegistry`.
2.  Provides a simple `processTask(message)` API.
3.  Manages the default system prompt.
4.  Exposes streaming events to the caller.

The Probe (`probe_orion_agent.js`) will verify this by instantiating the agent and running a simple conversation.

## File: `backend/scripts/probes/probe_orion_agent.js`

## Instructions
Create a standalone script that:
1.  **Imports:**
    -   `OrionAgent` from `../../src/agents/OrionAgent.js`.
    -   `FileSystemTool` from `../../tools/FileSystemTool.js`.
2.  **Setup:**
    -   Load `.env` (using `path.resolve` correctly!).
    -   Create a `toolRegistry` object: `{ FileSystemTool }`.
    -   Instantiate `agent = new OrionAgent({ toolRegistry })`.
3.  **Execution:**
    -   Call `agent.processTaskStreaming('Say hello and tell me what tools you have.')`.
    -   Iterate over the returned stream.
    -   Log events (`chunk`, `tool_call`, `final`).
4.  **Verification:**
    -   The script should show the agent responding.
    -   It should show that `FileSystemTool` is available (based on the model's response).

## Constraints
-   Use `require`.
-   Do not manually instantiate Adapter or Orchestrator; the Agent should do that.
-   Do not pass a system prompt (test the default).

## Expected Outcome
-   Running `node backend/scripts/probes/probe_orion_agent.js` fails with `Cannot find module ... OrionAgent`.
-   Once implemented, it should print the conversation stream.
