# CAP (Constraint Discovery Protocol) Analysis – Level 3
**Document:** Feature2_Skills_Aider_Integration_v3.md (v3.0)  
**Date:** 2026-01-01  
**Analyst:** Adam (Architect)

## PART 1: RESOURCE ANALYSIS
| Resource | Current State | Who Uses It | Exclusive/Shared |
|----------|---------------|-------------|------------------|
| PostgreSQL (`steps` table) | Does not exist | StepDecomposer (write), ContextBuilder (read), AiderInvoker (update) | Shared (concurrent writes possible) |
| PostgreSQL (`work_stages` table) | Does not exist | Optional tracking | Shared |
| File system (project files) | Existing files | ContextBuilder (read), Aider (write via CLI), TestRunner (read) | Shared (multiple Aiders could touch same file) |
| External Aider (TaraAider/DevonAider) | External service, CLI mode | AiderInvoker (execute command) | Exclusive per invocation (but network‑shared) |
| Test suite (npm test) | Existing | TestRunner (execute), TestResultParser (read output) | Exclusive (cannot run two test suites simultaneously) |
| Skill directory (`backend/skills/aider_orchestration/`) | Does not exist | SkillLoader (read) | Shared (read‑only) |
| Workspace directory (`workspaces/{project-id}/`) | Does not exist (post‑MVP) | WorkspaceManager (create, clone), Aider (read/write), Git (commit/reset) | Exclusive per project (but shared within project) |
| Git repository (workspace) | Cloned from main | Aider (auto‑commit), WorkspaceManager (sync) | Shared (concurrent commits possible) |
| OrionAgent memory | Volatile | SkillLoader (write), Orion (read) | Exclusive to Orion instance |

## PART 2: OPERATION ANALYSIS (CRITICAL)
| Operation | Physical Change? | Locks? | 2 Actors Simultaneously? |
|-----------|-----------------|--------|--------------------------|
| `db_migration_create_steps` | Yes (creates table) | DB schema lock | No (migration runs once) |
| `StepDecomposer.write_step` | Yes (INSERT) | Row‑level lock (if concurrent) | Possibly (if multiple Orion instances) |
| `ContextBuilder.read_file` | No (read) | File read lock | Yes (multiple readers OK) |
| `AiderInvoker.execute` (CLI) | Yes (file write via Aider) | File write lock (via Aider) | No (must be exclusive per file) |
| `TestRunner.execute` | Yes (spawns process) | Process lock (port conflicts) | No (cannot run two test suites on same port) |
| `SkillLoader.load_skill` | No (read) | None | Yes (multiple reads OK) |
| `FileLockingService.lock` | No (metadata) | Advisory file lock | Yes (blocks second lock on same file) |
| `WorkspaceManager.clone` | Yes (creates directory) | Directory lock | No (one clone at a time) |
| `Git.sync` (post‑MVP) | Yes (git push/pull) | Repository lock | No (one sync at a time) |

## PART 3: ACTOR ANALYSIS
| Actor | Resources They Touch | Same Resource Same Time? |
|-------|---------------------|--------------------------|
| Orion (main) | PostgreSQL (`steps`), File system, Aider CLI, Test suite, Skill directory | Yes – could touch same file as Aider (via CLI) |
| TaraAider (via CLI) | File system (via `--add`), Git (auto‑commit) | Possibly same file as DevonAider (if steps overlap) |
| DevonAider (via CLI) | File system (via `--add`), Git (auto‑commit) | Possibly same file as TaraAider |
| TestRunner | Test suite, file system (test artifacts) | Exclusive (should not run while file is being written) |
| FileLockingService | File system (lock files) | Exclusive per file |
| WorkspaceManager (post‑MVP) | Workspace directory, Git repository | Exclusive per project |

## PART 4: ASSUMPTION AUDIT (minimum 10)
| # | Assumption | Explicit/Implicit | Breaks if FALSE | Risk |
|---|------------|-------------------|-----------------|------|
| 1 | Aider CLI supports `--read` and `--add` flags | Explicit | AiderInvoker fails to construct valid command | High |
| 2 | Aider auto‑commits changes (git integration) | Explicit | Rollback mechanism fails | Medium |
| 3 | PostgreSQL ENUM types can be created before table | Implicit | Migration fails → tables not created | High |
| 4 | Context files exist and are readable | Explicit | ContextBuilder fails → step blocked | Medium |
| 5 | Aider CLI exits with 0 on success, non‑zero on failure | Explicit | Step status incorrectly updated | High |
| 6 | Test suite is deterministic and passes when code is correct | Implicit | False negatives block workflow | Medium |
| 7 | File paths are relative to project root and valid | Explicit | StepDecomposer fails to validate | Medium |
| 8 | Only one Orion instance orchestrates steps per project | Implicit | Concurrent step execution causes conflicts | High |
| 9 | Git is installed and configured in workspace | Explicit (post‑MVP) | Aider cannot auto‑commit, rollback fails | Medium |
|10 | Skill directory structure follows YAML+markdown format | Explicit | SkillLoader fails to parse | Medium |
|11 | Aider understands the project’s coding standards and test framework | Implicit | Generated code violates style or test patterns | Medium |
|12 | TestRunner can capture stdout/stderr correctly | Implicit | TestResultParser gets incomplete data | Low |
|13 | Workspace can be cloned from main repository (post‑MVP) | Explicit | WorkspaceManager fails → no isolation | Low (post‑MVP) |
|14 | File locking prevents concurrent edits to same file | Explicit | Data corruption from overlapping writes | High |
|15 | Stuckness detection thresholds are well‑defined | Implicit | System does not escalate stuck steps | Medium |

## PART 5: PHYSICAL VS LOGICAL CHECK (CRITICAL)
| Claimed Separation | Mechanism | Physical/Logical | If Mechanism Fails? |
|-------------------|-----------|------------------|---------------------|
| “TaraAider and DevonAider work separately” | Different step types, same CLI | Logical | Same file system → physical conflict |
| “Steps are isolated by file path” | File path uniqueness + locking | Logical → Physical (with locking) | Two steps target same file → lock prevents conflict |
| “Test execution is separate from implementation” | Different processes | Physical (separate process) | Shares same file system (test reads implementation file) |
| “Skills are loaded on demand” | File read + memory load | Logical | Same memory space as Orion → physical memory constraint |
| “Workspace isolates changes from main codebase” (post‑MVP) | Separate directory, git clone | Physical (separate files) | Sync mechanism fails → changes lost or conflict |

**Key finding**: The v3.0 spec introduces file locking and step serialization to address physical conflicts. However, the locking mechanism must be implemented correctly.

## PART 6: GAP ANALYSIS (CRITICAL)
What is NOT SPECIFIED in this plan?

| Gap | Possible Interpretations | Answer Under Each |
|-----|-------------------------|-------------------|
| **Aider CLI error handling** | A: Parse stdout/stderr for success indicators<br>B: Rely solely on exit code<br>C: Check git commit existence | A → more robust but complex; B → simple but may miss partial success; C → requires git in workspace |
| **Test result formatting for DevonAider prompt** | A: Include raw test output<br>B: Include parsed JSON summary<br>C: Include only failing test details | A → verbose; B → structured; C → concise but may lose context |
| **Stuckness detection thresholds** | A: Max attempts (e.g., 3)<br>B: Timeout per step<br>C: Pattern of repeated errors | A → simple count; B → wall‑clock time; C → heuristic based on error messages |
| **Skill execution interface** | A: Tool call from Orion<br>B: Direct function invocation<br>C: CLI subcommand | A → aligns with existing tool pattern; B → tight coupling; C → external process |
| **Workspace synchronization strategy** (post‑MVP) | A: Manual review and merge<br>B: Automated git merge with conflict detection<br>C: Cherry‑pick successful commits | A → safe but manual; B → automated but risky; C → selective but complex |

## PART 7: CONDITIONAL VERDICT
- **IF** file locking is implemented correctly, Aider CLI error handling is robust, and stuckness detection thresholds are defined → **SAFE**.
- **IF** locking is missing, error handling relies only on exit codes, and no stuckness detection → **UNSAFE** (high risk of data corruption and deadlocks).

**Gaps that MUST be clarified before implementation:**
1. **Aider CLI error handling** – need to decide on parsing output vs. exit code, and how to handle partial success.
2. **Test result formatting** – define schema for test results to be included in DevonAider prompt.
3. **Stuckness detection criteria** – set numerical thresholds (max attempts, timeout) and escalation path.
4. **Skill execution interface** – define how Orion invokes a skill (tool call, function, or CLI).
5. **Workspace synchronization** (post‑MVP) – decide on manual vs. automated sync.

## FINAL VERDICT
**CONDITIONALLY SAFE** – the v3.0 specification addresses many previous CAP gaps (file locking, step serialization, retry tracking). However, **critical implementation details** (error handling, test result formatting, stuckness detection) are still underspecified. Without these, the system may be robust in theory but fragile in practice.

**Recommended mitigations:**
1. Implement a **file‑lock service** that uses advisory locks (or a simple DB‑based lock) to prevent concurrent edits.
2. Design **Aider CLI output parsing** to capture success/failure beyond exit code (e.g., look for “Applied changes” or git commit hash).
3. Define **test result schema** (JSON) and include it in DevonAider prompt as structured context.
4. Set **stuckness thresholds** (e.g., max 3 attempts, timeout 10 minutes) and implement escalation to human.
5. Create **skill execution interface** as a new tool call (e.g., `SkillTool_execute`) to keep within Orion’s existing pattern.

**Next step**: Draft an ADR for “Feature 2 Implementation Details: Error Handling and Stuckness Detection” to lock these decisions before coding.
