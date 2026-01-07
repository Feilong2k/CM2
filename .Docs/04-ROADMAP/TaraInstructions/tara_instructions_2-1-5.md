# Tara Instructions: Subtask 2-1-5 - DatabaseTool Methods for Step Management

## Overview
Test the implementation of 5 new DatabaseTool methods for managing steps in the `steps` table.

## Dependencies Verified
- ✅ `steps` table exists (from 2-1-2)
- ✅ ENUM types exist: `step_type`, `status`, `assigned_to` (from migration 0002_step_enum_types.sql)
- ✅ `projects` table has P1 record (internal integer id)
- ✅ `subtasks` table has records for testing

## Test Environment Setup

### 1. Database Setup
```javascript
// Required test data:
const TEST_PROJECT_ID = 'P1';  // Must exist (external_id)
const TEST_SUBTASK_ID = '2-1-5'; // Use existing subtask external ID or create test one
const VALID_ENUM_VALUES = {
  step_type: ['implementation', 'test'],
  status: ['pending', 'in_progress', 'completed', 'failed'],
  assigned_to: ['TaraAider', 'DevonAider']
};
// Note: work_stage ENUM exists but is not a column in steps table
```

### 2. Test Helper Functions Needed
Create these in test setup:
```javascript
async function createTestStep(overrides = {}) {
  // Helper to create a step for testing updates/retrieval
}

async function cleanupTestSteps() {
  // Clean up all test steps after each test
}
```

## Test Specifications

### Method 1: `create_step`

#### Test Cases:
1. **Valid Input Creates Step**
   - Input: All required fields with valid values (project_id integer, subtask_id integer, step_number integer, step_type enum, assigned_to enum, status enum, instructions text)
   - Expect: Step created successfully, returns step object with all fields
   - Verify: `id` is generated, `created_at` and `updated_at` are set

2. **Invalid project_id Throws Error**
   - Input: `project_id` that doesn't exist (integer)
   - Expect: Error with descriptive message
   - Verify: No step created in database

3. **Invalid subtask_id Throws Error**
   - Input: `subtask_id` that doesn't exist (integer or string external ID)
   - Expect: Error with descriptive message
   - Verify: No step created in database

4. **Invalid ENUM Values Rejected**
   - Test each ENUM field with invalid value:
     - `step_type: 'invalid_type'`
     - `status: 'invalid_status'`
     - `assigned_to: 'invalid_agent'`
   - Expect: Error for each invalid ENUM
   - Note: `work_stage` is not a column in steps table

5. **context_files JSON Validation**
   - Valid: `[]` (empty array)
   - Valid: `['file1.js', 'file2.md']`
   - Invalid: `'not an array'` (string)
   - Invalid: `{key: 'value'}` (object)
   - Expect: Error for invalid JSON structure

6. **Default Values Applied**
   - Test: Omit optional fields
   - Verify defaults:
     - `context_files: []`
     - `attempt_count: 0`
     - `last_error: null`
     - `parent_step_id: null`
     - `status: 'pending'`

7. **Parent Step Validation**
   - Valid: `parent_step_id` that exists
   - Invalid: `parent_step_id` that doesn't exist
   - Expect: Error for invalid parent step

### Method 2: `update_step`

#### Test Cases:
1. **Valid Update Modifies Step**
   - Setup: Create test step
   - Update: Change `instructions`, `status` to 'in_progress'
   - Expect: Step updated, `updated_at` changed
   - Verify: `created_at` unchanged

2. **Cannot Update Immutable Fields**
   - Attempt to update: `id`, `created_at`
   - Expect: Error or field ignored (specify behavior)
   - Verify: Immutable fields unchanged

3. **Partial Updates Work**
   - Update only `status` field
   - Update only `instructions` field
   - Update only `context_files`
   - Expect: Only specified fields changed, others unchanged

4. **Invalid step_id Throws Error**
   - Input: Non-existent step ID
   - Expect: Error with descriptive message

5. **ENUM Validation on Update**
   - Attempt to update `status` to invalid value
   - Attempt to update `step_type` to invalid value
   - Expect: Error for invalid ENUM

6. **Foreign Key Validation**
   - Attempt to update `subtask_id` to invalid value
   - Attempt to update `parent_step_id` to invalid value
   - Expect: Error for invalid foreign key

7. **JSON Validation on Update**
   - Attempt to update `context_files` to invalid JSON
   - Expect: Error for invalid JSON structure

### Method 3: `get_step`

#### Test Cases:
1. **Returns Correct Step by ID**
   - Setup: Create test step with known data
   - Retrieve: Using step's `id`
   - Expect: Returns exact step data
   - Verify: All fields match created data

2. **Invalid ID Returns Null/Error**
   - Input: Non-existent step ID
   - Expect: Returns `null` or throws error (specify)
   - Verify: Consistent with other `get_*` methods

3. **Handles Deleted Parent Step**
   - Setup: Step with `parent_step_id`, then delete parent
   - Retrieve: Child step
   - Expect: Returns step with `parent_step_id` still set (foreign key may be broken)
   - Note: Test database constraint behavior

### Method 4: `list_steps_by_subtask`

#### Test Cases:
1. **Returns All Steps for Subtask**
   - Setup: Create 3 steps for same subtask
   - Retrieve: List for that subtask
   - Expect: Array of 3 steps
   - Verify: All steps belong to correct subtask

2. **Empty Array for No Steps**
   - Setup: No steps for subtask
   - Retrieve: List for subtask
   - Expect: Empty array `[]`

3. **Correct Ordering**
   - Setup: Steps with `step_number`: 3, 1, 2
   - Expect: Ordered by `step_number` ascending
   - Verify: `[step1, step2, step3]`

4. **Invalid subtask_id Handled**
   - Input: Non-existent subtask ID
   - Expect: Empty array or error (specify)

5. **Includes All Fields**
   - Verify returned steps include all columns
   - Especially: `context_files`, `attempt_count`, `last_error`

### Method 5: `get_steps_by_status`

#### Test Cases:
1. **Filters Correctly by Status**
   - Setup: Create steps with different statuses
   - Filter: `status: 'pending'`
   - Expect: Only steps with `status = 'pending'`

2. **Works with All ENUM Values**
   - Test each status: 'pending', 'in_progress', 'completed', 'failed'
   - Expect: Correct filtering for each

3. **Empty Array for No Matches**
   - Setup: No steps with `status: 'failed'`
   - Filter: `status: 'failed'`
   - Expect: Empty array `[]`

4. **Combined with project Filter**
   - Method accepts `project_id` (string external ID) to filter by project
   - Test: `status: 'pending'` + `project_id: 'P1'`
   - Expect: Steps matching both criteria

5. **Performance with Many Steps**
   - Setup: 100+ steps with mixed statuses
   - Filter: Specific status
   - Expect: Reasonable performance (< 100ms)
   - Verify: Uses appropriate indexes

## Integration Tests

### 1. Basic Workflow Integration
```javascript
// Test that a typical workflow can use these methods:
async function testBasicWorkflowIntegration() {
  // 1. Create step via DatabaseTool
  const step = await DatabaseTool.create_step(...);
  
  // 2. Update step status as work progresses
  await DatabaseTool.update_step(step.id, { status: 'in_progress' });
  
  // 3. Retrieve step for processing
  const retrieved = await DatabaseTool.get_step(step.id);
  
  // 4. List all steps for subtask
  const allSteps = await DatabaseTool.list_steps_by_subtask(TEST_SUBTASK_ID);
  
  // 5. Filter by status
  const pendingSteps = await DatabaseTool.get_steps_by_status('pending', 'P1');
}
```

### 2. Transaction Handling
- Test: `create_step` within transaction, then rollback
- Expect: Step not persisted after rollback
- Verify: Transaction isolation works

### 3. Concurrent Access
- Test: Multiple concurrent updates to same step
- Expect: Last update wins or error (specify)
- Verify: Data consistency maintained

## Edge Cases to Test

### 1. Null/Empty Values
- `file_path: null` vs `file_path: ''`
- `instructions: null` vs `instructions: ''`
- `context_files: []` (empty array)
- `last_error: null`

### 2. Maximum Lengths
- Very long `instructions` (10,000+ characters)
- Many files in `context_files` array (100+ items)
- Long `file_path` strings

### 3. Special Characters
- `instructions` with Unicode, emojis, SQL injection attempts
- `file_path` with special characters: `..`, `~`, spaces
- `context_files` with unusual filenames

### 4. Database Constraints
- Attempt to delete subtask with existing steps (foreign key constraint)
- Attempt to delete project with existing steps
- Attempt to create circular parent references

## Performance Requirements

### 1. Response Times
- `get_step`: < 50ms
- `list_steps_by_subtask`: < 100ms for 100 steps
- `get_steps_by_status`: < 100ms for 1000 steps

### 2. Memory Usage
- Handle `context_files` with 1000+ items without memory issues
- Large result sets should stream or paginate

### 3. Concurrent Performance
- 10 concurrent `create_step` operations
- 50 concurrent `get_step` operations

## Error Handling Verification

### 1. Error Messages
- Descriptive error messages for validation failures
- Include field names in error messages
- Consistent error format with existing DatabaseTool methods

### 2. Error Recovery
- Failed `create_step` doesn't leave partial data
- Failed `update_step` doesn't corrupt existing data
- Transaction rollback works correctly

### 3. Logging
- Activity log entries for create/update operations
- Error details logged for debugging
- Consistent with existing logging patterns

## Test Implementation Notes

### 1. Test Structure
```javascript
describe('DatabaseTool Step Methods', () => {
  beforeEach(async () => {
    await cleanupTestSteps();
  });

  describe('create_step', () => {
    // Test cases here
  });

  describe('update_step', () => {
    // Test cases here
  });

  // ... other methods
});
```

### 2. Mock Database
- Use test database with migrations applied
- Isolate tests with transactions or cleanup
- Reset database state between tests

### 3. Test Data Factory
```javascript
function buildStepData(overrides = {}) {
  // Note: project_id and subtask_id must be internal integer IDs or external IDs that can be resolved.
  // For testing, you may need to look up actual IDs from the database.
  return {
    project_id: 1, // internal id for project P1
    subtask_id: 1, // internal id for a test subtask
    step_number: 1,
    step_type: 'implementation',
    assigned_to: 'DevonAider',
    status: 'pending',
    file_path: null,
    instructions: 'Test instructions',
    context_files: [],
    attempt_count: 0,
    last_error: null,
    parent_step_id: null,
    ...overrides
  };
}
```

## Success Criteria

### Must Pass (Blocking):
1. ✅ All 5 methods implemented with correct signatures
2. ✅ All unit tests pass (100+ test cases)
3. ✅ Follows existing DatabaseTool patterns
4. ✅ Handles all validation scenarios
5. ✅ Proper error handling and messages

### Should Pass (Important):
1. ✅ Integration with StepDecomposer works
2. ✅ Performance requirements met
3. ✅ Comprehensive edge case coverage
4. ✅ Consistent with existing codebase patterns

### Could Have (Nice-to-have):
1. ✅ Pagination support for large result sets
2. ✅ Advanced filtering options
3. ✅ Bulk operations support

## Test Execution Order

1. **Unit Tests** (isolated method testing)
2. **Integration Tests** (method interactions)
3. **Performance Tests** (response times, concurrency)
4. **Edge Case Tests** (boundary conditions)
5. **Acceptance Tests** (end-to-end workflow)

## Reporting Requirements

### Test Report Should Include:
1. Test coverage percentage for new methods
2. Performance metrics for each method
3. Any failing edge cases with explanations
4. Recommendations for improvements
5. Verification of success criteria

### Pass/Fail Criteria:
- **PASS**: All must-pass criteria met, < 5% of should-pass criteria failed
- **FAIL**: Any must-pass criteria failed, or > 20% of should-pass criteria failed
- **CONDITIONAL PASS**: All must-pass criteria met, but significant should-pass failures

## Next Steps After Testing

1. **If PASS**: Proceed to Devon implementation review
2. **If CONDITIONAL PASS**: Address critical issues, retest
3. **If FAIL**: Return to Devon for fixes, create new test cycle

## Notes for Test Implementation

1. **Check existing test patterns** in `DatabaseTool.test.js` for consistency
2. **Use same mocking approach** as existing tests
3. **Follow same assertion patterns** (expect, should, assert)
4. **Include activity log verification** where applicable
5. **Test with real database** not just mocks for integration tests
