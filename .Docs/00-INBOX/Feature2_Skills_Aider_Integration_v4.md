# Feature 2 Specification: Aider Orchestration & Skills Framework (v4.0)

## Overview
**Title:** Autonomous TDD Workflow with Aider Integration  
**Objective:** Enable Orion to coordinate TaraAider (testing) and DevonAider (implementation) through a structured skills framework and helper services, following the progressive disclosure pattern inspired by Claude Code.  
**Priority:** High - Enables autonomous development workflow  
**Estimated Complexity:** High (requires careful orchestration and concurrency management)  
**Revision:** v4.0 - Incorporates locked decisions from PCC, CAP, RED analyses and ADR mapping

## Core Problem Statement
Orion can decompose features and manage tasks, but cannot delegate single-file implementation/testing work to specialized Aider agents. This specification implements the helper services and database extensions needed for Orion to orchestrate TaraAider and DevonAider in a TDD workflow.

## Key Constraints (From Post-Orion-Rebuild Document)
1. **Aiders cannot read files** - Context must be provided in prompts
2. **Aiders cannot run tests** - Separate test runner needed
3. **Concurrent file edits risk** - Need file locking or serialization
4. **Aider response format unspecified** - Need standardized schema
5. **No error handling/rollback** - Need robust failure recovery

## TDD-First Rationale
While traditional TDD suggests writing tests first, our MVP approach **starts with TaraAider** because:
1. **Validation First**: We need to verify our orchestration framework works with simpler test creation before complex implementation
2. **Lower Risk**: Test file creation is less likely to break existing functionality
3. **Immediate Feedback**: We can validate the entire pipeline (decomposition → context building → Aider invocation → result processing) with test files
4. **Foundation for DevonAider**: Once TaraAider works, DevonAider can use the same proven framework

## Aider Non-Interactive CLI Mode (Key Design Decision)
**Command Pattern**: `aider --read [context_files...] --add [file_path] "[instructions]"`  
**Example**: `aider --read tests/x.spec.js --add src/x.js "Implement the TODO comment"`

**Benefits**:
- **Direct file modification**: Aider applies changes directly (no diff parsing needed)
- **Git integration**: Aider auto-commits with descriptive messages
- **Undo capability**: `/undo` command available through git integration
- **Non-interactive**: Perfect for automated orchestration

**Impact on Design**:
- Eliminates `TestResultProcessor` and `ImplementationResultProcessor`
- Simplifies `TaraAiderInvoker` and `DevonAiderInvoker` to simple CLI wrappers
- Reduces complexity and potential failure points

## Workspace Strategy (Revised)
**Single Isolated Workspace**:
- Located outside main codebase (e.g., `workspaces/{project-id}/`)
- Git-enabled for Aider's auto‑commit and undo capability
- File synchronization with main codebase only when steps succeed
- **No separate Tara/Devon workspaces** – simpler concurrency management via step serialization

**Benefits**:
- Avoids complex synchronization between multiple agent workspaces
- Leverages Aider's built‑in git integration for rollback
- Reduces overhead while maintaining isolation from main development branch

## Database Schema

### `steps` Table
Stores decomposition of subtasks into single-file steps.

**Columns**:
- `id` - Primary key
- `project_id` - References projects table
- `subtask_id` - Foreign key to `subtasks` table only (not features or tasks)
- `step_number` - Sequential order within subtask
- `step_type` - ENUM('implementation', 'test')
- `file_path` - Target file to edit (single path per step) – **relative to project root**
- `instructions` - Step-specific instructions for Aider
- `status` - ENUM('pending', 'in_progress', 'completed', 'failed')
- `assigned_to` - ENUM('TaraAider', 'DevonAider')
- `context_snapshot` - JSON metadata (file hashes, modification timestamps) - no file content
- `context_files` - JSONB array of file paths to include as context (e.g., test file for implementation steps, implementation file for test steps)
- **`attempt_count`** - INTEGER DEFAULT 0 (tracks retries)
- **`last_error`** - TEXT (stores error message from failed attempts)
- **`parent_step_id`** - INTEGER (references `steps.id` for step dependencies/chaining)
- `created_at`, `updated_at` - Timestamps

**Usage Example**:
- Devon's implementation step for `src/x.js` → `file_path: 'src/x.js'`, `context_files: ['tests/x.spec.js']`
- Tara's test step for `tests/x.spec.js` → `file_path: 'tests/x.spec.js'`, `context_files: ['src/x.js']` (if implementation exists)

### `work_stages` Table (Optional)
Tracks overall progression of a feature/task through phases.

**Columns**:
- `id` - Primary key
- `feature_id` or `task_id` - Reference to parent item
- `work_stage` - ENUM('pending', 'analysis', 'unit_testing', 'unit_implementation', 'integration_testing','integration_implementation', 'review', 'completed')
- `started_at`, `completed_at` - Timestamps
- `assigned_agent` - Optional agent responsible for current stage

**Integration Responsibility**:
- **Unit Testing/Implementation**: Tara creates unit tests, Devon implements unit code
- **Integration Testing/Implementation**: Tara creates integration tests first (failing), Devon implements integration code to make tests pass

## Task Breakdown with Subtasks

### Task 2-1: Database Extensions for Step Management
**Description:** Create database tables to track single-file steps and work stages for Aider orchestration.

**Subtasks**:
1. **2-1-1: Create PostgreSQL ENUM types** - Use `CREATE TYPE IF NOT EXISTS` for `step_type`, `status`, `assigned_to`, `work_stage`.
2. **2-1-2: Create `steps` table** - With all specified columns including `context_files` (JSONB array), `attempt_count`, `last_error`, `parent_step_id`.
3. **2-1-3: Create `work_stages` table** - For optional tracking of feature/task progression.
4. **2-1-4: Update foreign key relationships** - Link to existing `projects`, `features`, `tasks`, `subtasks` tables.
5. **2-1-5: Create DatabaseTool methods** - `create_step`, `update_step`, `get_step`, `list_steps_by_subtask`, `get_steps_by_status`.
6. **2-1-6: Write migration tests** - Verify ENUM creation, table structure, and CRUD operations.

**Acceptance Criteria**:
1. Database migrations created and tested
2. Steps can be created, updated, and queried via DatabaseTool
3. Steps support retry tracking, error logging, and parent‑child relationships
4. All CRUD operations work correctly

**Dependencies:** Feature 1 (DatabaseTool integration)  
**Estimated Complexity:** Medium

---

### Task 2-2: Core Helper Services
**Description:** Build the essential helper services for step decomposition and context building.

**Subtasks**:
1. **2-2-1: Implement StepDecomposer class** - Takes Orion's structured JSON decisions, validates context files exist via FileSystemTool, creates `steps` records in database.
2. **2-2-2: Implement ContextBuilder class** - Reads target file and all `context_files` via FileSystemTool, builds comprehensive prompt for Aider including step instructions and acceptance criteria.
3. **2-2-3: Design Orion-StepDecomposer JSON interface** - Define and document schema for step decomposition input.
4. **2-2-4: Add error handling** - Graceful handling of missing context files, permission errors, large files.
5. **2-2-5: Create unit tests** - For StepDecomposer and ContextBuilder with mock dependencies.
6. **2-2-6: Add trace events** - Emit standardized trace events for decomposition and context building.

**Acceptance Criteria**:
1. StepDecomposer can create steps based on Orion's decisions (file paths, context files)
2. ContextBuilder generates comprehensive context using both target file and context files
3. Both services integrate with existing DatabaseTool and FileSystemTool
4. Context includes all necessary information for Aiders to work effectively

**Dependencies:** Task 2-1 (Database extensions)  
**Estimated Complexity:** Medium

---

### Task 2-3: Skills Framework Implementation
**Description:** Implement the skills framework following Claude Code's progressive disclosure pattern.

**Subtasks**:
1. **2-3-1: Design skill directory structure** - `backend/skills/aider_orchestration/` with `SKILL.md` (YAML frontmatter + markdown instructions), `/scripts`, `/references`.
2. **2-3-2: Implement SkillLoader** - Indexes skill metadata (name, description, parameters) from YAML frontmatter of all `SKILL.md` files.
3. **2-3-3: Implement SkillTool_execute tool** - Generic tool that loads full skill instructions and executes them.
4. **2-3-4: Create skill validation** - Validate SKILL.md format and required fields, skip invalid skills.
5. **2-3-5: Implement basic skill execution engine** - Framework for executing skills with proper context.
6. **2-3-6: Create example skills** - Simple "hello world" skill to demonstrate the pattern.
7. **2-3-7: Add skill discovery to Orion's context** - Inject skill metadata into Orion's prompt.

**Acceptance Criteria**:
1. Skills can be added to directory and automatically discovered
2. Orion can load and execute skills dynamically via `SkillTool_execute`
3. SKILL.md format is validated with clear error messages
4. Basic skill execution engine works with mock skills

**Dependencies:** Tasks 2-1 & 2-2 (Database and core helpers)  
**Estimated Complexity:** High

---

### Task 2-4: TaraAider Integration (Phase 1)
**Description:** Create services to invoke TaraAider for test file creation using Aider's non-interactive CLI mode.

**Subtasks**:
1. **2-4-1: Implement AiderClient abstraction** - Shared class for constructing CLI commands, executing with timeout, parsing output, handling errors.
2. **2-4-2: Implement TaraAiderInvoker class** - Uses AiderClient to execute `aider --read [context_files...] --add [file_path] "[instructions]"`.
3. **2-4-3: Parse Aider output** - Extract git commit hash, detect success/failure beyond exit code.
4. **2-4-4: Update step status** - On success/failure, update step record (status, attempt_count, last_error).
5. **2-4-5: Create TaraAiderOrchestration skill** - Skill that wraps TaraAiderInvoker for Orion to execute.
6. **2-4-6: Add trace events** - Log Aider invocation, command, output, and results.
7. **2-4-7: Write integration tests** - Test with mock Aider CLI.

**Acceptance Criteria**:
1. TaraAiderInvoker can successfully call Aider with `--read` and `--add` flags
2. Changes are applied directly by Aider (no separate diff processing)
3. Success/failure determined by Aider exit code and output parsing; errors captured in database
4. All interactions logged in database (including git commit hashes)

**Dependencies:** Task 2-3 (Skills Framework)  
**Estimated Complexity:** Medium

---

### Task 2-5: Test Execution Framework
**Description:** Build test running and result parsing capabilities since Aiders cannot run tests.

**Subtasks**:
1. **2-5-1: Implement TestRunner class** - Modular service that executes project test suite or single tests (`npm test`, `jest`, specific files).
2. **2-5-2: Implement TestResultParser with plugin architecture** - Pluggable parsers for Jest and Vitest; extracts pass/fail, errors, stack traces.
3. **2-5-3: Implement TaraTestRunner** - Specialized helper for TaraAider's TDD loop, provides test context and conversation history.
4. **2-5-4: Add flaky test handling** - Retry logic, isolation, manual override.
5. **2-5-5: Define test result schema** - Structured JSON for inclusion in DevonAider prompts.
6. **2-5-6: Add trace events** - Log test execution, results, and parsing outcomes.
7. **2-5-7: Create unit and integration tests** - For TestRunner and TestResultParser.

**Acceptance Criteria**:
1. TestRunner can execute tests and capture results
2. TestResultParser extracts actionable information from test output
3. TaraTestRunner supports iterative TDD workflow
4. Test results are properly stored and can be fed back to Aiders

**Dependencies:** Task 2-4 (TaraAider Integration)  
**Estimated Complexity:** Medium

---

### Task 2-6: DevonAider Integration (Phase 2)
**Description:** Create services to invoke DevonAider for implementation file changes using Aider's non-interactive CLI mode.

**Subtasks**:
1. **2-6-1: Implement DevonAiderInvoker class** - Uses shared AiderClient from Task 2-4, includes test results in prompt.
2. **2-6-2: Integrate test results into prompt** - Use test result schema from Task 2-5 to provide TDD feedback.
3. **2-6-3: Create DevonAiderOrchestration skill** - Skill that wraps DevonAiderInvoker for Orion to execute.
4. **2-6-4: Implement step chaining** - Use `parent_step_id` to link corrective steps for iterative refinement.
5. **2-6-5: Add trace events** - Log DevonAider invocation and results.
6. **2-6-6: Write integration tests** - Test with mock Aider CLI and test results.

**Acceptance Criteria**:
1. DevonAiderInvoker can successfully call Aider with `--read` and `--add` flags
2. Test results are included in the prompt context for TDD feedback
3. Success/failure determined by Aider exit code; errors captured in database
4. Integration with TaraTestRunner for TDD feedback loop

**Dependencies:** Task 2-5 (Test Framework - for TDD feedback)  
**Estimated Complexity:** Medium

---

### Task 2-7: Concurrency & Error Handling
**Description:** Implement robust concurrency management and error recovery.

**Subtasks**:
1. **2-7-1: Implement FileLockingService** - Database‑based locking using `file_locks` table (preferred) with advisory lock fallback.
2. **2-7-2: Implement Step Serialization** - Ensure steps targeting same file execute sequentially using locking.
3. **2-7-3: Implement retry logic** - Based on `attempt_count` with exponential backoff (max 3 attempts).
4. **2-7-4: Implement stuckness detection** - Identify when Aiders are making no progress (based on error patterns, attempt counts, timeout of 10 minutes).
5. **2-7-5: Implement error recovery** - Step chaining (`parent_step_id`) for iterative refinement; keep `git reset --hard` only for catastrophic failures.
6. **2-7-6: Add escalation mechanisms** - Notify human when stuck or after max attempts.
7. **2-7-7: Write comprehensive tests** - For locking, serialization, retry, and stuckness detection.

**Acceptance Criteria**:
1. No data corruption from concurrent file edits
2. Failed steps can be retried (with attempt tracking) or escalated
3. System detects stuck workflows and escalates appropriately
4. All errors are logged with sufficient context for debugging

**Dependencies:** All previous tasks  
**Estimated Complexity:** High

---

### Task 2-8: Workspace & Git Integration (Post‑MVP)
**Description:** **Post‑MVP** – Create a single isolated workspace with git synchronization to main codebase.

**Subtasks**:
1. **2-8-1: Implement WorkspaceManager** - Creates isolated workspace `workspaces/{project-id}/`, clones project repository.
2. **2-8-2: Integrate with AiderClient** - Ensure Aider operates within workspace and auto‑commits.
3. **2-8-3: Implement sync mechanism** - Synchronize successful changes back to main codebase (manual review first).
4. **2-8-4: Implement git rollback** - Use `git reset --hard` for catastrophic failures in workspace.
5. **2-8-5: Write tests** - For workspace creation, git operations, and sync.

**Acceptance Criteria**:
1. Workspace can be created and initialized with git clone
2. Aider operates within workspace and auto‑commits
3. Successful changes can be synchronized to main codebase
4. Git reset used for rollback

**Dependencies:** Task 2-7 (Concurrency & Error Handling)  
**Status:** Post‑MVP (Nice to Have)  
**Estimated Complexity:** Medium

---

### Task 2-9: Integration Probes & E2E Validation
**Description:** Create comprehensive test scenarios and final end‑to‑end validation.

**Subtasks**:

**2-9-1: Define Integration Test Scenarios**
- Define 3‑5 integration test scenarios (simple to complex)
- Examples: create test for new function, implement function, fix failing test, refactor with tests
- Document expected outcomes and success criteria

**2-9-2: Implement Smoke Tests for Critical Paths**
- Create smoke tests for: database operations, ContextBuilder, StepDecomposer, Aider invocation
- Ensure critical services can be instantiated and basic functions work

**2-9-3: End‑to‑End Test**
- Full TDD cycle: Orion receives subtask → decomposes → TaraAider creates test → TestRunner runs test (failing) → DevonAider implements → TestRunner passes → step completion
- Validate entire pipeline with real Aider agents

**2-9-4: Performance Benchmarking & Metrics Collection**
- Measure step completion time, success rates, error recovery effectiveness
- Collect metrics against success targets (80% step completion, 90% error recovery)
- Produce report with recommendations for improvement

**Acceptance Criteria**:
1. Integration test scenarios documented and executable
2. Smoke tests pass for all critical components
3. End‑to‑end test completes successfully
4. Performance metrics collected and reported

**Dependencies:** Tasks 2-1 through 2-7 (Core functionality)  
**Estimated Complexity:** Medium

## Success Metrics
1. **Step Completion Rate:** >80% of steps completed without manual intervention
2. **Test Pass Rate:** Maintain or improve existing test pass rates
3. **Error Recovery:** >90% of errors handled automatically
4. **Development Velocity:** 2x faster subtask completion

## Risks & Mitigations
- **Risk:** Aider response format inconsistencies
  - **Mitigation:** Strict schema validation and fallback parsing
- **Risk:** Concurrent file edit conflicts
  - **Mitigation:** File locking and step serialization
- **Risk:** Test execution performance issues
  - **Mitigation:** Test subset execution and caching
- **Risk:** Skill validation failures
  - **Mitigation:** Comprehensive validation with clear error messages

## Dependencies
- Feature 1 (Orion Rebuild) complete and stable
- DatabaseTool and FileSystemTool fully functional
- Aider agents (TaraAider, DevonAider) available and configured

## Implementation Order (Phased Approach)
**Phase 0: Verification & Primitives (Week 1)**
1. Verify Aider CLI compatibility (already done)
2. Create PostgreSQL ENUM migration
3. Test Git integration basics

**Phase 1: Foundation & Test Creation (MVP Weeks 2-3)**
1. **2-1: Database extensions** (Foundation)
2. **2-2: Core helpers** (Decomposition & Context)
3. **2-3: Skills Framework** (Basic implementation)
4. **2-4: TaraAider Integration** (Test file creation)

**Phase 2: TDD Workflow (MVP Weeks 4-5)**
5. **2-5: Test Framework** (Test execution & feedback)
6. **2-6: DevonAider Integration** (Implementation with TDD feedback)
7. **2-7: Concurrency & Error Handling** (Robustness)

**Phase 3: Validation & Integration (MVP Week 6-7)**
8. **2-9: Integration Probes & E2E Validation** (End‑to‑end testing)

**Phase 4: Advanced Features (Post‑MVP)**
9. **2-8: Workspace & Git Integration** (Single isolated workspace)

## Next Steps
1. **Create detailed subtask breakdowns** for Tasks 2-1 through 2-9 (done in this document)
2. **Assign implementation** (Devon) and **testing** (Tara) responsibilities
3. **Define MVP milestones** with deliverable dates (focus on Tasks 2-1 through 2-7 and 2-9)
4. **Set up project tracking** in database for Feature 2 tasks
5. **Create integration probes** for each phase to validate progress

## Version History
- **v1.0**: Initial proposal with traditional sequence
- **v1.1**: Revised for TDD-first approach, split Aider tasks, moved Skills Framework earlier
- **v1.2**: Added responses to clarification notes, refined technical details
- **v1.3**: Added `context_files` column to support related files in context building
- **v1.4**: Simplified StepDecomposer, removed ResultProcessors, added Task 2-8
- **v1.5**: Incorporated Aider CLI discovery, significantly simplified Aider integration
- **v2.0**: Final specification incorporating all locked decisions
- **v3.0**: **Revised** with single workspace strategy, database enhancements, and integration probes (Task 2-9)
- **v4.0**: **Current** - Incorporates findings from PCC, CAP, RED analyses and ADR mapping with detailed subtasks

---
*Document approved for implementation on 2026-01-01*  
*Architect: Adam*  
*Status: Ready for implementation with detailed subtasks – MVP focused on Tasks 2-1 through 2-7 and 2-9*
