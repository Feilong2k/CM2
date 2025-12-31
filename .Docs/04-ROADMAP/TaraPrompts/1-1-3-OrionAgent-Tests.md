# Tara (Test Engineer) — Task 1.1 Step 6: Unit Tests for OrionAgent

## Overview
We need formal unit tests for `OrionAgent` to ensure robust handling of configuration, tools, and orchestration delegation.

## File: `backend/src/agents/__tests__/OrionAgent.spec.js`

## Test Cases

### 1. Initialization
-   Should instantiate with valid `toolRegistry`.
-   Should throw if `toolRegistry` is missing.
-   Should use default system prompt if none provided.
-   Should accept custom system prompt.

### 2. Tool Registry Handling
-   Should filter `functionDefinitions` based on `toolRegistry` keys.
-   Should handle empty registry gracefully.

### 3. Orchestration Delegation
-   Mock `ToolOrchestrator` and `DS_ReasonerAdapter`.
-   Call `processTaskStreaming`.
-   Verify `orchestrator.run` is called with:
    -   Correct messages array (System + User).
    -   Correctly filtered tools.

### 4. Default Prompt
-   Verify `_getDefaultSystemPrompt` returns a string containing key instructions ("natural conversations", "filesystem tools").

## Constraints
-   Use `jest`.
-   Mock dependencies to avoid real network calls.
