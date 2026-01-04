# RED (Risk, Error, Dependency) Analysis - Expanded Tables
**Document:** Feature2_Skills_Aider_Integration_v3.md (v3.0)  
**Date:** 2026-01-01  
**Analyst:** Adam (Architect)  
**Analysis Type:** AI-Assisted RED with Expanded Breakdown Tables  
**Model:** GPT-4.1-mini (simulated for 128K+ context)

## 1. RISK ANALYSIS (Summary)
*Same as previous RED analysis - see RED-Analysis-Feature2_v3.md for detailed risk tables.*

## 2. RED BREAKDOWN — EXPANDED TABLES

### 2.1. Level 1 → Level 2 Decomposition

#### Level 1: Implement Feature 2 - Autonomous TDD Workflow with Aider Integration

| L1 Action (Parent) | L2 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| Implement Feature 2 | 2-1: Database Extensions for Step Management | PostgreSQL, Migration scripts, DatabaseTool | Existing `projects`, `features`, `tasks`, `subtasks` tables | `steps` and `work_stages` tables with ENUMs | ✗ | NEED_Verification |
| Implement Feature 2 | 2-2: Core Helper Services | FileSystemTool, DatabaseTool, Node.js runtime | Steps table (from 2-1), file system access | StepDecomposer, ContextBuilder services | ✗ | NEED_Verification |
| Implement Feature 2 | 2-3: Skills Framework Implementation | File system (`backend/skills/`), Node.js runtime | Skill directory structure, YAML parser | SkillLoader, skill execution engine | ✗ | NEED_Verification |
| Implement Feature 2 | 2-4: TaraAider Integration | Aider CLI, Git, File system | Step records, ContextBuilder output, Aider installation | TaraAiderInvoker service | ✗ | NEED_Verification |
| Implement Feature 2 | 2-5: Test Execution Framework | Test suite (Jest/Vitest), Node.js child processes | Test files, package.json scripts | TestRunner, TestResultParser, TaraTestRunner | ✗ | NEED_Verification |
| Implement Feature 2 | 2-6: DevonAider Integration | Aider CLI, Git, Test results | Step records, TestRunner output, ContextBuilder | DevonAiderInvoker service | ✗ | NEED_Verification |
| Implement Feature 2 | 2-7: Concurrency & Error Handling | File system locks, Database, Git | All previous services | FileLockingService, step serialization, error recovery | ✗ | NEED_Verification |
| Implement Feature 2 | 2-8: Workspace & Git Integration (Post-MVP) | Git repository, workspace directory | Main codebase repo, Git credentials | WorkspaceManager, sync mechanism | ✗ | NEED_Verification |
| Implement Feature 2 | 2-9: Integration Probes & E2E Validation | All services, test scenarios | Completed Tasks 2-1 through 2-7 | Integration test suite, performance metrics | ✗ | NEED_Verification |

### 2.2. Level 2 → Level 3 Decomposition (Selected Deep Dives)

#### 2.2.1. Task 2-1: Database Extensions for Step Management

| L2 Action (Parent) | L3 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| 2-1: Database Extensions | Create ENUM types in PostgreSQL | PostgreSQL, SQL migration | Database connection, admin privileges | `step_type`, `step_status`, `assigned_agent`, `work_stage_type` ENUMs | ✓ | MISSING |
| 2-1: Database Extensions | Create `steps` table | PostgreSQL, SQL migration | ENUM types (from above) | `steps` table with all specified columns | ✓ | MISSING |
| 2-1: Database Extensions | Create `work_stages` table | PostgreSQL, SQL migration | ENUM types | `work_stages` table | ✓ | MISSING |
| 2-1: Database Extensions | Update foreign key relationships | PostgreSQL, SQL migration | Existing `projects`, `features`, `tasks`, `subtasks` tables | Updated schema with proper constraints | ✓ | MISSING |
| 2-1: Database Extensions | Create DatabaseTool methods | Node.js, DatabaseTool | New tables, existing tool framework | `create_step`, `update_step`, `get_step`, `list_steps_by_subtask` | ✗ | MISSING |

#### 2.2.2. Task 2-2: Core Helper Services

| L2 Action (Parent) | L3 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| 2-2: Core Helpers | Implement StepDecomposer class | Node.js, FileSystemTool, DatabaseTool | Steps table, file system validation | StepDecomposer with `decompose()` method | ✗ | MISSING |
| 2-2: Core Helpers | Implement ContextBuilder class | Node.js, FileSystemTool | Target file, context_files array | ContextBuilder with `buildContext(stepId)` method | ✗ | MISSING |
| 2-2: Core Helpers | Design Orion-StepDecomposer JSON interface | Specification document | Feature 2 v3 spec | JSON schema for step decomposition | ✓ | VERIFIED_HAVE (in spec) |
| 2-2: Core Helpers | Create unit tests for helpers | Jest, test framework | StepDecomposer, ContextBuilder implementations | Test suite with mock dependencies | ✗ | MISSING |

#### 2.2.3. Task 2-4: TaraAider Integration

| L2 Action (Parent) | L3 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| 2-4: TaraAider Integration | Verify Aider CLI supports `--read` and `--add` | System PATH, Aider installation | Aider binary, test project | Verification report, version check | ✓ | NEED_Verification |
| 2-4: TaraAider Integration | Implement TaraAiderInvoker class | Node.js child_process, DatabaseTool | ContextBuilder output, step record | TaraAiderInvoker with `invoke(stepId)` method | ✗ | MISSING |
| 2-4: TaraAider Integration | Construct Aider CLI command | String templating, file paths | Context files array, target file path, instructions | CLI command string | ✓ | VERIFIED_HAVE (pattern in spec) |
| 2-4: TaraAider Integration | Execute CLI and capture output | child_process.spawn, stdout/stderr | CLI command, working directory | Process result (exit code, output, git commit hash) | ✓ | MISSING |
| 2-4: TaraAider Integration | Update step status based on result | DatabaseTool, steps table | Process result, step ID | Updated step record (status, attempt_count, last_error) | ✓ | MISSING |

#### 2.2.4. Task 2-7: Concurrency & Error Handling

| L2 Action (Parent) | L3 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| 2-7: Concurrency | Implement FileLockingService | File system, advisory locks | File paths, lock directory | FileLockingService with `lock(filePath)`, `unlock(filePath)` | ✗ | MISSING |
| 2-7: Concurrency | Implement Step Serialization | Database, locking service | Steps targeting same file | Serialized execution queue | ✗ | MISSING |
| 2-7: Error Handling | Implement retry logic | Steps table (attempt_count) | Failed step, max attempts config | Retry with exponential backoff | ✗ | MISSING |
| 2-7: Error Handling | Implement stuckness detection | Steps table, error patterns | Attempt_count, last_error, timestamps | Stuck step identification, escalation | ✗ | MISSING |
| 2-7: Error Handling | Implement rollback via Git | Git CLI, workspace | Failed step, git repository | `git reset --hard` to previous commit | ✓ | MISSING |

### 2.3. Level 3 → Level 4 Decomposition (Critical Primitives)

#### 2.3.1. Create ENUM types in PostgreSQL (from 2-1)

| L3 Action (Parent) | L4 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| Create ENUM types | Connect to PostgreSQL | Node.js pg client, .env config | Database credentials, host, port | Database connection object | ✓ | VERIFIED_HAVE (DatabaseTool exists) |
| Create ENUM types | Execute CREATE TYPE SQL | PostgreSQL, SQL execution | Connection, admin privileges | ENUM types created or existing verified | ✓ | MISSING |
| Create ENUM types | Handle existing types | PostgreSQL, error handling | SQL with `IF NOT EXISTS` | Graceful continuation if types exist | ✓ | MISSING |
| Create ENUM types | Log creation result | Logging system | Success/failure status | Audit log entry | ✓ | VERIFIED_HAVE (TraceService exists) |

#### 2.3.2. Verify Aider CLI supports `--read` and `--add` (from 2-4)

| L3 Action (Parent) | L4 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| Verify Aider CLI | Check Aider in PATH | System PATH, which command | Aider installation | Aider binary path or null | ✓ | MISSING |
| Verify Aider CLI | Execute `aider --version` | child_process.spawn | Aider binary | Version string output | ✓ | MISSING |
| Verify Aider CLI | Test `--read` flag with dummy file | child_process.spawn, temp file | Aider binary, test file | Exit code and output | ✓ | MISSING |
| Verify Aider CLI | Test `--add` flag with dummy file | child_process.spawn, temp file | Aider binary, test file | Exit code and output | ✓ | MISSING |
| Verify Aider CLI | Parse and validate response | String parsing, regex | CLI output | Validation result (supported/unsupported) | ✓ | MISSING |

#### 2.3.3. Execute CLI and capture output (from 2-4)

| L3 Action (Parent) | L4 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| Execute CLI | Spawn child process | child_process.spawn, working dir | CLI command, cwd | Child process object | ✓ | VERIFIED_HAVE (Node.js built-in) |
| Execute CLI | Capture stdout/stderr | Stream buffers | Child process | Collected output strings | ✓ | VERIFIED_HAVE (Node.js built-in) |
| Execute CLI | Set timeout | setTimeout, process kill | Timeout configuration | Process termination on timeout | ✓ | VERIFIED_HAVE (Node.js built-in) |
| Execute CLI | Parse git commit hash | Regex on stdout | CLI output | Commit hash or null | ✓ | MISSING |
| Execute CLI | Determine success/failure | Exit code, output parsing | Exit code, stdout, stderr | Success boolean, error message | ✓ | MISSING |

## 3. MISSING FUNDAMENTALS IDENTIFICATION

Based on the expanded tables above, the following primitives are marked as **MISSING** or **NEED_Verification**:

### 3.1. Critical Missing Primitives (Blocking)

1. **PostgreSQL ENUM creation** (`MISSING`)
   - SQL execution for `CREATE TYPE ... IF NOT EXISTS`
   - Error handling for existing types

2. **Aider CLI verification** (`NEED_Verification` → `MISSING` until verified)
   - Check Aider in PATH
   - Test `--read` and `--add` flags work
   - Parse version compatibility

3. **Git integration for rollback** (`MISSING`)
   - `git reset --hard` execution
   - Commit hash extraction from Aider output

4. **File locking implementation** (`MISSING`)
   - Advisory lock mechanism
   - Lock timeout and cleanup

### 3.2. Missing Service Implementations

1. **StepDecomposer class** (`MISSING`)
   - JSON schema validation
   - File existence validation via FileSystemTool
   - Database insertion via DatabaseTool

2. **ContextBuilder class** (`MISSING`)
   - File content reading via FileSystemTool
   - Context assembly with instructions and history
   - Token management for prompt size

3. **TaraAiderInvoker/DevonAiderInvoker classes** (`MISSING`)
   - CLI command construction
   - Process execution with timeout
   - Result parsing and status update

4. **TestRunner and TestResultParser** (`MISSING`)
   - Test suite execution
   - Output parsing for different test frameworks

### 3.3. Verification Required

1. **Aider CLI flag support** (`NEED_Verification`)
   - Must verify before implementation can proceed

2. **PostgreSQL ENUM compatibility** (`NEED_Verification`)
   - Verify `CREATE TYPE IF NOT EXISTS` works with target PostgreSQL version

## 4. DEPENDENCY GRAPH VISUALIZATION

```
[Feature 1: Orion Rebuild] (VERIFIED_HAVE)
    ├── DatabaseTool (VERIFIED_HAVE)
    ├── FileSystemTool (VERIFIED_HAVE)
    └── OrionAgent (VERIFIED_HAVE)
    
[Task 2-1: Database Extensions] (NEED_Verification)
    ├── Create ENUM types (MISSING)
    ├── Create steps table (MISSING)
    ├── Create work_stages table (MISSING)
    └── DatabaseTool methods (MISSING)
    
[Task 2-2: Core Helpers] (NEED_Verification)
    ├── StepDecomposer (MISSING) ← depends on 2-1
    └── ContextBuilder (MISSING) ← depends on FileSystemTool
    
[Task 2-4: TaraAider Integration] (NEED_Verification)
    ├── Verify Aider CLI (NEED_Verification)
    ├── TaraAiderInvoker (MISSING) ← depends on 2-2
    └── CLI execution (VERIFIED_HAVE primitives)
    
[Task 2-7: Concurrency] (NEED_Verification)
    ├── FileLockingService (MISSING)
    └── Git rollback (MISSING) ← depends on Git CLI
```

## 5. RECOMMENDED IMPLEMENTATION ORDER

### Phase 0: Verification & Primitives (Week 1)
1. **Verify Aider CLI** - Confirm `--read` and `--add` flags work
2. **Create PostgreSQL ENUMs** - Implement migration script
3. **Test Git integration** - Verify `git reset --hard` works in workspace

### Phase 1: Database & Core (Week 2-3)
1. **Task 2-1** - Complete all database extensions
2. **Task 2-2** - Implement StepDecomposer and ContextBuilder
3. **Basic unit tests** for both services

### Phase 2: Aider Integration (Week 4-5)
1. **Task 2-4** - Implement TaraAiderInvoker with verified CLI
2. **Task 2-5** - Implement TestRunner for immediate feedback
3. **Task 2-6** - Implement DevonAiderInvoker with test results

### Phase 3: Robustness & Validation (Week 6-7)
1. **Task 2-7** - Implement concurrency and error handling
2. **Task 2-9** - Create integration probes and E2E tests

### Phase 4: Post-MVP (Future)
1. **Task 2-8** - Workspace & Git integration

## 6. RISK ASSESSMENT UPDATE

Based on the expanded decomposition:

### High-Risk Items Identified:
1. **Aider CLI compatibility** - If `--read`/`--add` flags don't work, entire design changes
2. **File locking across processes** - Advisory locks may not work in all environments
3. **Test output parsing** - Different test frameworks produce different output formats

### Mitigation Strategies:
1. **Create Aider CLI abstraction layer** - Allow fallback to interactive mode
2. **Implement database-based locking as backup** - Use `steps` table for coordination
3. **Modular TestResultParser** - Plugins for different test frameworks

## 7. CONCLUSION

The expanded RED analysis reveals **23 distinct primitive actions** that need implementation, with **15 marked as MISSING** and **4 requiring verification**. The critical path starts with verifying Aider CLI compatibility and creating PostgreSQL ENUM types.

**Immediate Next Actions:**
1. Execute Aider CLI verification script
2. Create PostgreSQL migration for ENUM types
3. Draft ADR for file locking strategy

**Overall Status:** Feature 2 is **feasible but complex**, with clear implementation steps identified through systematic decomposition.
