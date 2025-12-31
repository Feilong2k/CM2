# Tara (Test Engineer) — Task 1.1 Step 4: Probe for Interactive CLI

## Overview
We need to verify the `bin/orion-cli.js` (Task 1.1 Step 4). This is the interactive terminal interface for the user.

**Key Requirement:** The CLI must support an interactive session where the user can type commands, see streaming responses, and maintain conversation context. This matches the requirements from `1-1-8-Interactive-CLI.md` (which we are effectively implementing now as part of the CLI step).

The Probe (`probe_interactive_cli.js`) will simulate a user interacting with the CLI module. Since we can't easily script a real TTY interaction in a probe, we will verify the **logic** of the CLI class/functions by importing them, rather than spawning a child process (which is flaky).

## File: `backend/scripts/probes/probe_interactive_cli.js`

## Instructions
Create a standalone script that:
1.  **Imports:** `OrionAgent` (to mock it or use it) and the CLI logic.
    -   *Note:* The CLI script `bin/orion-cli.js` usually runs immediately. We need to structure it so it exports a `startCLI` or `Interface` class that we can test.
    -   *Assumption:* The implementation will export a class/function.
2.  **Mocking:**
    -   We need to mock `readline` to simulate user input programmatically.
    -   Or, we design the CLI code to accept an input stream and output stream.
3.  **Scenario:**
    -   Initialize the CLI with a dummy input stream (mocking user typing "Hi").
    -   Verify the CLI calls `agent.processTaskStreaming`.
    -   Verify the CLI writes the agent's response to the output stream.
    -   Simulate user typing "exit".
    -   Verify CLI closes.

## Constraints
-   Use `require`.
-   Do not rely on `child_process.spawn` unless absolutely necessary (prefer in-process testing).
-   This probe requires the CLI implementation to be **testable** (separated logic from execution).

## Expected Outcome
-   Running `node backend/scripts/probes/probe_interactive_cli.js` fails because `bin/orion-cli.js` doesn't exist or doesn't export testable logic yet.
