# Feature 2 Specification: Aider Orchestration & Skills Framework (v3.0)

## Overview
**Title:** Autonomous TDD Workflow with Aider Integration  
**Objective:** Enable Orion to coordinate TaraAider (testing) and DevonAider (implementation) through a structured skills framework and helper services.  
**Priority:** High - Enables autonomous development workflow  
**Estimated Complexity:** High (requires careful orchestration and concurrency management)  
**Revision:** v3.0 - Incorporates revised workspace strategy, database enhancements, and integration probes

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

## Task Breakdown

### Task 2-1: Database Extensions for Step Management
**Description:** Create database tables to track single-file steps and work stages for Aider orchestration.

**Technical Details**:
- Create `steps` table with enhanced columns (including `attempt_count`, `last_error`, `parent_step_id`)
- Create `work_stages` table with columns defined above
- Use PostgreSQL ENUM types for all enumerated columns (`status`, `step_type`, `assigned_to`, `work_stage`)
- Update existing tables with appropriate foreign key relationships

**Acceptance Criteria**:
1. Database migrations created and tested
2. Steps can be created, updated, and queried via DatabaseTool
3. Steps support retry tracking, error logging, and parent‑child relationships
4. All CRUD operations work correctly

**Dependencies:** Feature 1 (DatabaseTool integration)  
**Estimated Subtasks:** 3-4

---

### Task 2-2: Core Helper Services
**Description:** Build the essential helper services for step decomposition and context building.

**Technical Details**:

**StepDecomposer** (Lightweight Helper):
- Takes Orion's structured JSON decisions (file paths, step types, context file paths)
- Validates that context files exist via FileSystemTool (does NOT store file content)
- Creates `steps` records in the database with `context_files` populated
- Returns step IDs to Orion

**Orion-StepDecomposer Interface** (JSON Example):
```json
{
  "steps": [
    {
      "file_path": "src/x.js",
      "step_type": "implementation",
      "context_files": ["tests/x.spec.js", ".Docs/01-AGENTS/02-Tara/prompts/TaraPrompts.md"],
      "instructions": "Implement the TODO comment"
    }
  ]
}
```

**ContextBuilder**:
- Reads current file content via FileSystemTool (both `file_path` and all `context_files`)
- Extracts relevant codebase parts (imports, related components)
- Includes step instructions and acceptance criteria
- Adds historical feedback from previous attempts
- Builds comprehensive prompt for Aider

**Acceptance Criteria**:
1. StepDecomposer can create steps based on Orion's decisions (file paths, context files)
2. ContextBuilder generates comprehensive context using both target file and context files
3. Both services integrate with existing DatabaseTool and FileSystemTool
4. Context includes all necessary information for Aiders to work effectively

**Dependencies:** Task 2-1 (Database extensions)  
**Estimated Subtasks:** 4-5

---

### Task 2-3: Skills Framework Implementation
**Description:** Implement the skills framework for dynamic skill loading and orchestration.

**Technical Details**:
- **Skill Directory Structure**: `backend/skills/aider_orchestration/`
  - `SKILL.md` with YAML frontmatter and operating instructions
  - `/scripts` for helper scripts
  - `/references` for example prompts
- **Dynamic Skill Loading**: Orion can discover and load skills at runtime
- **Skill Validation**: Validate SKILL.md format and required fields
- **Basic Skill Execution Engine**: Framework for executing skills with proper context

**Design Decision**: Skills are explicit tools that Orion calls. No automatic triggering based on status changes for MVP.

**Acceptance Criteria**:
1. Skills can be added to directory and automatically discovered
2. Orion can load and execute skills dynamically
3. SKILL.md format is validated with clear error messages
4. Basic skill execution engine works with mock skills

**Dependencies:** Tasks 2-1 & 2-2 (Database and core helpers)  
**Estimated Subtasks:** 3-4

---

### Task 2-4: TaraAider Integration (Phase 1)
**Description:** Create services to invoke TaraAider for test file creation using Aider's non-interactive CLI mode.

**Technical Details**:
- **`TaraAiderInvoker`** - Simple CLI wrapper
  - Takes test step record and built context from ContextBuilder
  - Constructs Aider command: `aider --read [context_files...] --add [file_path] "[instructions]"`
  - Context files must include relevant test patterns and TaraPrompt.md
  - Instructions should reference TODO comments in the target file
  - Executes command and captures output (including git commit hash)
  - Updates step status: `completed` on exit code 0, `failed` otherwise
  - Increments `attempt_count` and stores error in `last_error` on failure
  - Logs full command and output to database for debugging
- **No separate `TestResultProcessor`** - Aider applies changes directly

**Acceptance Criteria**:
1. TaraAiderInvoker can successfully call Aider with `--read` and `--add` flags
2. Changes are applied directly by Aider (no separate diff processing)
3. Success/failure determined by Aider exit code; errors captured in database
4. All interactions logged in database (including git commit hashes)

**Dependencies:** Tasks 2-3 (Skills Framework - implemented as a skill)  
**Estimated Subtasks:** 3-4

---

### Task 2-5: Test Execution Framework
**Description:** Build test running and result parsing capabilities since Aiders cannot run tests.

**Technical Details**:
- **`TestRunner`** - Modular service usable by Orion, Devon, and Tara
  - Executes project test suite or single tests (`npm test`, `jest`, specific files)
  - Captures output (pass/fail, errors, coverage)
  - Returns structured JSON results
- **`TestResultParser`** - Extracts meaningful information from test output
  - Identifies which specific tests passed/failed
  - Parses error messages and stack traces
  - Formats results for database storage and Aider context
- **`TaraTestRunner`** - Specialized helper for TaraAider's TDD loop
  - Provides test context and conversation history
  - Runs tests and appends results to history
  - Detects stuckness and escalates to Orion

**Acceptance Criteria**:
1. TestRunner can execute tests and capture results
2. TestResultParser extracts actionable information from test output
3. TaraTestRunner supports iterative TDD workflow
4. Test results are properly stored and can be fed back to Aiders

**Dependencies:** Task 2-4 (TaraAider Integration)  
**Estimated Subtasks:** 3-4

---

### Task 2-6: DevonAider Integration (Phase 2)
**Description:** Create services to invoke DevonAider for implementation file changes using Aider's non-interactive CLI mode.

**Technical Details**:
- **`DevonAiderInvoker`** - Simple CLI wrapper
  - Takes implementation step record and built context (including test results from TestRunner)
  - Constructs Aider command: `aider --read [context_files...] --add [file_path] "[instructions]"`
  - Includes test results and failure details in prompt for TDD feedback
  - Executes command and captures output
  - Updates step status based on Aider exit code (0 = success, non-zero = failure)
  - Increments `attempt_count` and stores error in `last_error` on failure
  - Logs command and output for debugging
- **No separate `ImplementationResultProcessor`** - Aider applies changes directly
- **Structured JSON response capture** for error cases and stuckness detection

**Acceptance Criteria**:
1. DevonAiderInvoker can successfully call Aider with `--read` and `--add` flags
2. Test results are included in the prompt context for TDD feedback
3. Success/failure determined by Aider exit code; errors captured in database
4. Integration with TaraTestRunner for TDD feedback loop

**Dependencies:** Tasks 2-5 (Test Framework - for TDD feedback)  
**Estimated Subtasks:** 3-4

---

### Task 2-7: Concurrency & Error Handling
**Description:** Implement robust concurrency management and error recovery.

**Technical Details**:
- **File Locking Service** - Prevent concurrent edits to same file within the single workspace
- **Step Serialization** - Ensure steps targeting same file execute sequentially
- **Error Recovery** - Retry logic (based on `attempt_count`), fallback strategies, manual escalation
- **Rollback Mechanism** - Leverage Aider's git integration for undo (`git reset --hard`)
- **Stuckness Detection** - Identify when Aiders are making no progress (based on error patterns and attempt counts)

**Acceptance Criteria**:
1. No data corruption from concurrent file edits
2. Failed steps can be retried (with attempt tracking) or rolled back using git
3. System detects stuck workflows and escalates appropriately
4. All errors are logged with sufficient context for debugging

**Dependencies:** All previous tasks  
**Estimated Subtasks:** 3-4

---

### Task 2-8: Workspace & Git Integration (Post‑MVP)
**Description:** **Post‑MVP** – Create a single isolated workspace with git synchronization to main codebase.

**Technical Details**:
- **Single Workspace Directory**: `workspaces/{project-id}/` (outside main codebase)
- **Git Workflow**:
  - Clone project repository into workspace
  - Aider auto‑commits within workspace
  - Sync successful changes back to main codebase (manual or automated)
  - Use git reset for rollback on failure
- **Path Mapping**: All file paths relative to project root (consistent across workspace and main)

**Acceptance Criteria**:
1. Workspace can be created and initialized with git clone
2. Aider operates within workspace and auto‑commits
3. Successful changes can be synchronized to main codebase
4. Git reset used for rollback

**Dependencies:** Task 2-7 (Concurrency & Error Handling)  
**Status:** Post‑MVP (Nice to Have)  
**Estimated Subtasks:** 3-4

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
**Estimated Subtasks:** 4-5

---

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
**Phase 1: Foundation & Test Creation (MVP)**
1. **2-1: Database extensions** (Foundation)
2. **2-2: Core helpers** (Decomposition & Context)
3. **2-3: Skills Framework** (Basic implementation)
4. **2-4: TaraAider Integration** (Test file creation)

**Phase 2: TDD Workflow (MVP)**
5. **2-5: Test Framework** (Test execution & feedback)
6. **2-6: DevonAider Integration** (Implementation with TDD feedback)
7. **2-7: Concurrency & Error Handling** (Robustness)

**Phase 3: Validation & Integration (MVP)**
8. **2-9: Integration Probes & E2E Validation** (End‑to‑end testing)

**Phase 4: Advanced Features (Post‑MVP)**
9. **2-8: Workspace & Git Integration** (Single isolated workspace)

## Next Steps
1. **Create detailed subtask breakdowns** for Tasks 2-1 through 2-9
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

---
*Document approved for implementation on 2026-01-01*  
*Architect: Adam*  
*Status: Ready for subtask breakdown and assignment – MVP focused on Tasks 2-1 through 2-7 and 2-9*
