# Devon Implementation Instructions: Subtask 2-1-5 - DatabaseTool Step Methods

## Overview
Implement 5 new methods in `DatabaseTool.js` for managing steps in the `steps` table. These methods will enable step‑based workflow tracking within subtasks.

## Database Schema Reference

### Steps Table (from migration `0003_steps_table.sql`)
```sql
CREATE TABLE IF NOT EXISTS steps (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    subtask_id INTEGER NOT NULL REFERENCES subtasks(id),
    step_number INTEGER NOT NULL,
    step_type step_type NOT NULL,
    file_path TEXT,
    instructions TEXT,
    status status NOT NULL,
    assigned_to assigned_to NOT NULL,
    context_snapshot JSON,
    context_files JSONB,
    attempt_count INTEGER DEFAULT 0,
    last_error TEXT,
    parent_step_id INTEGER REFERENCES steps(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### ENUM Types (from migration `0002_step_enum_types.sql`)
```sql
-- step_type ENUM
CREATE TYPE step_type AS ENUM ('implementation', 'test');

-- status ENUM
CREATE TYPE status AS ENUM ('pending', 'in_progress', 'completed', 'failed');

-- assigned_to ENUM
CREATE TYPE assigned_to AS ENUM ('TaraAider', 'DevonAider');

-- Note: work_stage ENUM exists but is NOT a column in the steps table.
```

## Methods to Implement

### 1. `create_step`
Creates a new step record.

**Signature:**
```javascript
async create_step(project_id, subtask_id, step_number, step_type, assigned_to, file_path, instructions, context_files = [], parent_step_id = null, reason = '')
```

**Parameters:**
- `project_id` (integer): Internal ID of the project (must exist in `projects` table).
- `subtask_id` (integer): Internal ID of the subtask (must exist in `subtasks` table).
- `step_number` (integer): Sequential number of the step within the subtask.
- `step_type` (string): Must be a valid `step_type` ENUM value.
- `assigned_to` (string): Must be a valid `assigned_to` ENUM value.
- `file_path` (string or null): Path to the file associated with the step.
- `instructions` (string): Step instructions/description.
- `context_files` (array of strings, default `[]`): List of file paths for context.
- `parent_step_id` (integer or null, default `null`): Optional parent step ID.
- `reason` (string, default `''`): Reason for creation (used in activity log).

**Validation Required:**
- Foreign key existence: `project_id`, `subtask_id`, `parent_step_id` (if provided).
- ENUM validation: `step_type`, `assigned_to`. Use the existing ENUM values from the database.
- JSON validation: `context_files` must be an array of strings.
- Default values: `status` defaults to `'pending'`, `attempt_count` defaults to `0`, `last_error` defaults to `null`.
- Ensure `step_number` is positive and unique per subtask (or handle auto‑increment if not provided? The test expects auto‑increment behavior when not provided, but the method signature requires `step_number`. Clarify: The test says "should increment step_number automatically if not provided". We need to decide: either make `step_number` optional and auto‑increment, or require it and let the caller compute. Look at the test: the expected signature includes `step_number` as a parameter, but there is a test for auto‑increment. We'll follow the test expectation: if `step_number` is not provided (or is `null`/`undefined`), determine the next available number for that subtask.

**Return:** The newly created step object (all columns).

### 2. `update_step`
Updates an existing step.

**Signature:**
```javascript
async update_step(step_id, updates, reason = '')
```

**Parameters:**
- `step_id` (integer): Internal ID of the step to update.
- `updates` (object): Fields to update. Allowed fields: `instructions`, `status`, `context_files`, `attempt_count`, `last_error`. Also allowed: `file_path`, `step_type`, `assigned_to`, `parent_step_id` (with validation).
- `reason` (string): Reason for update (used in activity log).

**Validation Required:**
- Step must exist.
- Immutable fields cannot be changed: `id`, `created_at`, `project_id`, `subtask_id`, `step_number`? (The test says cannot update `id`, `created_at`. We should also disallow changing `project_id` and `subtask_id` because they are foreign keys and would break relationships. `step_number` might be allowed to reorder steps? The test does not specify, but we'll follow the principle that core identifiers should not change.)
- ENUM validation for `status`, `step_type`, `assigned_to` if provided.
- Foreign key validation for `parent_step_id` if provided.
- JSON validation for `context_files` if provided.
- `updated_at` must be automatically set to `NOW()`.

**Return:** The updated step object.

### 3. `get_step`
Retrieves a single step by its ID.

**Signature:**
```javascript
async get_step(step_id)
```

**Parameters:**
- `step_id` (integer): Internal ID of the step.

**Behavior:**
- Returns the full step record.
- If step does not exist, returns `null` (or throws an error? The test expects either `null` or error. We'll follow the existing pattern in DatabaseTool: `_findSubtaskByIdOrExternal` throws an error. However, the test says "Invalid ID Returns Null/Error". We'll decide: throw an error with descriptive message, consistent with other `get_*` methods (but note there are no other `get_*` methods in DatabaseTool yet). Look at `_findSubtaskByIdOrExternal` – it throws. We'll throw an error.)

**Return:** Step object.

### 4. `list_steps_by_subtask`
Lists all steps for a given subtask, ordered by `step_number` ascending.

**Signature:**
```javascript
async list_steps_by_subtask(subtask_id, limit = null, offset = null)
```

**Parameters:**
- `subtask_id` (integer): Internal ID of the subtask.
- `limit` (integer, optional): Maximum number of steps to return.
- `offset` (integer, optional): Number of steps to skip (for pagination).

**Behavior:**
- Returns an array of step objects.
- If subtask has no steps, returns empty array `[]`.
- If `subtask_id` does not exist, returns empty array (or error? The test says "Invalid subtask_id Handled" – expects empty array or error. We'll follow the pattern of `list_subtasks_for_task` which returns empty array if task has no subtasks, but if task doesn't exist? That method first resolves the task (throws if not found). So we should first validate the subtask exists; if not, throw an error.)

**Return:** Array of step objects.

### 5. `get_steps_by_status`
Filters steps by status, optionally filtered by project.

**Signature:**
```javascript
async get_steps_by_status(status, project_id = null, limit = null, offset = null)
```

**Parameters:**
- `status` (string): Must be a valid `status` ENUM value.
- `project_id` (string, optional): Project external ID (e.g., `'P1'`). If provided, filter steps belonging to that project.
- `limit` (integer, optional): Maximum number of steps to return.
- `offset` (integer, optional): Number of steps to skip.

**Validation:**
- Validate `status` ENUM value.
- If `project_id` is provided, resolve to internal project ID (use `_findProjectByIdOrExternal` helper to be created).

**Behavior:**
- Returns steps matching the status (and project if given), ordered by `created_at` descending (as per test expectation).
- Returns empty array if no matches.

**Return:** Array of step objects.

## Implementation Guidelines

### 1. Follow Existing Patterns
- Use the same error handling style as other DatabaseTool methods (throw descriptive errors).
- Use `_checkRole()` at the start of each public method.
- Use `_addToActivityLog` for create/update operations (log as entity type `'step'`? The activity log currently supports `'feature'`, `'task'`, `'subtask'`. We need to extend it to support `'step'` or use a generic logging approach. Check `ActivityLogTool` – does it support arbitrary entity types? The `logActivity` method expects `entityType` as one of the three. We may need to extend the activity log tool or create a separate logging for steps. For now, we can skip activity logging for steps, but the test expects logging. We'll need to decide: either add support for `'step'` in `ActivityLogTool` or log under the parent subtask. Since steps are children of subtasks, we can log under the subtask. Let's adopt that: when a step is created/updated, log an activity on the subtask with type `'step_creation'` or `'step_update'`.)

### 2. Validation Helpers
Create private helper methods:
- `_validateStepType(value)`: checks against ENUM.
- `_validateStatus(value)`: checks against ENUM.
- `_validateAssignedTo(value)`: checks against ENUM.
- `_validateContextFiles(value)`: ensures it's an array of strings.

Use the existing `_findProjectByIdOrExternal` (to be created) and `_findSubtaskByIdOrExternal` (already exists) for foreign key validation.

### 3. Error Messages
Provide clear, consistent error messages:
- `Project not found`
- `Subtask not found`
- `Invalid step_type: must be one of 'implementation', 'test'`
- `context_files must be an array`
- `Step not found`
- etc.

### 4. Transaction Handling
For `create_step` and `update_step`, use a database transaction (follow the pattern in `update_subtask_sections`).

### 5. Testing
All methods must pass the existing test suite: `backend/tools/__tests__/DatabaseTool.steps.test.js`. This is a TDD RED phase, so after implementation all tests should pass (GREEN phase).

## Step-by-Step Implementation Plan

1. **Add helper methods** in DatabaseTool class:
   - `_findProjectByIdOrExternal(projectId)`: resolves project internal ID.
   - `_validateStepType`, `_validateStatus`, `_validateAssignedTo`, `_validateContextFiles`.
   - `_findStepById(stepId)`: returns step or throws.

2. **Implement `create_step`**:
   - Validate all parameters.
   - If `step_number` is not provided, compute the next number for the subtask.
   - Insert into `steps` table.
   - Log activity under the subtask (entityType `'subtask'`, entityId = subtask_id, type `'step_creation'`).
   - Return the new step.

3. **Implement `update_step`**:
   - Validate step exists.
   - Validate updates (allowed fields, ENUMs, foreign keys).
   - Update `steps` table, set `updated_at = NOW()`.
   - Log activity under the subtask (type `'step_update'`).
   - Return updated step.

4. **Implement `get_step`**:
   - Simple query by ID, throw if not found.

5. **Implement `list_steps_by_subtask`**:
   - Validate subtask exists (throw if not).
   - Query steps ordered by `step_number ASC`.
   - Apply limit/offset if provided.

6. **Implement `get_steps_by_status`**:
   - Validate status ENUM.
   - If project_id provided, resolve project internal ID.
   - Build query with joins to filter by project if needed.
   - Order by `created_at DESC`.
   - Apply limit/offset.

## Example Usage

```javascript
// Create a step
const step = await DatabaseTool.create_step(
  1, // project_id (internal)
  1, // subtask_id (internal)
  1, // step_number
  'implementation',
  'DevonAider',
  null, // file_path
  'Implement the DatabaseTool methods',
  ['backend/tools/DatabaseTool.js']
);

// Update a step
const updated = await DatabaseTool.update_step(step.id, {
  status: 'in_progress',
  instructions: 'Updated instructions'
});

// Get a step
const retrieved = await DatabaseTool.get_step(step.id);

// List steps for a subtask
const steps = await DatabaseTool.list_steps_by_subtask(1);

// Get steps by status
const pendingSteps = await DatabaseTool.get_steps_by_status('pending', 'P1');
```

## Success Criteria

- All 5 methods implemented with correct signatures.
- All unit tests pass (currently 54 failing tests in RED phase).
- Follows existing DatabaseTool patterns and conventions.
- Proper error handling and validation.
- Includes activity logging for create/update operations (under the parent subtask).

## Notes

- The `steps` table has a `context_snapshot` JSON column, but it is not required for this implementation (can be left as `null`).
- The `work_stage` ENUM exists but is not a column in the `steps` table; do not include it.
- Ensure the `assigned_to` ENUM values are exactly `'TaraAider'` and `'DevonAider'` (case-sensitive as defined in the database).
- The `status` ENUM includes `'pending'`, `'in_progress'`, `'completed'`, `'failed'` (no `'blocked'` as in some older documentation).

## Next Steps After Implementation

1. Run the test suite: `npm test -- tools/__tests__/DatabaseTool.steps.test.js`
2. Verify all tests pass (GREEN phase).
3. Integrate with StepDecomposer or other components that will use these methods.

---
*Created by Adam (Architect) on 2026-01-06*
