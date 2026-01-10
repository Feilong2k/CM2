# Feature 2 Specification: Aider Orchestration & Skills Framework (v5.2)

## Overview
**Title:** Autonomous TDD Workflow with Aider Integration  
**Objective:** Enable Orion to coordinate TaraAider (testing) and DevonAider (implementation) through a structured skills framework and helper services, following the progressive disclosure pattern inspired by Claude Code.  
**Priority:** High - Enables autonomous development workflow  
**Estimated Complexity:** High (requires careful orchestration and concurrency management)  
**Revision:** v5.3 - Adds Step Reasoning Tracking (Thought Process Capture) as Subtask 2-2-8

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

## Task Breakdown with Structured Subtasks

Each subtask is designed to be completed by Devon within **3 Aider steps or fewer**, with clear instructions for both Devon (implementation) and Tara (testing).

### Task 2-1: Database Extensions for Step Management
**Description:** Create database tables to track single-file steps and work stages for Aider orchestration.

**Subtasks**:

#### Subtask 2-1-1: Create PostgreSQL ENUM Types
- **Description**: Create ENUM types `step_type`, `status`, `assigned_to`, `work_stage` using `CREATE TYPE IF NOT EXISTS`.
- **Dependencies**: Feature 1 (DatabaseTool integration)
- **Acceptance Criteria**:
  1. ENUM types exist in PostgreSQL and can be used in table definitions
  2. Values match specification: `step_type` ('implementation', 'test'), `status` ('pending', 'in_progress', 'completed', 'failed'), `assigned_to` ('TaraAider', 'DevonAider'), `work_stage` ('pending', 'analysis', 'unit_testing', 'unit_implementation', 'integration_testing', 'integration_implementation', 'review', 'completed')
- **Devon Instructions**:
  - Create migration file `backend/migrations/0002_step_enum_types.sql`
  - Use `CREATE TYPE IF NOT EXISTS` for each ENUM
  - Test migration by running it and verifying types exist
- **Tara Instructions**:
  - Write test that verifies each ENUM type exists and has correct values
  - Test in isolation before integration with tables
- **Estimated Steps**: 1 (migration file)

#### Subtask 2-1-2: Create `steps` Table
- **Description**: Create `steps` table with all specified columns including `context_files` (JSONB array), `attempt_count`, `last_error`, `parent_step_id`.
- **Dependencies**: 2-1-1 (ENUM types)
- **Acceptance Criteria**:
  1. Table `steps` exists with correct column names, types, and constraints
  2. `context_files` column accepts JSONB arrays of strings
  3. Foreign keys reference correct tables (`projects`, `subtasks`)
  4. Default values set for `attempt_count` (0) and timestamps
- **Devon Instructions**:
  - Create migration file `backend/migrations/0003_steps_table.sql`
  - Define table with all columns, using ENUM types from 2-1-1
  - Add foreign key constraints and indexes
- **Tara Instructions**:
  - Write integration tests that create, read, update, delete steps
  - Verify JSONB array operations work correctly
  - Test foreign key constraints
- **Estimated Steps**: 1-2 (table creation, indexes)

#### Subtask 2-1-3: Create `work_stages` Table (Optional)
- **Description**: Create optional `work_stages` table for tracking feature/task progression.
- **Dependencies**: 2-1-1 (ENUM types)
- **Acceptance Criteria**:
  1. Table `work_stages` exists with correct schema
  2. ENUM `work_stage` used correctly
  3. Optional foreign keys to `features` or `tasks` tables
- **Devon Instructions**:
  - Create migration file `backend/migrations/0004_work_stages_table.sql`
  - Define table with optional foreign keys (nullable)
- **Tara Instructions**:
  - Write tests for CRUD operations on work_stages
  - Test nullable foreign key behavior
- **Estimated Steps**: 1 (migration file)

#### Subtask 2-1-4: Update Foreign Key Relationships
- **Description**: Ensure proper foreign key relationships between new tables and existing `projects`, `features`, `tasks`, `subtasks`.
- **Dependencies**: 2-1-2, 2-1-3 (tables created)
- **Acceptance Criteria**:
  1. All foreign keys are properly defined and enforce referential integrity
  2. Cascade delete behavior appropriate for each relationship
- **Devon Instructions**:
  - Update migration files to include foreign key constraints
  - Verify relationships match data model
- **Tara Instructions**:
  - Write tests that verify foreign key constraints work (insert/delete cascades)
- **Estimated Steps**: 1 (update migrations)

#### Subtask 2-1-5: Create DatabaseTool Methods
- **Description**: Implement DatabaseTool methods for step management: `create_step`, `update_step`, `get_step`, `list_steps_by_subtask`, `get_steps_by_status`.
- **Dependencies**: 2-1-2 (steps table)
- **Acceptance Criteria**:
  1. All methods exist in DatabaseTool with correct signatures
  2. Methods handle all fields including `context_files` (JSONB), `attempt_count`, `last_error`, `parent_step_id`
  3. Proper error handling for invalid inputs, missing records
- **Devon Instructions**:
  - Add methods to `backend/tools/DatabaseTool.js`
  - Use parameterized queries to prevent SQL injection
  - Handle JSONB serialization/deserialization
- **Tara Instructions**:
  - Write unit tests for each method with mocked database
  - Test edge cases: empty context_files, null parent_step_id, retry logic
- **Estimated Steps**: 2-3 (methods implementation)

#### Subtask 2-1-6: Write Migration Tests
- **Description**: Create tests to verify ENUM creation, table structure, and CRUD operations.
- **Dependencies**: 2-1-1 through 2-1-5
- **Acceptance Criteria**:
  1. Migration tests run successfully
  2. All table structures validated against specification
  3. CRUD operations tested with real database
- **Devon Instructions**:
  - Create test file `backend/migrations/__tests__/step_migrations.test.js`
  - Test ENUM types, table creation, and basic operations
- **Tara Instructions**:
  - Run migration tests and verify they pass
  - Add additional edge case tests if needed
- **Estimated Steps**: 1-2 (test file)

---

### Task 2-2: Core Helper Services
**Description:** Build the essential helper services for step decomposition and context building.

**Subtasks**:

#### Subtask 2-2-1: Implement StepDecomposer Class
- **Description**: Class that takes Orion's structured JSON decisions, validates context files exist via FileSystemTool, creates `steps` records in database.
- **Dependencies**: Task 2-1 (Database extensions)
- **Acceptance Criteria**:
  1. StepDecomposer can parse JSON input and validate required fields
  2. Validates context files exist using FileSystemTool before creating steps
  3. Creates proper step records in database via DatabaseTool
  4. Returns step IDs or error details
- **Devon Instructions**:
  - Create `backend/src/services/StepDecomposer.js`
  - Define class with `decompose(subtaskId, decompositionJson)` method
  - Integrate with DatabaseTool and FileSystemTool
- **Tara Instructions**:
  - Write unit tests with mocked dependencies
  - Test validation failures, missing files, successful decomposition
- **Estimated Steps**: 2-3 (class + integration)

#### Subtask 2-2-2: Implement ContextBuilder Class
- **Description**: Class that reads target file and all `context_files` via FileSystemTool, builds comprehensive prompt for Aider including step instructions and acceptance criteria.
- **Dependencies**: Task 2-1 (Database extensions)
- **Acceptance Criteria**:
  1. Reads file contents for target file and all context files
  2. Builds structured prompt with clear sections: instructions, target file, context files, acceptance criteria
  3. Handles missing files gracefully (skip with warning)
  4. Limits total context size to prevent token overflow
- **Devon Instructions**:
  - Create `backend/src/services/ContextBuilder.js`
  - Implement `buildContext(stepId)` method
  - Use FileSystemTool to read files, format output
- **Tara Instructions**:
  - Write unit tests with mock file contents
  - Test context truncation, missing files, formatting
- **Estimated Steps**: 2-3 (class + formatting)

### Purpose

ContextBuilder __does not read file contents__ or build a large prompt. Instead it prepares the *paths + instructions* needed to run Aider non-interactively.

### Input

- `buildContext(stepId)` where `stepId` is the `steps.id` in the DB.

### Output

A structured object like:

```js
{
  targetFile: 'path/to/target.js',               // used with: aider --add
  contextFiles: ['path/context1.js', ...],       // used with: aider --read (plus agent prompt)
  instructions: 'Write a test for ...',          // passed as the final CLI instruction string
  agentType: 'TaraAider'                         // or 'DevonAider'
}
```

### Required behavior

1. Fetch step via `DatabaseTool.get_step(stepId)`; throw if not found.

2. Validate required fields exist on the step: `file_path`, `instructions`, `assigned_to`, `context_files`.

3. Determine agent prompt file:

   - Tara → `backend/prompts/TaraPrompt.md`
   - Devon → `backend/prompts/DevonPrompt.md`

4. `contextFiles = step.context_files + [agentPromptFile]`.

5. Optional file existence checks via FileSystemTool (policy decision: warn vs throw). In later 2-2-4, tests were updated to expect __throw on missing context files__.

6. Emit trace events for started/completed (and warifnings if using warn mode).

### Integration note

The invoker uses it like:

```bash
aider --read file1 --read file2 --add targetFile "instructions"
```

If you want, I can restate it as an “Implementation Requirements” block (overview / details / acceptance criteria / edge cases) so it’s copy-pastable into a roadmap doc.



#### Subtask 2-2-3: Design Orion-StepDecomposer JSON Interface
- **Description**: Define and document schema for step decomposition input from Orion.
- **Dependencies**: 2-2-1 (StepDecomposer)
- **Acceptance Criteria**:
  1. JSON schema documented in ADR or specification
  2. StepDecomposer validates against schema
  3. Example payloads provided for testing
- **Devon Instructions**:
  - Create documentation file `.Docs/03-ARCHITECTURE/step_decomposition_schema.md`
  - Define JSON Schema with required fields: `subtask_id`, `steps` array, each with `file_path`, `instructions`, `step_type`, `assigned_to`, `context_files`
- **Tara Instructions**:
  - Write validation tests using the schema
  - Test invalid payloads produce clear errors
- **Estimated Steps**: 1 (documentation + schema)

#### Subtask 2-2-4: Add Error Handling
- **Description**: Graceful handling of missing context files, permission errors, large files.
- **Dependencies**: 2-2-1, 2-2-2 (core classes)
- **Acceptance Criteria**:
  1. Missing context files fails loudly
  2. Permission errors reported clearly
  3. Large files truncated or handled with appropriate warnings
  4. All errors logged to TraceStoreService
- **Devon Instructions**:
  - Add error handling to StepDecomposer and ContextBuilder
  - Implement file size checks and truncation logic
- **Tara Instructions**:
  - Write error case tests: missing files, permission denied, huge files
  - Verify errors are logged appropriately
- **Estimated Steps**: 1-2 (error handling)

#### Subtask 2-2-5: Create Unit Tests
- **Description**: Comprehensive unit tests for StepDecomposer and ContextBuilder with mock dependencies.
- **Dependencies**: 2-2-1 through 2-2-4
- **Acceptance Criteria**:
  1. Unit tests exist for both classes
  2. Test coverage >80% for critical paths
  3. Mock dependencies properly isolated
- **Devon Instructions**:
  - Create test files `backend/src/services/__tests__/StepDecomposer.spec.js` and `ContextBuilder.spec.js`
  - Use Jest mocks for DatabaseTool and FileSystemTool
- **Tara Instructions**:
  - Run tests, ensure they pass
  - Add additional edge case tests if needed
- **Estimated Steps**: 2 (test files)

#### Subtask 2-2-6: Add Trace Events
- **Description**: Emit standardized trace events for decomposition and context building.
- **Dependencies**: 2-2-1, 2-2-2 (core classes)
- **Acceptance Criteria**:
  1. Trace events emitted for key actions: decomposition started/completed, context building started/completed
  2. Events include relevant metadata (step IDs, file counts, error details)
  3. shows up in the cli when chatting with Orion
  4. Stored into DB for future analysis
- **Devon Instructions**:
  - Integrate with TraceStoreService in both classes
  - Add trace calls at beginning/end of major operations
- **Tara Instructions**:
  - Verify trace events are captured during tests
  - Check event data structure matches expectations
- **Estimated Steps**: 1 (trace integration)
  5. E2E integration

#### Subtask 2-2-7: Implement Tool Result Cache for Context Building
- **Description**: Implement a short-lived Tool Result Cache Service for context-building tools, with TTL (~10 minutes) and fingerprint-based invalidation (e.g., git hash or schema version). Integrate it so repeated calls with identical arguments can reuse fresh results automatically, and expose summaries to Orion via context when appropriate.
- **Dependencies**: 2-2-2 (ContextBuilder), existing ToolOrchestrator/ToolRunner
- **Acceptance Criteria**:
  1. A cache service exists (e.g., `ToolResultCacheService`) that stores tool results keyed by `(toolName, action, argsHash, projectId)` with `createdAt`, `ttlSeconds`, and `fingerprint`.
  2. For context-building tools (e.g., `DatabaseTool_get_subtask_full_context`, `FileSystemTool_list_files`, `FileSystemTool_search_files`), repeated calls with identical arguments within TTL and matching fingerprint reuse cached results instead of re-calling the tool.
  3. When the underlying state changes (e.g., git commit hash/dir hash or DB schema version changes, or a write tool runs), cached entries are treated as stale and not reused.
  4. ContextBuilder can optionally inject compact summaries of recent tool results into Orion's context (system/early messages) without Orion needing to explicitly request reuse.
- **Devon Instructions**:
  - Implement `ToolResultCacheService` with `get`/`set` methods and TTL + fingerprint logic.
  - Integrate with ToolOrchestrator/ToolRunner so cache lookups happen automatically before executing qualifying tools.
  - Choose appropriate fingerprints (e.g., git HEAD for filesystem operations, schema/migration version for DB context) and wire invalidation on writes.
- **Tara Instructions**:
  - Write integration tests that:
    - Call a context-building tool twice with identical args and verify the second call reuses a cached result when TTL/fingerprint are valid.
    - Simulate a state change (e.g., bump git hash or mock fingerprint change) and verify the cache is bypassed and the tool is re-called.
- **Estimated Steps**: 2-3 (service implementation + integration tests)

#### Subtask 2-2-8: Implement Step Reasoning Tracking (Thought Process Capture)
- **Description**: Extend the step decomposition schema and StepDecomposer to capture the reasoning behind each step, including goals, alternatives considered, assumptions, constraints, and decision points. This transforms steps from mere action tracking to reasoning-action pairs, enabling better debugging, knowledge transfer, and process improvement.
- **Dependencies**: 2-2-3 (Design Orion-StepDecomposer JSON Interface), 2-2-1 (StepDecomposer Class)
- **Acceptance Criteria**:
  1. Database migration adds `reasoning` JSONB column to `steps` table with default `{}`
  2. Step decomposition JSON schema extended to include optional `reasoning` field with structure: `goal`, `alternatives_considered`, `assumptions`, `constraints`, `decision_points`
  3. StepDecomposer validates and stores reasoning in database
  4. Orion's prompt updated to include guidelines for providing reasoning in decompositions
  5. Existing steps remain compatible (backward compatible)
- **Devon Instructions**:
  - Create migration to add `reasoning` JSONB column to `steps` table
  - Update StepSchemaValidator to validate the new `reasoning` structure
  - Update StepDecomposer to store reasoning in database
  - Update Orion's system prompt to include reasoning guidelines and examples
- **Tara Instructions**:
  - Write tests for the new `reasoning` field validation and storage
  - Test backward compatibility (steps without reasoning)
  - Test that Orion can parse and use the updated schema
- **Estimated Steps**: 2-3 (migration, validation updates, prompt updates)

---

### Task 2-3: Skills Framework Implementation
**Description:** Implement the skills framework following Claude Code's progressive disclosure pattern.

**Subtasks**:

#### Subtask 2-3-1: Adopt Canonical Skill Directory Structure
- **Description**: Adopt `backend/Skills/skill-creator/` (Anthropic Skill Creator) as the canonical skill directory and reference structure for the Skills Framework (SKILL.md + `/scripts` + `/references`).
- **Dependencies**: None
- **Acceptance Criteria**:
  1. `backend/Skills/skill-creator/` exists in the repo and matches the expected structure: `SKILL.md`, `scripts/`, `references/`.
  2. `SKILL.md` has valid YAML frontmatter with at least `name` and `description` fields.
  3. `scripts/` and `references/` directories follow the progressive disclosure pattern (code in `scripts/`, docs in `references/`).
- **Devon Instructions**:
  - Verify that `backend/Skills/skill-creator/` (copied from the Anthropics repo) is present and intact.
  - Confirm `SKILL.md` parses as YAML and contains clear `name` and `description` metadata.
  - Ensure `scripts/` and `references/` subdirectories exist and reflect the intended progressive disclosure structure.
- **Tara Instructions**:
  - Write tests that validate the existence and basic structure of `backend/Skills/skill-creator/` (directory, SKILL.md, `scripts/`, `references/`).
  - Validate that SKILL.md has the required frontmatter fields and that the directories align with the documented pattern.
- **Estimated Steps**: 1 (verification + tests)

#### Subtask 2-3-2: Implement SkillLoader
- **Description**: Indexes skill metadata (name, description, parameters) from YAML frontmatter of all `SKILL.md` files.
- **Dependencies**: 2-3-1 (directory structure)
- **Acceptance Criteria**:
  1. SkillLoader can scan directory and parse YAML frontmatter
  2. Returns array of skill metadata objects
  3. Handles malformed YAML gracefully (skip with warning)
- **Devon Instructions**:
  - Create `backend/src/skills/SkillLoader.js`
  - Implement `loadSkillMetadata()` method
  - Use js-yaml or similar for parsing
- **Tara Instructions**:
  - Write tests with mock skill files
  - Test error handling for invalid YAML
- **Estimated Steps**: 2 (loader + parsing)

#### Subtask 2-3-3: Implement SkillTool_execute Tool
- **Description**: Generic tool that loads full skill instructions and executes them.
- **Dependencies**: 2-3-2 (SkillLoader)
- **Acceptance Criteria**:
  1. Tool registered with Orion as `SkillTool_execute`
  2. Takes parameters `skill_name` and `parameters` object
  3. Loads full SKILL.md and executes according to skill definition
- **Devon Instructions**:
  - Create `backend/tools/SkillTool.js`
  - Register in `functionDefinitions.js`
  - Implement execution logic (initially simple file reading)
- **Tara Instructions**:
  - Write integration tests for tool execution
  - Verify tool appears in Orion's available tools
- **Estimated Steps**: 2-3 (tool implementation)

#### Subtask 2-3-4: Create Skill Validation
- **Description**: Validate SKILL.md format and required fields, skip invalid skills.
- **Dependencies**: 2-3-2 (SkillLoader)
- **Acceptance Criteria**:
  1. Validation checks: required YAML fields (name, description, parameters)
  2. Invalid skills logged and skipped, not crashing loader
- **Devon Instructions**:
  - Add validation to SkillLoader
  - Define required fields and validation rules
- **Tara Instructions**:
  - Write tests with invalid skill files, verify they're skipped
- **Estimated Steps**: 1 (validation)

#### Subtask 2-3-5: Implement Basic Skill Execution Engine
- **Description**: Framework for executing skills with proper context.
- **Dependencies**: 2-3-3 (SkillTool_execute)
- **Acceptance Criteria**:
  1. Can execute a skill's instructions (markdown after frontmatter)
  2. Provides skill parameters as context
  3. Returns execution results
- **Devon Instructions**:
  - Extend SkillTool to parse and execute skill instructions
  - Create simple interpreter for markdown instructions
- **Tara Instructions**:
  - Test execution with example skills
- **Estimated Steps**: 2 (execution engine)

#### Subtask 2-3-6: Create Example Skills
- **Description**: Simple "hello world" skill to demonstrate the pattern.
- **Dependencies**: 2-3-1 (directory structure)
- **Acceptance Criteria**:
  1. Example skill exists and can be loaded/executed
  2. Demonstrates full progressive disclosure pattern
- **Devon Instructions**:
  - Create `backend/skills/aider_orchestration/ExampleSkill/` with SKILL.md
  - Skill should have minimal functionality (e.g., log message)
- **Tara Instructions**:
  - Test example skill works end-to-end
- **Estimated Steps**: 1 (example skill)

#### Subtask 2-3-7: Add Skill Discovery to Orion's Context
- **Description**: Inject skill metadata into Orion's prompt so it knows available skills.
- **Dependencies**: 2-3-2 (SkillLoader)
- **Acceptance Criteria**:
  1. Orion's system prompt includes list of available skills (names, descriptions)
  2. Skill metadata loaded at Orion startup
- **Devon Instructions**:
  - Modify Orion's prompt building to include skill metadata
  - Load skills at startup via SkillLoader
- **Tara Instructions**:
  - Verify Orion's prompt contains skill information
- **Estimated Steps**: 1 (prompt integration)

#### Subtask 2-3-8: Add Trace Events
- **Description**: Emit standardized trace events for skill loading and execution.
- **Dependencies**: 2-3-2, 2-3-5
- **Acceptance Criteria**:
  1. Trace events emitted for: skill loading (summary), individual skill execution start/end/fail
  2. Execution traces include inputs, outputs (truncated if large), and duration
- **Devon Instructions**:
  - Integrate with TraceStoreService in SkillLoader and SkillTool
  - Add trace calls for key lifecycle events
- **Tara Instructions**:
  - Verify trace events are captured during skill execution tests
- **Estimated Steps**: 1 (trace integration)

#### Subtask 2-3-9: Implement WritePlanTool (Phase 1)
- **Description**: Implement a questionnaire-based interface for safer file writing (Create/Append/Overwrite), replacing brittle direct file manipulations for common tasks.
- **Dependencies**: None (standalone tool)
- **Acceptance Criteria**:
  1. `WritePlanTool` exists and accepts a structured "Write Plan" object (intent, target_file, operations).
  2. Supports `create`, `append`, `overwrite` operations.
  3. Validates file existence/non-existence as appropriate before writing.
  4. Automatically creates parent directories if they don't exist.
  5. Returns a structured report of actions taken with status/error codes.
- **Devon Instructions**:
  - Implement `backend/tools/WritePlanTool.js`.
  - Implement validation logic (fail create if exists; fail append/overwrite if missing).
  - Implement recursive directory creation.
  - Defer complex edge cases (symlinks, permissions) for later phases.
- **Tara Instructions**:
  - Test operation rules (create vs append vs overwrite).
  - Test auto-creation of parent directories.
  - Test structured error reporting.
- **Estimated Steps**: 2-3 (tool implementation)

#### Subtask 2-3-10: Implement UTF-8 Content Validation Helper with Orion Repair Loop
- **Description**: Create a helper module that validates content for UTF-8 validity and implements the "Orion repair loop" for invalid characters (up to 3 attempts with batching, then safe replacement). This helper will be called by WritePlanTool (and potentially other tools) to ensure content is safe to write to the database/filesystem.
- **Dependencies**: 2-3-9 (WritePlanTool), existing Orion agent interface for asking questions
- **Acceptance Criteria**:
  1. A helper module `ContentValidationHelper` exists with methods:
     - `validateUtf8(content, chunkSize?)`: returns `{ isValid: boolean, errors: Array<{position, char, charCode, context}> }`
     - `repairWithOrion(content, errors, filePath?)`: uses Orion to suggest fixes for all invalid positions in a batched request, returns repaired content (or null if Orion cannot fix).
     - `applySafeReplacement(content, errors)`: replaces invalid characters with `` (REPLACEMENT CHARACTER) and logs details.
  2. WritePlanTool integrates this helper in its write flow:
     - Before writing, validate content.
     - If invalid, attempt up to 3 repair loops (each loop: collect all errors, ask Orion for batched fix, re-validate).
     - After 3 attempts, apply safe replacement and log.
  3. The repair loop uses Orion's existing question-answering mechanism (e.g., via ToolOrchestrator) and presents a clear prompt with context around each invalid character.
  4. Logging includes: file path, number of invalid characters, positions, attempts made, whether safe replacement was used.
- **Devon Instructions**:
  - Create `backend/src/utils/ContentValidationHelper.js` (or similar location).
  - Implement UTF-8 validation using `TextEncoder` or a library.
  - Implement the repair loop that calls Orion (via existing agent interface) with a batched prompt.
  - Integrate the helper into WritePlanTool's `execute` method.
  - Ensure logs are emitted to TraceStoreService.
- **Tara Instructions**:
  - Write unit tests for validation (valid/invalid content, chunking).
  - Write integration tests that simulate the repair loop (mock Orion's response).
  - Test edge cases: many errors, empty content, Orion returning unparseable response, safe replacement fallback.
  - Verify that WritePlanTool with the helper passes existing tests and handles invalid content gracefully.- **Estimated Steps**: 3-4 (helper + integration + tests)

#### Subtask 2-3-11: Implement Task Preparation Assistant Skill
- **Description**: Create a skill that helps Orion systematically prepare for complex tasks by gathering context, running PCC1 analysis, verifying gaps, and creating actionable steps for Tara/Devon with TODO comments in target files. This skill implements the 11-step flow:

  1. **Skill starts** with subtask ID
  2. **Orion lists context info needed** – guided by task-type-specific prompting categories:
     - **Infrastructure tasks** (e.g., 2-2-7): "Consider tool patterns, error handling, tracing, performance constraints"
     - **Orchestration tasks** (e.g., 2-3-11): "Consider user prompts, templates, skill interfaces, workflow steps"
     - **Feature tasks**: "Consider UI patterns, design system, user flows"
     - **Default**: For tasks that don't fit a category, prompt: "What context do you need for subtask X-X-X?"
  3. **Script validates** if requested context exists and is non‑empty, pulls it together and hands to Orion
  4. **Orion starts PCC1 Skill** with the compiled context
  5. **Orion fills out PCC1 Skill questionnaire** (single structured response per action), saved to DB by script
  6. **Orion now has all context including gaps** he noticed during PCC1
  7. **Orion calls tools to verify gaps**; no gap → continue, yes gap → escalate to human (or continue with recommendation, logged in DB)
  8. **Orion fills out steps**, including contexts needed for Tara, the file Tara needs to create, and instruction to Tara
  9. **Scripts check if file is present**; if not create a file and write the instruction as a TODO comment, or if exists append to file as TODO Comment
  10. **Create the steps in the DB** via StepDecomposer
  11. **Return step IDs** to Orion for execution tracking

- **Dependencies**: 2-3-5 (Basic Skill Execution Engine), 2-1-5 (DatabaseTool methods), 2-2-1 (StepDecomposer), 2-3-9 (WritePlanTool)
- **Acceptance Criteria**:
  1. Skill exists in `backend/Skills/task-preparation-assistant/` with proper SKILL.md, scripts, references
  2. Orion is prompted with context categories based on task type; his responses are used to gather validated context
  3. PCC1 questionnaire responses stored in database (single structured response per action)
  4. Gap verification with escalate/continue decision logic, decision stored in DB
  5. TODO comments created in target files (create if missing, append if exists) using WritePlanTool
  6. Steps created in DB with proper context_files links via StepDecomposer
  7. Step IDs returned to Orion for execution tracking
- **Devon Instructions**:
  - Create skill directory `backend/Skills/task-preparation-assistant/`
  - Implement SKILL.md with 11-step flow documentation, emphasizing the guided context prompting
  - Create scripts: context-requester.js (with task‑type detection and category prompts), pcc1-orchestrator.js, gap-verifier.js, step-file-writer.js
  - Integrate with DatabaseTool, StepDecomposer, WritePlanTool
  - Implement TODO comment file operations (create/append) via WritePlanTool
- **Tara Instructions**:
  - Test skill end-to-end with mock subtasks of different types (infrastructure, orchestration, feature, default)
  - Verify context prompting works (categories appear correctly, Orion can specify needs)
  - Verify context validation and compilation works
  - Test PCC1 questionnaire storage and retrieval
  - Test gap verification and escalation logic
  - Test TODO comment file operations (create new file, append to existing)
  - Verify step creation in DB and proper step IDs returned
- **Estimated Steps**: 3-4 (skill implementation + integration tests)

---

### Task 2-4: TaraAider Integration (Test Creation)
**Description:** Implement the workflow for Orion to instruct TaraAider to create tests.

*(Detailed subtasks for 2-4 through 2-9 omitted for brevity but follow the same structure)*

---

### Task 2-7: Concurrency, Reliability & Error Handling
**Description:** Robustness improvements for handling concurrent edits, failures, and safer file writing patterns.

**Subtasks:**

#### Subtask 2-7-1: File Locking
- **Description**: Simple file locking mechanism to prevent Aider instances from editing the same file concurrently.
- **Dependencies**: None
- **Acceptance Criteria**:
  1. `FileLockService` exists with acquire/release methods
  2. Lock has a timeout (e.g. 5 minutes)
  3. Attempting to acquire a locked file returns false/error
- **Devon Instructions**:
  - Implement `backend/src/services/FileLockService.js` using Redis or simple DB table
- **Tara Instructions**:
  - Test locking contention (two agents trying to lock same file)
- **Estimated Steps**: 2 (service + tests)

#### Subtask 2-7-2: Concurrency Manager
- **Description**: Service to queue or reject conflicting subtask executions.
- **Dependencies**: 2-7-1 (FileLockService)
- **Acceptance Criteria**:
  1. `ConcurrencyManager` checks locks before StepDecomposer assigns steps
  2. If file is locked, queue the step or fail fast
- **Devon Instructions**:
  - Implement `backend/src/services/ConcurrencyManager.js`
  - Integrate with Orion's main loop
- **Tara Instructions**:
  - Simulate concurrent requests and verify queuing behavior
- **Estimated Steps**: 2 (manager logic)

#### Subtask 2-7-3: Implement Step Retries
- **Description**: Add retry logic for failed steps.
- **Dependencies**: 2-1-2 (steps table)
- **Acceptance Criteria**:
  1. Failed steps are retried up to 3 times
  2. Context is refreshed between retries
  3. `attempt_count` increments correctly
- **Devon Instructions**:
  - Update `ToolOrchestrator` to loop on step failure
  - Implement exponential backoff
- **Tara Instructions**:
  - Test retry behavior with mocked failures
  - Verify attempt count increments
- **Estimated Steps**: 2 (retry logic)

---

### Task 2-8: Workspace & Git Integration
**Description:** Implement single isolated workspace strategy.

*(Details omitted)*

---

### Task 2-9: Integration Probes & E2E Validation
**Description:** End-to-end testing and validation probes to ensure the entire system works together.

*(Details omitted)*

---

### Task 2-10: Integration Readiness Framework
**Description:** Implement `IntegrationReadinessService` to validate integration readiness before subtask execution, preventing the "unit tests pass but integration fails" problem.

**Subtasks:**

#### Subtask 2-10-1: Core Service Architecture
- **Description**: Create the base `IntegrationReadinessService` class with validation registry and configuration system.
- **Dependencies**: Task 2-1 (Database extensions), Task 2-2 (Core helpers)
- **Acceptance Criteria**:
  1. `IntegrationReadinessService.js` exists in `backend/src/services/`
  2. Service can be instantiated with project ID
  3. Basic validation registry pattern implemented
  4. Configuration loading from JSON/YAML files works
- **Devon Instructions**:
  - Create `backend/src/services/IntegrationReadinessService.js`
  - Implement core class with `validate(subtaskId)` method
  - Create configuration loader for validation profiles
- **Tara Instructions**:
  - Write unit tests for service instantiation and configuration loading
  - Test validation registry with mock validators
- **Estimated Steps**: 2-3 (core class + configuration)

#### Subtask 2-10-2: Database Validator Implementation
- **Description**: Implement `DatabaseValidator` that checks database schema, migrations, and data consistency.
- **Dependencies**: 2-10-1 (Core service), 2-1-5 (DatabaseTool methods)
- **Acceptance Criteria**:
  1. `DatabaseValidator` class exists with `run(check)` method
  2. Validates: columns exist, migrations applied, foreign key integrity
  3. Returns structured results with success/failure and remediation steps
  4. Uses DatabaseTool for database operations
- **Devon Instructions**:
  - Create `backend/src/services/validators/DatabaseValidator.js`
  - Implement validation checks using DatabaseTool
  - Add remediation suggestions for common failures
- **Tara Instructions**:
  - Write integration tests with real database
  - Test column existence validation
  - Test migration version checking
- **Estimated Steps**: 2-3 (validator + integration)

#### Subtask 2-10-3: Filesystem Validator Implementation
- **Description**: Implement `FilesystemValidator` that checks file/directory existence, permissions, and content.
- **Dependencies**: 2-10-1 (Core service), 2-2-2 (ContextBuilder uses FileSystemTool)
- **Acceptance Criteria**:
  1. `FilesystemValidator` class exists with `run(check)` method
  2. Validates: paths exist, permissions, file headers/signatures
  3. Returns structured results with success/failure
  4. Uses FileSystemTool for file operations
- **Devon Instructions**:
  - Create `backend/src/services/validators/FilesystemValidator.js`
  - Implement validation checks using FileSystemTool
  - Add permission checking (read/write/execute)
- **Tara Instructions**:
  - Write integration tests with mock filesystem
  - Test path existence validation
  - Test permission validation
- **Estimated Steps**: 2-3 (validator + integration)

#### Subtask 2-10-4: External Service Validator Implementation
- **Description**: Implement `ExternalServiceValidator` for service health checks and version compatibility.
- **Dependencies**: 2-10-1 (Core service)
- **Acceptance Criteria**:
  1. `ExternalServiceValidator` class exists with `run(check)` method
  2. Validates: service health, version compatibility, authentication
  3. Returns structured results with success/failure
  4. Configurable timeouts and retries
- **Devon Instructions**:
  - Create `backend/src/services/validators/ExternalServiceValidator.js`
  - Implement health checks for PostgreSQL, Redis, etc.
  - Add version compatibility checking
- **Tara Instructions**:
  - Write integration tests with mock services
  - Test service health validation
  - Test version compatibility checking
- **Estimated Steps**: 2-3 (validator + integration)

#### Subtask 2-10-5: Validation Profile System
- **Description**: Create YAML/JSON-based validation profiles for different subtask types.
- **Dependencies**: 2-10-1 (Core service)
- **Acceptance Criteria**:
  1. Validation profile system loads from `.Docs/validation_profiles/`
  2. Different profiles for database, filesystem, service subtasks
  3. Profile inheritance and composition supported
  4. Auto-generated profiles for existing subtasks
- **Devon Instructions**:
  - Create profile directory structure
  - Implement profile loader with inheritance
  - Create profiles for existing subtask types
  - Add profile validation (schema validation)
- **Tara Instructions**:
  - Write tests for profile loading and inheritance
  - Test profile validation
  - Verify auto-generation for existing subtasks
- **Estimated Steps**: 2-3 (profile system + generation)

#### Subtask 2-10-6: StepDecomposer Integration
- **Description**: Integrate IntegrationReadinessService with StepDecomposer for automatic validation before step creation.
- **Dependencies**: 2-10-1 (Core service), 2-2-1 (StepDecomposer)
- **Acceptance Criteria**:
  1. StepDecomposer validates integration readiness before creating steps
  2. `IntegrationNotReadyError` thrown with remediation details
  3. Validation results stored in trace events
  4. Orion receives clear error messages with remediation steps
- **Devon Instructions**:
  - Update `StepDecomposer.js` to call IntegrationReadinessService
  - Create `IntegrationNotReadyError` class
  - Store validation results in trace events
  - Format remediation for Orion consumption
- **Tara Instructions**:
  - Write integration tests for validation failure scenarios
  - Test error propagation to Orion
  - Verify trace event storage
- **Estimated Steps**: 2 (integration + error handling)

#### Subtask 2-10-7: Task Orchestrator Integration
- **Description**: Integrate with TaskOrchestrator for proactive validation in Orion's workflow.
- **Dependencies**: 2-10-1 (Core service), existing TaskOrchestrator
- **Acceptance Criteria**:
  1. TaskOrchestrator validates integration readiness before subtask execution
  2. Orion receives proactive warnings about integration issues
  3. Smart subtask sequencing based on dependency readiness
  4. Remediation skills can be executed to fix issues
- **Devon Instructions**:
  - Update `TaskOrchestrator.js` (or equivalent) to call IntegrationReadinessService
  - Implement proactive validation in Orion's main loop
  - Add smart sequencing based on validation results
  - Integrate with Skill Framework for remediation
- **Tara Instructions**:
  - Write end-to-end tests for proactive validation
  - Test smart sequencing logic
  - Verify remediation skill integration
- **Estimated Steps**: 3-4 (orchestrator integration + skills)

#### Subtask 2-10-8: Update Existing Subtask Definitions
- **Description**: Update all existing Feature 2 subtasks to include integration validation steps.
- **Dependencies**: 2-10-5 (Validation profiles)
- **Acceptance Criteria**:
  1. All Feature 2 subtasks (2-1-1 through 2-9-x) updated with integration requirements
  2. Integration validation steps added to subtask lifecycles
  3. Documentation updated to reflect new workflow
  4. Backward compatibility maintained for existing tests
- **Devon Instructions**:
  - Update Feature2_Skills_Aider_Integration_v5.md
  - Add integration requirements to each subtask
  - Update subtask lifecycle diagrams
  - Create validation profiles for each subtask type
- **Tara Instructions**:
  - Verify all subtasks have integration requirements
  - Test backward compatibility of existing tests
  - Validate documentation clarity
- **Estimated Steps**: 2 (documentation updates + validation profiles)

#### Subtask 2-10-9: Performance Optimization & Caching
- **Description**: Implement caching and optimization to keep validation overhead minimal.
- **Dependencies**: 2-10-1 through 2-10-6
- **Acceptance Criteria**:
  1. Validation results cached with TTL (5 minutes)
  2. Parallel validation for independent checks
  3. Validation time <2 seconds for typical subtasks
  4. Cache invalidation on state changes (git commits, migrations)
- **Devon Instructions**:
  - Implement caching layer in IntegrationReadinessService
  - Add parallel validation using Promise.all
  - Add cache invalidation triggers
  - Optimize database queries for validation
- **Tara Instructions**:
  - Write performance tests
  - Test cache hit/miss behavior
  - Verify parallel validation correctness
- **Estimated Steps**: 2-3 (caching + optimization)

#### Subtask 2-10-10: E2E Testing & Validation
- **Description**: Comprehensive end-to-end testing of the entire integration readiness workflow.
- **Dependencies**: 2-10-1 through 2-10-9
- **Acceptance Criteria**:
  1. E2E tests cover all validation scenarios
  2. False positive rate <5% in simulated environments
  3. Remediation success >80% in automated tests
  4. Developer workflow improvements demonstrated
- **Devon Instructions**:
  - Create E2E test suite in `backend/tests/e2e/integration_readiness.spec.js`
  - Simulate integration failure scenarios
  - Test automatic remediation flows
  - Measure performance and accuracy metrics
- **Tara Instructions**:
  - Run E2E test suite
  - Verify false positive rate
  - Test remediation success rate
  - Validate developer experience improvements
- **Estimated Steps**: 2-3 (E2E tests + metrics)

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
3. **2-3: Skills Framework** (Basic implementation + **2-3-9 WritePlanTool** + **2-3-10 Content Validation Helper** + **2-3-11 Task Preparation Assistant**)
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
1. **Review structured subtasks** for Tasks 2-4 through 2-9 (follows same pattern)
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
- **v4.0**: Incorporates findings from PCC, CAP, RED analyses and ADR mapping with detailed subtasks
- **v5.0**: Structured subtasks with clear Devon/Tara instructions and 3-step completion constraint
- **v5.1**: Added Subtask 2-3-10 (Content Validation Helper with Orion Repair Loop)
- **v5.2**: **Current** - Added Subtask 2-3-11 (Task Preparation Assistant Skill with 11-step flow)

---

*Document approved for implementation on 2026-01-01*  
*Architect: Adam*  
*Status: Ready for implementation with structured subtasks – MVP focused on Tasks 2-1 through 2-7 and 2-9*
