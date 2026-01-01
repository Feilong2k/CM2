# Worklog: Orion Persistence & AGI Platform Architecture
**Date:** 2026-01-01
**Topic:** Orion Persistence (Tasks 3.2/3.3) & AGI Platform Strategy

## 1. Engineering Accomplishments (Orion Rebuild)

We successfully completed **Phase 3: Persistence** of the Orion roadmap.

### Task 3.2: Integrate Storage into Orchestrator
*   **Goal:** Persist all traces (LLM calls, tool calls, results) to the database automatically.
*   **Implementation:**
    *   Updated `ToolOrchestrator` to accept an injected `TraceStoreService`.
    *   Added logic to `_emitTrace` to write to `trace_events` table.
    *   Ensured full coverage of event types: `llm_call`, `tool_call`, `tool_result`, `turn_start`, `turn_end`.
*   **Key Decision:** **Fail-Loud Storage**. If database writes fail, the orchestrator throws an error and stops execution immediately to preserve data integrity/observability.

### Task 3.3: CLI with Persistent History
*   **Goal:** Enable the CLI to load previous conversation history and persist new interactions.
*   **Implementation:**
    *   Created `HistoryLoaderService`: loads last 20 messages for a project, orders them chronologically.
    *   Updated CLI to enforce a **mandatory** `--project-id` flag.
    *   Wired persistence for both **interactive** and **non-interactive** modes:
        *   User inputs and Orion answers are written to `chat_messages`.
        *   Full execution traces are written to `trace_events`.
*   **Result:** A fully persistent chat experience. Every CLI session now extends the project's memory.

## 2. Architectural Discussion: The "AGI Platform" Strategy

We explored a strategic vision for CodeMaestro (CM) evolving from a coding tool into a general **AGI Platform** that mimics human-like learning.

### Core Concept: Platform vs. Model
Instead of trying to train a single massive "AGI Model" (trillions of tokens), we treat CM as a **learning platform** composed of:
1.  **LLM (Kernel):** Provides language, reasoning, and synthesis (e.g., Qwen, DeepSeek).
2.  **Tools (Senses/Hands):** Ability to observe and act (e.g., file system, DB, compilers).
3.  **Evaluators (Feedback):** Deterministic truth signals (e.g., tests, linters, quizzes).
4.  **Protocols (Discipline):** Structured workflows like PCC/RED/CAP that enforce scientific thinking (hypothesis -> test -> verify).
5.  **Memory (Experience):** Persistent traces of what worked and what failed.

### "Human-Like" Learning via the Platform
This architecture mimics human learning (practice & iteration) rather than just reading (pre-training):
*   **Few-Shot Hypothesis:** The LLM proposes a plan from a few examples.
*   **Iterative Trial:** The platform runs 10-100 trials (tool execution + feedback).
*   **Policy Maturation:** Successful patterns evolve from **Skills** (explicit docs) -> **Rules** (deterministic gates) -> **Policies** (learned models).

### Domain Generalization
This "Kernel + Plug-ins" model applies beyond coding:
*   **Coding:** Reward = Test pass/fail.
*   **Education:** Reward = Student quiz improvement.
*   **Business Planning:** Reward = Logical consistency + evidence citation (harder to validate).

### Offline, Quality-First Architecture
For a local, privacy-first setup (e.g., Mac Studio Ultra), we defined a **multi-model portfolio**:
*   **Primary Model (Orion):** Large (~70B) generalist for planning and synthesis.
*   **Critic Model:** Smaller (~7B) specialized model for verifying claims and spotting hallucinations.
*   **Guardrails:** Deterministic code/rules (read-before-claim) that prevent confident failures.

### Next Steps for "Self-Improvement"
1.  **Collect Traces:** Use the newly built persistence to log every run.
2.  **Define Evaluators:** Treat every run as a datapoint (pass/fail).
3.  **Train/Tune:** Eventually use this data to train small policy models (e.g., "Stop/Ask" gates) or fine-tune the LLM via DPO (Direct Preference Optimization).

## 3. Immediate Next Actions
*   Proceed to **Phase 4: Context & Dynamic System Prompt** (File Tree Context, Context Service).
*   Begin accumulating trace data from CLI usage to support future learning experiments.
