# Devon (Developer) — Task 1.1 Step 5: Implement OrionAgent

## Overview
Implement the `OrionAgent` class. This is the public API for the system. It composes the low-level components into a usable agent.

## File: `backend/src/agents/OrionAgent.js`

## Requirements

### 1. Constructor
-   **Inputs:** `options` object.
    -   `toolRegistry` (Required).
    -   `systemPrompt` (Optional - defaults to internal prompt).
    -   `orchestratorOptions` (Optional - passed to orchestrator).
-   **Composition:**
    -   Instantiate `DS_ReasonerAdapter` (internal).
    -   Instantiate `ToolOrchestrator` with the adapter and registry.

### 2. Default System Prompt (`_getDefaultSystemPrompt`)
-   **Critical:** This prompt must balance tool usage with conversational ability.
-   **Draft:**
    ```text
    You are Orion, an intelligent assistant for the CodeMaestro project.
    
    Capabilities:
    - You can have natural conversations.
    - You have access to filesystem tools to inspect and modify the project.
    
    Guidelines:
    - Use tools ONLY when necessary to fulfill the user's request.
    - If the request can be answered with general knowledge or conversationally, do NOT call tools.
    - Verify critical operations when appropriate.
    ```

### 3. Method: `processTaskStreaming(message)`
-   **Inputs:** `message` (string).
-   **Behavior:**
    -   Construct `messages` array: `[{ role: 'system', content: this.systemPrompt }, { role: 'user', content: message }]`.
    -   Extract tool definitions from `this.toolRegistry` (convert registry object to array of definitions).
        -   *Note:* The registry is `{ Name: Implementation }`. We need the definitions (schemas).
        -   *Wait:* In previous steps, we passed `functionDefinitions` (array) separately from `toolRegistry` (map).
        -   **Correction:** `OrionAgent` should probably accept `toolRegistry` (map) AND `functionDefinitions` (array), OR derive definitions from the registry if possible.
        -   **Simplification:** For now, import `functionDefinitions` directly in `OrionAgent` or accept it in options. Let's make it accept `toolRegistry` (map) and assume it imports the standard definitions, OR filters them based on the registry keys.
        -   **Decision:** `OrionAgent` should filter the global `functionDefinitions` to match the keys in `toolRegistry`.

### 4. Method: `getConfig()`
-   Return simple config info (adapter type, tool names, prompt length).

## Dependencies
-   `../../adapters/DS_ReasonerAdapter`
-   `../../orchestration/ToolOrchestrator`
-   `../../tools/functionDefinitions`

## Verification
-   Run `node backend/scripts/probes/probe_orion_agent.js`.
