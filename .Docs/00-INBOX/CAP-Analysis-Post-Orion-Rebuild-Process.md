# CAP (Constraint Discovery Protocol) Analysis – Level 3
**Document:** Post‑Orion‑Rebuild‑Process.md  
**Date:** 2025‑12‑30  
**Analyst:** Adam (Architect)

## PART 1: RESOURCE ANALYSIS
| Resource | Current State | Who Uses It | Exclusive/Shared |
|----------|---------------|-------------|------------------|
| PostgreSQL (`steps` table) | Does not exist | StepDecomposer (write), ContextBuilder (read), ResultProcessor (update) | Shared (concurrent writes possible) |
| PostgreSQL (`work_stages` table) | Does not exist | Orion (read/write) | Shared |
| File system (project files) | Existing files | ContextBuilder (read), ResultProcessor (write), Aider (read/write via diff) | Shared (multiple Aiders could touch same file) |
| External Aider (TaraAider/DevonAider) | External service | AiderInvoker (write prompt, read response) | Exclusive per invocation (but network‑shared) |
| Test suite (npm test) | Existing | TestRunner (execute), TestResultParser (read output) | Exclusive (cannot run two test suites simultaneously) |
| Skill directory (`backend/skills/`) | Does not exist | SkillLoader (read) | Shared (read‑only) |
| OrionAgent memory | Volatile | SkillLoader (write), Orion (read) | Exclusive to Orion instance |

## PART 2: OPERATION ANALYSIS (CRITICAL)
| Operation | Physical Change? | Locks? | 2 Actors Simultaneously? |
|-----------|-----------------|--------|--------------------------|
| `db_migration_create_steps` | Yes (creates table) | DB schema lock | No (migration runs once) |
| `StepDecomposer.write_step` | Yes (INSERT) | Row‑level lock (if concurrent) | Possibly (if multiple Orion instances) |
| `ContextBuilder.read_file` | No (read) | File read lock | Yes (multiple readers OK) |
| `ResultProcessor.apply_diff` | Yes (file write) | File write lock | No (must be exclusive) |
| `AiderInvoker.call_aider` | No (network) | None | Yes (multiple Aider calls can run in parallel) |
| `TestRunner.execute` | Yes (spawns process) | Process lock (port conflicts) | No (cannot run two test suites on same port) |
| `SkillLoader.load_skill` | No (read) | None | Yes (multiple reads OK) |

## PART 3: ACTOR ANALYSIS
| Actor | Resources They Touch | Same Resource Same Time? |
|-------|---------------------|--------------------------|
| Orion (main) | PostgreSQL (`steps`), File system, Aider, Test suite, Skill directory | Yes – could touch same file as Aider (via ResultProcessor) |
| TaraAider | File system (via diff) | Possibly same file as DevonAider (if steps overlap) |
| DevonAider | File system (via diff) | Possibly same file as TaraAider |
| TestRunner | Test suite, file system (test artifacts) | Exclusive (should not run while file is being written) |

## PART 4: ASSUMPTION AUDIT (minimum 10)
| # | Assumption | Explicit/Implicit | Breaks if FALSE | Risk |
|---|------------|-------------------|-----------------|------|
| 1 | Aider returns a valid unified diff | Implicit | ResultProcessor cannot apply diff | High |
| 2 | File system is stable during Aider invocation | Implicit | File changed externally → diff invalid | Medium |
| 3 | PostgreSQL is available and responsive | Explicit | StepDecomposer/ContextBuilder fail | High |
| 4 | Test suite is deterministic and passes | Implicit | TestRunner returns failure → workflow stalls | Medium |
| 5 | Skill directory follows YAML+markdown format | Explicit | SkillLoader fails to parse | Medium |
| 6 | Orion has enough memory to load skills | Implicit | Memory overflow → crash | Low |
| 7 | Aider network call completes within timeout | Implicit | AiderInvoker hangs → workflow stuck | Medium |
| 8 | Only one Orion instance runs at a time | Implicit | Concurrent writes to `steps` cause conflicts | High |
| 9 | File paths in steps are valid and accessible | Implicit | ContextBuilder fails → step blocked | Medium |
|10 | User will review and approve Aider changes | Implicit | Aider makes breaking change → regression | High |
|11 | Aider understands the project’s coding standards | Implicit | Generated code violates style → tests fail | Medium |
|12 | TestRunner can capture stdout/stderr correctly | Implicit | TestResultParser gets incomplete data | Low |

## PART 5: PHYSICAL VS LOGICAL CHECK (CRITICAL)
| Claimed Separation | Mechanism | Physical/Logical | If Mechanism Fails? |
|-------------------|-----------|------------------|---------------------|
| “TaraAider and DevonAider work separately” | Different prompt targets | Logical | Same file system → physical conflict |
| “Steps are isolated by file path” | File path uniqueness | Logical | Two steps target same file → physical conflict |
| “Test execution is separate from implementation” | Different processes | Physical (separate process) | Shares same file system (test reads implementation file) |
| “Skills are loaded on demand” | File read + memory load | Logical | Same memory space as Orion → physical memory constraint |

**Key finding**: Multiple Aiders (or steps) can target the **same physical file** simultaneously, causing write conflicts. No locking mechanism is specified.

## PART 6: GAP ANALYSIS (CRITICAL)
What is NOT SPECIFIED in this plan?

| Gap | Possible Interpretations | Answer Under Each |
|-----|-------------------------|-------------------|
| **Aider response format** | A: Unified diff<br>B: Confirmation message<br>C: Error | A → ResultProcessor applies diff; B → mark step done; C → retry/error handling |
| **Error handling** | A: Retry with backoff<br>B: Fallback to manual<br>C: Abort workflow | A → implement retry logic; B → notify user; C → rollback changes |
| **Concurrency control** | A: Serialize steps<br>B: Lock files<br>C: Allow conflicts, detect later | A → queue; B → file locks; C → conflict detection & merge |
| **Rollback mechanism** | A: Keep backup copy<br>B: Use git revert<br>C: No rollback | A → copy file before edit; B → git command; C → manual recovery |
| **Skill versioning** | A: Timestamp in SKILL.md<br>B: Git tags<br>C: No versioning | A → load latest; B → pin to tag; C → risk of breaking changes |
| **Observability beyond traces** | A: Log to file<br>B: Store in DB<br>C: Only CLI output | A → log file; B → new table; C → limited debugging |

## PART 7: CONDITIONAL VERDICT
- **IF** Aider returns a valid unified diff, error handling is implemented, and file‑level locking is added → **SAFE**.
- **IF** Aider response format is unspecified, no error handling, and concurrent file writes allowed → **UNSAFE** (high risk of data corruption).

**Gaps that MUST be clarified before implementation:**
1. **Aider response contract** – must define exact expected format (e.g., unified diff with header).
2. **Concurrency control** – decide how to prevent two steps from editing the same file simultaneously.
3. **Error‑handling flow** – specify retry, fallback, and rollback strategies.
4. **Rollback mechanism** – how to revert a failed step’s file changes.
5. **Skill validation** – ensure SKILL.md is parseable and contains required fields.

## FINAL VERDICT
**CONDITIONALLY SAFE** – the plan outlines a viable architecture, but **critical physical constraints** (file‑level conflicts, Aider response format, error handling) are not addressed. Without these, the system is prone to data corruption and workflow deadlocks.

**Recommended mitigations:**
1. Implement a **file‑lock service** (or use git locking) to prevent concurrent edits.
2. Define a **strict Aider response schema** and validate before applying.
3. Add **step‑level rollback** (backup file before edit, restore on failure).
4. Design **error‑handling state machine** for steps (pending → in‑progress → completed/failed/retry).
5. Create **skill validation script** that runs on load.

**Next step**: Draft an ADR for “Aider Orchestration Concurrency & Error Handling” to lock these decisions.
