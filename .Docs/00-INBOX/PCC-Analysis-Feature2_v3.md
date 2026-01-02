# PCC (Pre-flight Concstraint Check) Analysis
**Document:** Feature2_Skills_Aider_Integration_v3.md (v3.0)  
**Date:** 2026-01-01  
**Analyst:** Adam (Architect)

## 1. LIST ACTIONS
What needs to happen to implement Feature 2 (Autonomous TDD Workflow with Aider Integration) as per v3.0?

1. **Create database extensions** – `steps` and `work_stages` tables with enhanced columns (attempt_count, last_error, parent_step_id, context_files).
2. **Build core helper services** – `StepDecomposer` (lightweight, validates file existence, creates steps), `ContextBuilder` (reads file content and context_files, builds comprehensive prompt).
3. **Implement skills framework** – Dynamic skill loading from `backend/skills/aider_orchestration/` with SKILL.md validation and basic execution engine.
4. **Integrate TaraAider** – Create `TaraAiderInvoker` that uses Aider's non‑interactive CLI mode (`aider --read [context_files...] --add [file_path] "[instructions]"`) for test file creation.
5. **Build test execution framework** – `TestRunner` (modular, runs project test suite), `TestResultParser` (extracts pass/fail info), `TaraTestRunner` (specialized for TDD loop).
6. **Integrate DevonAider** – Create `DevonAiderInvoker` that uses same CLI mode but includes test results in prompt for TDD feedback.
7. **Implement concurrency & error handling** – File locking, step serialization, retry logic (based on attempt_count), stuckness detection, rollback via Aider's git integration.
8. **Workspace & Git integration (Post‑MVP)** – Single isolated workspace (`workspaces/{project-id}/`) with git synchronization to main codebase.
9. **Integration probes & E2E validation** – Define test scenarios, smoke tests, full TDD cycle end‑to‑end test, performance benchmarking.

## 2. FIND RESOURCES
What enables each action?

- **Database**: PostgreSQL with existing `projects`, `features`, `tasks`, `subtasks` tables; new `steps`, `work_stages` tables (ENUM types for status, step_type, assigned_to, work_stage).
- **File system**: Project codebase (for reading/writing files), skill directories (`backend/skills/`), workspace directory (post‑MVP).
- **OrionAgent** (existing) – with FS/DB tools, trace emission, CLI, context integration.
- **Aider instances** – external prompting engines (TaraAider, DevonAider) that accept `--read` and `--add` commands and auto‑commit changes.
- **Test suite** – existing Jest/Vitest infrastructure.
- **Git** – for workspace cloning, auto‑commit, and rollback (`git reset --hard`).
- **Environment variables** – `DEEPSEEK_API_KEY` (already used by Orion), possibly Aider‑specific configs.
- **Skill registry** – dynamic loading mechanism (to be built).

## 3. IDENTIFY GAPS & MAP DATA FLOW
**CDP (Constraint Discovery Protocol) Level 3 applied:**

### Atomic Actions
1. `db_migration_create_steps` – create `steps` table with all specified columns (including ENUM types).
2. `db_migration_create_work_stages` – create `work_stages` table.
3. `service_step_decomposer` – Orion passes structured JSON (file_path, step_type, context_files, instructions); validates context files exist via FileSystemTool; writes steps to DB.
4. `service_context_builder` – reads target file and all context_files via FileSystemTool, extracts relevant codebase parts, includes step instructions and acceptance criteria, builds prompt.
5. `skill_loader` – loads SKILL.md with YAML frontmatter and operating instructions from `backend/skills/aider_orchestration/`.
6. `service_tara_aider_invoker` – constructs Aider CLI command with `--read` (context files) and `--add` (file_path), executes, captures output and git commit hash, updates step status (completed/failed), increments attempt_count, stores error.
7. `service_test_runner` – executes project test suite (`npm test`, `jest`, specific files), captures output.
8. `service_test_result_parser` – parses test output into structured JSON (pass/fail, errors).
9. `service_tara_test_runner` – specialized for TDD loop, runs tests and appends results to history, detects stuckness.
10. `service_devon_aider_invoker` – similar to TaraAiderInvoker but includes test results in prompt.
11. `service_file_locking` – prevents concurrent edits to same file within workspace.
12. `service_step_serializer` – ensures steps targeting same file execute sequentially.
13. `service_error_recovery` – retry logic (max attempts), fallback strategies, manual escalation.
14. `service_workspace_manager` (post‑MVP) – creates isolated workspace, clones repo, syncs successful changes back to main codebase.
15. `integration_probes` – define test scenarios, smoke tests, end‑to‑end validation, performance metrics.

### Resources Touched
| Resource | Action | Notes |
|----------|--------|-------|
| PostgreSQL (`steps`) | Write | StepDecomposer writes steps with context_files array |
| PostgreSQL (`steps`) | Read/Update | ContextBuilder reads, AiderInvoker updates status, attempt_count, last_error |
| PostgreSQL (`work_stages`) | Write/Update | Optional tracking of feature/task progression |
| File system (project files) | Read | ContextBuilder reads target file and context_files |
| File system (project files) | Write | Aider applies changes directly via CLI (no separate diff processor) |
| File system (skill directory) | Read | SkillLoader reads SKILL.md and scripts |
| External Aider (CLI) | Execute | AiderInvoker spawns child process with `--read` and `--add` flags |
| Test suite (npm test) | Execute | TestRunner spawns child process |
| Git repository (workspace) | Clone/Commit/Reset | WorkspaceManager (post‑MVP) and Aider auto‑commit |
| OrionAgent memory | Read/Write | SkillLoader loads instructions, Orion uses them |

### Resource Physics & Gaps
| Resource | Constraint | Risk | Mitigation |
|----------|------------|------|------------|
| PostgreSQL (`steps`) | ENUM types must be created before table | Migration failure | Ensure migration order (ENUM first, then tables) |
| PostgreSQL (`context_files`) | JSONB array of file paths; paths must be valid | Invalid paths cause errors | Validate paths with FileSystemTool before insertion |
| File system (context files) | Files may not exist | ContextBuilder fails | StepDecomposer validates existence; handle gracefully (skip?) |
| External Aider CLI | Non‑interactive mode must be supported | Aider version mismatch | Verify Aider version during setup; provide clear error |
| Aider auto‑commit | Requires git repository in workspace | Workspace not git‑enabled | Ensure workspace is cloned from repo (post‑MVP) |
| Test suite execution | Tests may be flaky or require specific environment | False positives/negatives | Isolate test environment; run subset; retry on flaky failures |
| Skill directory | SKILL.md must follow YAML+markdown format | Malformed skill breaks loading | Validate on load; fallback to default behavior |
| Concurrency (same file) | Concurrent edits cause conflicts | Data corruption | File locking and step serialization |
| Workspace synchronization | Changes must be synced to main codebase | Merge conflicts, data loss | Manual review before sync (post‑MVP) |

### Data Flow Map
```
User → CLI → OrionAgent → StepDecomposer → DB (steps)
OrionAgent → ContextBuilder → (File + DB) → JSON context
OrionAgent → TaraAiderInvoker → Aider CLI (--read, --add) → Auto‑commit → File changed
OrionAgent → TestRunner → Test suite → TestResultParser → DB (update step)
OrionAgent → DevonAiderInvoker → Aider CLI (with test results) → Auto‑commit → File changed
```
**Note:** No separate `ResultProcessor` – Aider applies changes directly.

**Gaps identified:**
1. **Aider CLI error handling** – What if Aider exits with non‑zero but made partial changes? Need to parse output for success/failure.
2. **Test result inclusion in DevonAider prompt** – How to format test results (structured JSON?) for inclusion in Aider prompt.
3. **Stuckness detection criteria** – Based on attempt_count, error patterns, or test result stagnation? Need explicit thresholds.
4. **Workspace path mapping** – All file paths are relative to project root; workspace must mirror same structure.
5. **Skill execution engine** – How does Orion “execute” a skill? Likely via tool calls; need to define interface.

## 4. MAP DEPENDENCIES
1. Database migrations (1,2) → core helper services (3‑6,10).
2. Core helper services (3,4) → TaraAider integration (6).
3. TaraAider integration (6) → test framework (7‑9) → DevonAider integration (10).
4. Skills framework (5) → integration probes (15) (skills used in testing).
5. Concurrency & error handling (11‑13) depends on all previous services.
6. Workspace & Git integration (14) is post‑MVP and depends on concurrency handling.

**Blocking dependencies:**
- `steps` table must exist before `StepDecomposer` can write.
- `ContextBuilder` requires `FileSystemTool` to read files.
- `TaraAiderInvoker` requires Aider CLI to be installed and configured.
- `TestRunner` requires test suite to be runnable (dependencies installed).

## 5. CHECK INTEGRATION
- **Input/output alignment**:
  - `StepDecomposer` input: Orion's structured JSON (file_path, step_type, context_files, instructions). Output: step records in DB.
  - `ContextBuilder` input: step ID. Output: JSON context for Aider (including file content and instructions).
  - `AiderInvoker` input: step ID + built context. Output: Aider CLI execution result (success/failure, git commit hash).
  - `TestRunner` input: step ID or file path. Output: raw test output.
  - `TestResultParser` input: raw test output. Output: structured pass/fail summary.
- **Communication protocols**:
  - Aider interaction via CLI command (non‑interactive). Contract: `aider --read <context_files> --add <file_path> "<instructions>"`.
  - Skills are loaded as files; Orion must parse YAML frontmatter and markdown instructions.
- **Error handling**: Specified in v3.0 (retry logic, attempt_count, last_error, git rollback). Need to implement in each service.

### 5.1 VALIDATE TEST SEAMS
- **Injection seams**:
  - `StepDecomposer` can receive mock FileSystemTool and DatabaseTool.
  - `ContextBuilder` can receive mock FileSystemTool.
  - `AiderInvoker` can receive mock child‑process spawner.
  - `TestRunner` can receive mock child‑process spawner.
- **Observation seams**:
  - DB writes can be observed via querying `steps` table (status, attempt_count, last_error).
  - File changes can be observed via reading file content or git log.
  - Test results can be observed via parsed output.
- **Verdict**: Plan is **testable** because each service can be injected and its effects observed.

## 6. VALIDATE COMPLETENESS
**Goal**: Enable Orion to coordinate TaraAider and DevonAider through a structured skills framework and helper services for autonomous TDD workflow.

The v3.0 specification covers:
- Database schema enhancements (steps, work_stages).
- Core helper services (StepDecomposer, ContextBuilder).
- Skills framework (dynamic loading, validation).
- TaraAider and DevonAider integration using Aider's non‑interactive CLI.
- Test execution framework.
- Concurrency and error handling.
- Workspace & Git integration (post‑MVP).
- Integration probes and E2E validation.

**Missing details** (to be clarified during implementation):
- Exact Aider CLI command format for different scenarios (e.g., multiple context files).
- Format of test results to include in DevonAider prompt.
- Stuckness detection thresholds (e.g., max attempts, error patterns).
- Skill execution engine interface (how Orion calls a skill).

## 7. DEFINE VERIFICATION TESTS
For each component:

1. **Database migrations** – verify `steps` and `work_stages` tables exist with correct columns and ENUMs.
2. **StepDecomposer** – given Orion's JSON, creates step records with context_files; validates file existence.
3. **ContextBuilder** – given step ID, returns JSON context containing file content and instructions.
4. **SkillLoader** – loads SKILL.md, extracts YAML frontmatter, makes instructions available.
5. **TaraAiderInvoker** – constructs correct CLI command, executes mock Aider, updates step status on success/failure.
6. **TestRunner** – runs a known test and captures output.
7. **TestResultParser** – parses test output into structured pass/fail summary.
8. **DevonAiderInvoker** – includes test results in prompt, constructs CLI command, updates step status.
9. **File locking** – prevents two steps from editing same file concurrently.
10. **Error recovery** – retries failed step up to max attempts, stores error, escalates on stuckness.
11. **End‑to‑end TDD cycle** – Orion receives subtask → decomposes → TaraAider creates test → TestRunner runs test (failing) → DevonAider implements → TestRunner passes → step completion.

## PVP VERDICT
**Plan is CONDITIONALLY SAFE** – v3.0 addresses many previous gaps (Aider CLI mode, single workspace, enhanced database columns). However, the following must be clarified during implementation:

1. **Aider CLI error handling** – need to parse Aider output to distinguish between success, partial success, and failure.
2. **Test result formatting** – define schema for test results to be included in DevonAider prompt.
3. **Stuckness detection thresholds** – define numerical thresholds (max attempts, error patterns) for escalation.
4. **Skill execution interface** – define how Orion invokes a skill (tool call? special command?).

**Recommendation**: Proceed with implementation of Tasks 2‑1 through 2‑7 and 2‑9 (MVP). Address missing details as they arise, documenting decisions in ADRs.
