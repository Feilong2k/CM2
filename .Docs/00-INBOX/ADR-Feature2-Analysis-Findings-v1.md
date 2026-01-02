# ADR: Feature 2 Analysis Findings & Task Mapping

## Context
This ADR consolidates findings from PCC (Plan Verification Protocol), CAP (Constraint Discovery Protocol), and RED (Risk, Error, Dependency) analyses conducted on Feature 2 v3 (Autonomous TDD Workflow with Aider Integration). The goal is to map each finding to specific tasks in Feature 2, ensuring all gaps are addressed during implementation.

## Decision

All findings from the analyses are mapped to the 9 tasks of Feature 2 (2-1 through 2-9). Unmapped items are listed separately for further discussion.

## Analysis Findings Mapped to Tasks

### Task 2-1: Database Extensions for Step Management

| Finding Source | Finding | Mapping | Action Required |
|----------------|---------|---------|-----------------|
| PCC | Database schema must support `context_files` (JSONB array) | 2-1 | Include `context_files` column in `steps` table |
| PCC | ENUM types for `status`, `step_type`, `assigned_to`, `work_stage` must be created before tables | 2-1 | Create ENUM types with `CREATE TYPE IF NOT EXISTS` |
| CAP | Concurrent writes to `steps` table possible (multiple Orion instances) | 2-1 | Design for row-level locking, consider transaction isolation |
| RED | PostgreSQL ENUM creation is a missing primitive | 2-1 | Implement migration script for ENUMs and tables |
| RED | DatabaseTool methods for steps are missing | 2-1 | Implement `create_step`, `update_step`, `get_step`, `list_steps_by_subtask` |

### Task 2-2: Core Helper Services

| Finding Source | Finding | Mapping | Action Required |
|----------------|---------|---------|-----------------|
| PCC | StepDecomposer must validate context files exist | 2-2 | Use FileSystemTool to validate file paths before DB insert |
| PCC | ContextBuilder must read target file and context_files | 2-2 | Build comprehensive prompt including all context file content |
| CAP | File system reads may fail (permissions, missing files) | 2-2 | Implement graceful error handling, skip missing context files |
| RED | StepDecomposer and ContextBuilder classes are missing | 2-2 | Implement both classes with unit tests |

### Task 2-3: Skills Framework Implementation

| Finding Source | Finding | Mapping | Action Required |
|----------------|---------|---------|-----------------|
| PCC | Skill directory must follow YAML+markdown format | 2-3 | Implement validation for SKILL.md frontmatter |
| CAP | Skill loading failure if SKILL.md malformed | 2-3 | Skip invalid skills, log error, continue loading others |
| RED | SkillLoader and execution engine are missing | 2-3 | Implement dynamic skill loading and basic execution |

### Task 2-4: TaraAider Integration

| Finding Source | Finding | Mapping | Action Required |
|----------------|---------|---------|-----------------|
| PCC | Aider CLI must support `--read` and `--add` flags | **Verified by user** | N/A (already confirmed) |
| PCC | Aider response format unspecified (diff vs confirmation) | 2-4 | Rely on Aider's auto‑commit; parse git commit hash for success |
| CAP | Aider network call may time out | 2-4 | Set timeout (e.g., 5 minutes) and kill process on timeout |
| CAP | Aider may exit with non‑zero but have made partial changes | 2-4 | Parse stdout for "Applied changes" and git commit; mark step completed if changes detected |
| RED | TaraAiderInvoker class missing | 2-4 | Implement CLI wrapper with command construction, execution, result parsing |

### Task 2-5: Test Execution Framework

| Finding Source | Finding | Mapping | Action Required |
|----------------|---------|---------|-----------------|
| PCC | Test suite may be flaky, require specific environment | 2-5 | Isolate test environment, retry flaky tests, allow manual override |
| CAP | TestRunner must capture stdout/stderr correctly | 2-5 | Use child_process.spawn with pipe for both streams |
| RED | TestRunner, TestResultParser, TaraTestRunner missing | 2-5 | Implement all three components with modular design |

### Task 2-6: DevonAider Integration

| Finding Source | Finding | Mapping | Action Required |
|----------------|---------|---------|-----------------|
| PCC | Test results must be included in DevonAider prompt | 2-6 | Define schema for test results (JSON) and include in context |
| CAP | Test results may be too large for prompt | 2-6 | Summarize results (top N failures), truncate if necessary |
| RED | DevonAiderInvoker class missing | 2-6 | Implement similar to TaraAiderInvoker but with test result inclusion |

### Task 2-7: Concurrency & Error Handling

| Finding Source | Finding | Mapping | Action Required |
|----------------|---------|---------|-----------------|
| PCC | File locking required to prevent concurrent edits | 2-7 | Implement database‑based locking (preferred) or advisory file locks |
| PCC | Stuckness detection thresholds undefined | 2-7 | Define thresholds: max attempts (e.g., 3), timeout per step (e.g., 10 minutes) |
| CAP | Error‑handling and rollback strategies unspecified | 2-7 | **Revised strategy**: Do NOT use `git reset --hard` automatically; instead create new corrective steps with `parent_step_id` chain |
| CAP | Rollback mechanism needed | 2-7 | Keep `git reset --hard` only for catastrophic failures; use step chaining for iterative refinement |
| RED | FileLockingService, step serialization, retry logic, stuckness detection missing | 2-7 | Implement all four components |

### Task 2-8: Workspace & Git Integration (Post‑MVP)

| Finding Source | Finding | Mapping | Action Required |
|----------------|---------|---------|-----------------|
| PCC | Workspace isolation needed to avoid conflicts with main codebase | 2-8 | Single workspace per project, clone from main repo |
| CAP | Workspace synchronization may cause merge conflicts | 2-8 | Manual review before sync; automated conflict detection |
| RED | WorkspaceManager and sync mechanism missing | 2-8 | Post‑MVP: implement workspace creation, git clone, sync |

### Task 2-9: Integration Probes & E2E Validation

| Finding Source | Finding | Mapping | Action Required |
|----------------|---------|---------|-----------------|
| PCC | Need end‑to‑end test of full TDD cycle | 2-9 | Create integration test: Orion → decomposition → TaraAider → TestRunner → DevonAider → TestRunner |
| RED | Integration test scenarios, smoke tests, performance benchmarking missing | 2-9 | Implement 3‑5 test scenarios, smoke tests for critical paths, collect metrics |

## Cross-Cutting Findings & Locked Decisions

The following cross‑cutting findings have been locked in with the decisions below:

| Finding Source | Finding | Locked Decision |
|----------------|---------|-----------------|
| PCC | Skill execution interface undefined (how does Orion invoke a skill?) | **Progressive disclosure pattern (Claude Code model)**: SkillLoader indexes metadata (name, description) → Orion uses metadata to decide → when skill needed, loads full SKILL.md and executes via `SkillTool_execute`. |
| CAP | Observability beyond traces (logging, monitoring) | **Extend TraceStoreService**: Each service (StepDecomposer, ContextBuilder, AiderInvoker, TestRunner, etc.) must emit standardized trace events for key actions (Aider invocation, test runs, step transitions). |
| RED | Aider CLI abstraction layer (for fallback to interactive mode) | **Shared `AiderClient` abstraction**: Built in Task 2-4, used by both TaraAiderInvoker and DevonAiderInvoker. Handles CLI command construction, execution, timeout, error handling, and fallback to interactive mode. |
| RED | Modular TestResultParser for different test frameworks | **Plugin architecture within Task 2-5**: TestResultParser designed with pluggable parsers for Jest and Vitest (current frameworks). Design allows adding parsers for other frameworks later. |

## Key Decisions Locked

1. **Aider CLI non‑interactive mode**: Verified working with `--read` and `--add` flags.
2. **Error recovery**: Use step chaining (`parent_step_id`) for iterative refinement instead of automatic `git reset --hard`.
3. **File locking**: Prefer database‑based locking for portability and visibility.
4. **Test result formatting**: Structured JSON schema to be included in DevonAider prompts.
5. **Stuckness detection**: Thresholds defined as max attempts (3) and per‑step timeout (10 minutes).

## Next Steps

1. **Proceed with Task 2-1 implementation** (Database extensions) as the foundation.
2. **Address cross‑cutting concerns** (skill execution interface, observability) with separate ADRs before they block implementation.
3. **Follow phased implementation order** (Phase 0: verification, Phase 1: database & core, etc.) as outlined in RED analysis.

## Status

This ADR is ready for review. Once approved, the mapped tasks can be implemented with confidence that all analysis findings have been accounted for.

---
*Created: 2026-01-01*  
*Analyst: Adam (Architect)*  
*Version: 1.0*
