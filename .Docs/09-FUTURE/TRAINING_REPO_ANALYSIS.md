# Training Guide: Repository Analysis & "Secret Sauce" Extraction

**Objective:** Teach an AI agent (Orion) how to reverse-engineer a complex codebase to understand its architecture, tools, and unique behaviors ("Secret Sauce").

---

## Phase 1: Map the Territory (Broad Reconnaissance)
*Don't read files yet. Just see the shape of the land.*

1.  **List Top-Level Files:**
    - Command: `list_files(path=".", recursive=false)`
    - **Look for:** `package.json` (Node), `pyproject.toml` (Python), `src/`, `docs/`.
    - *Insight:* The presence of `vscode` or `extension.ts` suggests a VS Code extension.

2.  **Drill into Source:**
    - Command: `list_files(path="src", recursive=false)`
    - **Look for:** `core/`, `controllers/`, `agents/`, `tools/`.
    - *Insight:* `core` usually holds the business logic. `tools` holds the capabilities.

---

## Phase 2: Find the Brain (Locate the Orchestrator)
*Where does the thinking happen?*

1.  **Find the Entry Point:**
    - VS Code: Look for `extension.ts` or `activate()`.
    - CLI: Look for `index.ts`, `bin/`, or `main.py`.
    - Web: Look for `App.tsx` or `server.ts`.

2.  **Trace the Instantiation:**
    - Read the entry file. Look for what classes are created.
    - *Example:* In Cline, `extension.ts` created a `VscodeWebviewProvider`, which created a `Controller`.
    - *Hypothesis:* `Controller` is the manager.

3.  **Find the Loop:**
    - Read the Manager/Controller class. Look for methods like `initTask`, `startLoop`, `chat`.
    - *Example:* `Controller` created a `Task`. The `Task` class had `initiateTaskLoop`.
    - *Conclusion:* `Task.ts` is the Brain.

---

## Phase 3: Inspect the Tools (Capabilities)
*What can it actually DO?*

1.  **Locate Tool Definitions:**
    - Search for folder names like `tools`, `prompts`, `skills`.
    - Look for files exporting "definitions" or "schemas".
    - *Example:* `src/core/prompts/system-prompt/tools/execute_command.ts`.

2.  **Analyze Prompt Engineering:**
    - Read the tool description strings.
    - **Look for:** Special instructions ("Use absolute paths", "Don't use grep").
    - **Why?** This tells you what the model struggles with and how they fixed it.

---

## Phase 4: Identify the "Secret Sauce" (Robustness & Magic)
*How does it not break?*

1.  **State Management:**
    - Search for: `Mutex`, `Lock`, `State`, `Context`.
    - *Finding:* Cline uses `stateMutex.withLock()` to prevent race conditions.

2.  **Error Handling & Retry:**
    - Search for: `catch`, `retry`, `attempt`, `backoff`.
    - *Finding:* Cline has `attemptApiRequest` with a loop that retries 3 times on API errors.

3.  **Context Injection:**
    - Look for where the system prompt is built.
    - *Finding:* `getEnvironmentDetails` injects visible files, active terminal output, and directory structure dynamically.

4.  **Guardrails:**
    - Look for "Mistake Counts" or "Safety Checks".
    - *Finding:* Cline tracks `consecutiveMistakeCount` and stops if the model fails too often.

---

## Summary Checklist for Orion
1.  [ ] **Map:** List files -> Identify Language & Framework.
2.  [ ] **Trace:** Entry Point -> Controller -> Task Loop.
3.  [ ] **Tools:** Find definition files -> Analyze prompt constraints.
4.  [ ] **Sauce:** Find Mutexes, Retries, and Context Injection.

**Goal:** Don't just copy code. Copy the **Architecture Patterns** that make it robust.
