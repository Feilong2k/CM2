# Post‑Orion‑Rebuild Process: Skills & Aider Integration

## 1. Orion Rebuild Completion State

Once Feature 1, Task 1 (Orion Rebuild) is complete, you will have:

- **A working CLI** (`bin/orion‑cli.js`) that accepts a task description and runs OrionAgent.
- **Full access to FS tools** (FileSystemTool) and **DB tools** (DatabaseTool) via the tool registry.
- **Live trace events** displayed in the CLI for every step:
  - `llm_call` (adapter request/response)
  - `tool_call` (which tool with which arguments)
  - `tool_result` (result of tool execution)
  - `reasoning_content` (DeepSeek’s reasoning text)
- **Persistent storage** (Phase 3) of messages and traces in the database (optional but available).
- **Dynamic system prompt** (Phase 4) that can include file‑tree context and recent history.

**Correct statement:** Yes, you will be able to chat with Orion through the CLI, and each interaction step will be visible via traces.

## 2. Building Skills for Aider‑based Sub‑agents

To enable Orion to delegate subtasks to **TaraAider** (testing) and **DevonAider** (implementation), you need the following components:

### 2.1 Database Extensions

- **`steps` table** – stores the decomposition of a feature/task into single‑file subtasks.
  - Columns: `id`, `project_id`, `feature_id`, `step_number`, `step_type` (`implementation`|`test`), `file_path`, `instructions`, `status` (`pending`|`in_progress`|`completed`|`failed`), `assigned_to` (`TaraAider`|`DevonAider`), `context_snapshot` (JSON), `created_at`, `updated_at`.
- **`work_stages` table** (optional) – tracks overall progress of a feature (analysis, decomposition, implementation, testing, integration).
- Updates to existing `projects`, `features`, `tasks`, `subtasks` tables to reference steps.
NOTE: steps is tied to subtask only not feature or task, it is the breakdown of subtask to signle file step.

### 2.2 Helper Services

- **`StepDecomposer`** – a helper that uses Orion (via its existing toolset) to break a subtask into single‑file steps. It writes each step to the `steps` table.
- **`ContextBuilder`** – for each step, builds a rich context that includes:
  - The file’s current content (read via FileSystemTool).
  - Relevant parts of the codebase (e.g., imports, related components).
  - The step’s specific instructions and acceptance criteria.
  - Any historical feedback (previous attempts, errors).
- **`AiderInvoker`** – a script that:
  - Takes a step record, builds its context.
  - Calls the appropriate Aider (TaraAider/DevonAider) with a precisely crafted prompt.
  - Streams the Aider’s response and captures the resulting file change.
  - Updates the step status and stores the result.
- **`ResultProcessor`** – receives the Aider’s output (which could be a file diff, a confirmation, or an error), applies the change (if it’s a file edit), and logs the outcome.
- **`TaraTestRunner`** – a specialized helper for TaraAider’s TDD loop:
  - **Does NOT edit files** – TaraAider makes changes directly via Aider.
  - Provides context (test file, acceptance criteria, conversation history).
  - Runs tests (`npm test` or `jest`) and captures output (pass/fail, errors).
  - Appends test results to conversation history.
  - Detects stuckness (repeated failures, no progress) and escalates to Orion.
NOTE: we need a script that runs the test/command and feed the progress details and results to Tara for her to act on.


### 2.3 Skill Definition (Anthropic‑style)

Create a skill directory, e.g., `backend/skills/aider_orchestration/` containing:

- **`SKILL.md`** – YAML frontmatter with name, description, dependencies; plus detailed operating instructions:
  - How to decompose a task into single‑file steps.
  - How to choose between TaraAider (testing) and DevonAider (implementation).
  - How to handle errors and retries.
- **`/scripts`** – helper scripts (`StepDecomposer.js`, `ContextBuilder.js`, `AiderInvoker.js`).
- **`/references`** – example prompts for TaraAider and DevonAider.

The skill is **progressively loaded** – Orion initially only knows its description; when a task matches (“break down feature X and delegate to aiders”), the full skill is loaded.

### 2.4 Orion’s Role in the Aider Workflow

1. **Orchestration** – Orion uses the skill to decide when to delegate.
2. **Step generation** – Orion (via `StepDecomposer`) writes steps to the DB.
3. **Monitoring** – Orion can query step status and decide on next actions (continue, retry, escalate).
4. **Error handling** – If an Aider fails, Orion can:
   - Retry with more context.
   - Fall back to manual intervention (ask the user).
   - Log the error and mark the step as blocked.
5. **Integration** – After all steps are complete, Orion can run integration tests (via a separate test‑execution skill).

### 2.5 Communication Flow

```
User → Orion CLI: “Implement feature X”
Orion → StepDecomposer: break into steps, store in DB
Orion → AiderInvoker: for each step:
  - Build context
  - Call TaraAider/DevonAider
  - Process result
Orion ← AiderInvoker: success/failure
Orion → DB: update step status
Orion → CLI: stream progress traces
```

The Aider’s response is **passed directly to Orion** via the helper, so Orion stays in the loop and can react to complications.

## 3. Test Execution

Aiders cannot run tests (they are prompting engines). You need:

- **`TestRunner` helper** – a script that can execute the project’s test suite (or a single test) and return pass/fail results.
- **`TestResultParser`** – extracts meaningful information from test output (which tests passed/failed, error messages).
- **A test‑execution skill** that Orion can invoke after a DevonAider implementation step, or after a TaraAider test‑writing step.

**Flow:**
1. DevonAider implements a change.
2. Orion invokes `TestRunner` on the affected file (or the whole suite).
3. Test results are parsed and stored in the DB.
4. If tests fail, Orion can decide to:
   - Ask TaraAider to fix the tests.
   - Roll back the change.
   - Ask the user for guidance.

## 4. Summary of Required Work (Post‑Feature 1)

### Database
- Create `steps` and `work_stages` tables (migrations).
- Extend existing tables with appropriate foreign keys.

### Helpers (New Services)
- `StepDecomposer`
- `ContextBuilder` 
- `AiderInvoker`
- `ResultProcessor`
- `TestRunner`
- `TestResultParser`

### Skills
- `aider_orchestration` skill (with SKILL.md, scripts, references).
- `test_execution` skill.

### Integration
- Update OrionAgent to load skills dynamically.
- Ensure the CLI can trigger skill‑based workflows.

## 5. Next Steps After Orion Rebuild

1. **Complete Feature 1, Task 1** (Core Loop, CLI, Persistence, Context).
2. **Create the database extensions** (migrations).
3. **Build the helper services** (start with StepDecomposer and ContextBuilder).
4. **Define the Aider prompts** for TaraAider and DevonAider.
5. **Create the skills** and integrate them into Orion.
6. **Test end‑to‑end** with a simple feature (e.g., add a new API endpoint).

This design keeps Orion as the central coordinator while leveraging Aiders for single‑file changes, maintaining full traceability and error handling.

## 6. PCC & CAP Analysis Findings

The plan has been analyzed using the Plan Verification Protocol (PVP) and Constraint Discovery Protocol (CDP) Level 3. Key findings:

### Critical Gaps
1. **Concurrent file edits** – Multiple Aiders/steps can target the same physical file simultaneously, risking data corruption.
2. **Aider response format** – Unspecified; assumed to be a unified diff but could be confirmation/error.
3. **Error handling & rollback** – No strategy for retries, fallbacks, or reverting failed changes.
4. **Skill validation** – Missing validation for SKILL.md format and required fields.
5. **Test isolation** – Running full test suite may be slow; need ability to run subset.

### Recommendations
- Draft an ADR for “Aider Orchestration Concurrency & Error Handling” to lock decisions.
- Define strict Aider response schema (unified diff with metadata).
- Implement file‑lock service or step serialization.
- Design step‑level rollback (backup/restore).
- Create skill validation script.

These findings will be addressed as we implement each component.

---

*Document created by Adam (Architect) on 2025‑12‑30.*
