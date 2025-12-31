# Tara (Test Engineer) — Task 1.1 Step 8: Unit Tests for CLI Interface

## Overview
We need unit tests for the CLI Interface class to ensure it handles input/output and agent interaction correctly without needing a real terminal.

## File: `bin/__tests__/orion-cli.spec.js`

## Test Cases

### 1. Initialization
-   Should instantiate with custom input/output streams.
-   Should load `.env` (mocked).
-   Should instantiate `OrionAgent`.

### 2. Input Processing
-   Mock `OrionAgent.processTaskStreaming` to yield a simple stream.
-   Simulate user input line via mocked input stream.
-   Verify `processTaskStreaming` is called with correct input.
-   Verify output stream receives the streamed response chunks.

### 3. Exit Commands
-   Simulate "exit" or "quit" input.
-   Verify `readline` interface closes.
-   Verify process exits (mock `process.exit`?). Actually, testing a class that handles logic is better than testing global process exit. The `Interface` class should probably emit an 'exit' event or resolve a promise.

### 4. Error Handling
-   Mock `processTaskStreaming` to throw.
-   Verify error is logged to output stream/stderr.
-   Verify CLI does not crash/exit on agent error (should re-prompt).

## Constraints
-   Use `jest`.
-   Mock `OrionAgent`.
-   Use `stream` module (PassThrough) to mock stdin/stdout.
