# Tara (Test Engineer) — Task 1.1 Step 2: Probe for Tool Orchestrator

## Overview
We need to verify the `ToolOrchestrator` (Task 1.1 Step 2). This component is the "brain" that:
1.  Takes a user message and a list of tools.
2.  Calls the Adapter (streaming).
3.  Parses tool calls from the stream.
4.  Executes tools (using `ToolRunner`).
5.  Feeds results back to the model (loop).
6.  Emits trace events (`llm_call`, `tool_call`, `tool_result`, `final`).

The Probe (`probe_fs_tools_orchestrator.js`) will verify this logic by running a real multi-step file system task using the new Orchestrator and the previously verified Adapter.

## Step 1: Create the Probe File

**File:** `backend/scripts/probes/probe_fs_tools_orchestrator.js`

**Instructions:**
Create a standalone script that:
1.  **Imports:**
    -   `DS_ReasonerAdapter` (from Step 1).
    -   `ToolOrchestrator` (the new class to be tested).
    -   `FileSystemTool` (from `../../tools/FileSystemTool.js`).
    -   `functionDefinitions` (from `../../tools/functionDefinitions.js`).
2.  **Setup:**
    -   Load `.env`.
    -   Instantiate `adapter = new DS_ReasonerAdapter()`.
    -   Filter `tools` to only include `FileSystemTool_*`.
    -   Define a simple `toolRegistry` object: `{ FileSystemTool: FileSystemTool }`.
    -   Instantiate `orchestrator = new ToolOrchestrator(adapter, toolRegistry, { maxTurns: 5 })`.
3.  **Task:**
    -   Message: "Create a file named 'orchestrator_test.txt' with content 'Hello Orchestrator', then read it back."
    -   Messages array: `[{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: ... }]`.
4.  **Execution:**
    -   Call `orchestrator.run(messages, tools)`.
    -   Iterate over the stream: `for await (const event of stream)`.
    -   Log specific events to console:
        -   `tool_call`: Log tool name and args.
        -   `tool_result`: Log success/failure.
        -   `final`: Log the final answer.
5.  **Verification:**
    -   The script should visually output the tool execution sequence.
    -   (Bonus) It could programmatically check if the file exists at the end, but visual trace is sufficient for a probe.

**Constraints:**
-   Use `require`.
-   Do not assume `ToolOrchestrator` exists yet (it will fail initially).

**Expected Outcome:**
-   Running `node backend/scripts/probes/probe_fs_tools_orchestrator.js` fails with `Cannot find module ... ToolOrchestrator`.
-   Once implemented, it should show:
    1.  Tool Call (write)
    2.  Tool Result (success)
    3.  Tool Call (read)
    4.  Tool Result (content)
    5.  Final Answer
