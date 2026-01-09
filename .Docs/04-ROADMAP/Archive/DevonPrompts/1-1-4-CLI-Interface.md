# Devon (Developer) — Task 1.1 Step 7: Implement Interactive CLI

## Overview
Implement the `bin/orion-cli.js` script. This is the entry point for users to interact with Orion.

## File: `bin/orion-cli.js`

## Requirements

### 1. Structure
-   **Shebang:** `#!/usr/bin/env node`
-   **Imports:** `dotenv` (load from backend), `path`, `readline`, `OrionAgent`, `FileSystemTool`.
-   **Class `Interface`:** Encapsulate the CLI logic so it can be tested (probed) without running immediately.
    -   Constructor accepts `inputStream` (default `process.stdin`) and `outputStream` (default `process.stdout`).

### 2. Logic
-   **Initialization:**
    -   Load `.env`.
    -   Instantiate `OrionAgent` with `FileSystemTool`.
    -   Set up `readline` interface.
-   **Loop:**
    -   Display welcome message.
    -   Prompt user: `> `
    -   On line input:
        -   If "exit" or "quit": Close and exit.
        -   Otherwise: Call `agent.processTaskStreaming(input)`.
        -   Stream response to stdout.
        -   Print newline after response.
        -   Re-prompt.

### 3. Trace Emitter
-   Implement a simple trace logger that prints to stdout (or stderr to separate from content).
-   Format: `[TRACE] <type> <summary>` (colored if possible, or just clear text).
-   Pass this to `OrionAgent`.

### 4. Execution
-   If file is run directly (`require.main === module`), instantiate `Interface` and start it.
-   If imported (for testing), export `Interface`.

## Verification
-   Run `node backend/scripts/probes/probe_interactive_cli.js`.
-   Manually run `node bin/orion-cli.js`.
