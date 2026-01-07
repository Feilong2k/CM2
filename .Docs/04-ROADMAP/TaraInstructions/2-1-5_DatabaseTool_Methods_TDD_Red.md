# TDD Red Phase: Test Instructions for Subtask 2-1-5

## TDD Workflow Reminder
**RED → GREEN → REFACTOR → REVIEW**
- **RED:** Tara writes failing tests (this phase)
- **GREEN:** Devon implements to make tests pass
- **REFACTOR:** Devon improves implementation
- **REVIEW:** Tara reviews implementation

## Current Phase: RED
**Objective:** Write comprehensive failing tests for the 5 DatabaseTool methods before any implementation exists.

## Test Setup for Red Phase

### 1. Create Test File
```javascript
// backend/tools/__tests__/DatabaseTool.steps.test.js
// NEW FILE - Tests for step management methods
```

### 2. Import DatabaseTool
```javascript
const DatabaseTool = require('../DatabaseTool');
```

### 3. Mock Database (Red Phase)
Since methods don't exist yet, we'll test that:
1. Methods are undefined or throw appropriate errors
2. We can define the expected method signatures
3. Test suites compile and run (but fail)

## Test Specifications for RED Phase

### Method 1: `create_step` - Should NOT Exist Yet

#### Test Cases (All Should FAIL):
```javascript
describe('create_step method (RED PHASE)', () => {
  test('method should not exist yet', () => {
    expect(DatabaseTool.create_step).toBeUndefined();
    // OR if method stub exists but throws:
    // expect(() => DatabaseTool.create_step()).toThrow();
  });

  test('attempting to call should fail', async () => {
    await expect(DatabaseTool.create_step?.()).rejects.toThrow();
  });

  test('define expected signature for implementation', () => {
    // This test documents what Devon should implement
    const expectedSignature = {
      name: 'create_step',
      params: ['project_id', 'subtask_id', 'step_number', 'step_type', 'assigned_to', 'file_path', 'instructions', 'context_files', 'parent_step_id'],
      returns: 'Promise<object>'
    };
    // Test will fail until Devon implements it
    expect(DatabaseTool).toHaveProperty('create_step');
  });
});
```

### Method 2: `update_step` - Should NOT Exist Yet

#### Test Cases:
```javascript
describe('update_step method (RED PHASE)', () => {
  test('method should not exist yet', () => {
    expect(DatabaseTool.update_step).toBeUndefined();
  });

  test('define expected behavior', () => {
    // Document what Devon should implement
    const expectedBehavior = {
      canUpdate: ['instructions', 'status', 'context_files', 'attempt_count', 'last_error'],
      cannotUpdate: ['id', 'created_at'],
      validates: ['step_id exists', 'ENUM values', 'foreign keys']
    };
    // This assertion will fail until implemented
    expect(DatabaseTool).toHaveProperty('update_step');
  });
});
```

### Method 3: `get_step` - Should NOT Exist Yet

#### Test Cases:
```javascript
describe('get_step method (RED PHASE)', () => {
  test('method should not exist yet', () => {
    expect(DatabaseTool.get_step).toBeUndefined();
  });

  test('define expected return format', () => {
    const expectedReturn = {
      id: 'expect string',
      project_id: 'expect string',
      subtask_id: 'expect string',
      step_number: 'expect number',
      // ... all other fields
    };
    // Will fail until implemented
    expect(DatabaseTool).toHaveProperty('get_step');
  });
});
```

### Method 4: `list_steps_by_subtask` - Should NOT Exist Yet

#### Test Cases:
```javascript
describe('list_steps_by_subtask method (RED PHASE)', () => {
  test('method should not exist yet', () => {
    expect(DatabaseTool.list_steps_by_subtask).toBeUndefined();
  });

  test('define expected array return', () => {
    // Should return array of steps
    const expectedReturnType = 'Array<object>';
    // Will fail until implemented
    expect(DatabaseTool).toHaveProperty('list_steps_by_subtask');
  });
});
```

### Method 5: `get_steps_by_status` - Should NOT Exist Yet

#### Test Cases:
```javascript
describe('get_steps_by_status method (RED PHASE)', () => {
  test('method should not exist yet', () => {
    expect(DatabaseTool.get_steps_by_status).toBeUndefined();
  });

  test('define expected filtering behavior', () => {
    const expectedBehavior = {
      filtersBy: 'status enum value',
      returns: 'Array<step objects>',
      handles: 'empty results gracefully'
    };
    // Will fail until implemented
    expect(DatabaseTool).toHaveProperty('get_steps_by_status');
  });
});
```

## Integration Tests (RED Phase)

### Test That StepDecomposer Cannot Use Methods Yet:
```javascript
describe('StepDecomposer integration (RED PHASE)', () => {
  test('StepDecomposer should fail when trying to use step methods', async () => {
    // Simulate what StepDecomposer would try to do
    const stepDecomposerAttempt = async () => {
      // These should all fail
      await DatabaseTool.create_step?.();
      await DatabaseTool.get_step?.();
      await DatabaseTool.update_step?.();
    };
    
    await expect(stepDecomposerAttempt()).rejects.toThrow();
  });
});
```

## Validation Tests (RED Phase)

### Test That Validation Doesn't Exist Yet:
```javascript
describe('Validation (RED PHASE)', () => {
  test('project validation helper does not exist', () => {
    expect(DatabaseTool._findProjectByIdOrExternal).toBeUndefined();
  });

  test('JSON validation does not exist', () => {
    expect(DatabaseTool._validateContextFiles).toBeUndefined();
  });

  test('ENUM validation does not exist', () => {
    // Check that validation for step_type, status, etc. doesn't exist
    expect(DatabaseTool._validateStepType).toBeUndefined();
    expect(DatabaseTool._validateStatus).toBeUndefined();
  });
});
```

## Error Handling Tests (RED Phase)

### Test That Error Patterns Don't Exist:
```javascript
describe('Error handling (RED PHASE)', () => {
  test('create_step error messages not defined', () => {
    // These error messages should be defined by Devon
    const expectedErrors = [
      'Project not found',
      'Subtask not found',
      'Invalid step_type',
      'Invalid status',
      'context_files must be an array'
    ];
    
    // Since methods don't exist, we can't test error messages
    // But we document what should exist
    expect(DatabaseTool.create_step).toBeUndefined();
  });
});
```

## Test Execution Commands for RED Phase

### 1. Run Tests (Should All FAIL):
```bash
cd backend
npm test -- DatabaseTool.steps.test.js
```

**Expected Result:** All tests fail because:
- Methods are undefined
- Method stubs don't exist
- Implementation is missing

### 2. Test Coverage Report (Should Show 0% for New Methods):
```bash
npm test -- --coverage --testPathPattern=DatabaseTool.steps.test.js
```

**Expected:** 0% coverage for the 5 new methods.

## Success Criteria for RED Phase

### What "RED" Means:
1. ✅ **All tests written** before any implementation
2. ✅ **All tests fail** because methods don't exist
3. ✅ **Test suite compiles** without syntax errors
4. ✅ **Test expectations are clear** for Devon
5. ✅ **Edge cases documented** in test descriptions

### Specific RED Phase Deliverables:
1. **File:** `DatabaseTool.steps.test.js` with 50+ test cases
2. **Status:** All tests failing (RED)
3. **Coverage:** 0% for new methods
4. **Documentation:** Clear expectations in test descriptions

## Test Data for RED Phase

### Mock Data Definitions (Not Used Yet):
```javascript
// Define test data structure for when Devon implements
const TEST_STEP_DATA = {
  project_id: 'P1',
  subtask_id: '2-1-5',
  step_number: 1,
  step_type: 'feature',
  assigned_to: 'devon',
  status: 'pending',
  work_stage: 'planning',
  file_path: null,
  instructions: 'Implement DatabaseTool methods',
  context_files: [],
  attempt_count: 0,
  last_error: null,
  parent_step_id: null
};

// This data won't be used until GREEN phase
```

## Next Steps After RED Phase

### Tara's Completion Checklist:
1. [ ] Write all failing tests for 5 methods
2. [ ] Test suite runs without syntax errors
3. [ ] All tests fail (as expected)
4. [ ] Test expectations are clearly documented
5. [ ] File saved to `backend/tools/__tests__/DatabaseTool.steps.test.js`

### Handoff to Devon:
**Message to Devon:** "I've written comprehensive failing tests for the 5 DatabaseTool step methods. All tests are in RED state. Your task is to implement the methods to make all tests pass (GREEN phase)."

## Important Notes for Tara

### Do NOT:
- ❌ Implement any DatabaseTool methods
- ❌ Create method stubs that partially work
- ❌ Modify existing DatabaseTool.js file
- ❌ Make any tests pass

### Do:
- ✅ Write clear, failing tests
- ✅ Document expected behavior in test descriptions
- ✅ Include edge cases and error scenarios
- ✅ Follow existing test patterns from other DatabaseTool tests
- ✅ Ensure tests compile and run (but fail)

### Test Pattern to Follow:
Look at existing `DatabaseTool.test.js` for:
- Mock database patterns
- Error assertion styles
- Async/await patterns
- Test structure and organization

## Verification of RED Phase

### How to Verify Tests Are Properly RED:
1. Run test suite - should see 50+ failing tests
2. Check console output - all tests should show as failing
3. Verify no syntax errors - tests compile successfully
4. Confirm test descriptions clearly state what should be implemented

### Example of Proper RED Test Output:
```
FAIL  backend/tools/__tests__/DatabaseTool.steps.test.js
  create_step method (RED PHASE)
    ✕ method should not exist yet (5 ms)
    ✕ attempting to call should fail (2 ms)
    ✕ define expected signature for implementation (1 ms)
  
  update_step method (RED PHASE)
    ✕ method should not exist yet (1 ms)
    ✕ define expected behavior (1 ms)
  
  ... 50+ more failing tests
```

## Edge Cases to Document in Tests

### Document These for Devon:
1. **Invalid inputs:** What should happen with bad data?
2. **Database errors:** How to handle connection failures?
3. **Concurrency:** What happens with simultaneous updates?
4. **Transaction rollback:** How to handle partial failures?
5. **Performance:** Any limits or optimizations needed?

## Test File Structure

### Complete Test File Outline:
```javascript
// backend/tools/__tests__/DatabaseTool.steps.test.js

const DatabaseTool = require('../DatabaseTool');

describe('DatabaseTool Step Methods (TDD RED PHASE)', () => {
  // Method 1: create_step
  describe('create_step method (RED PHASE)', () => {
    // 10-15 failing tests
  });

  // Method 2: update_step
  describe('update_step method (RED PHASE)', () => {
    // 10-15 failing tests
  });

  // Method 3: get_step
  describe('get_step method (RED PHASE)', () => {
    // 8-10 failing tests
  });

  // Method 4: list_steps_by_subtask
  describe('list_steps_by_subtask method (RED PHASE)', () => {
    // 8-10 failing tests
  });

  // Method 5: get_steps_by_status
  describe('get_steps_by_status method (RED PHASE)', () => {
    // 8-10 failing tests
  });

  // Integration tests
  describe('Integration (RED PHASE)', () => {
    // 5-8 failing tests
  });
});
```

## Final Check Before Handoff

Before marking RED phase complete, verify:
1. **Test count:** 50+ individual test cases
2. **Coverage:** All 5 methods have test coverage planned
3. **Clarity:** Test descriptions explain what Devon should implement
4. **Patterns:** Follows existing DatabaseTool test patterns
5. **Isolation:** Tests don't depend on each other
6. **Clean state:** Each test is independent

**RED PHASE COMPLETE WHEN:** All tests are written, all tests fail, test suite runs without errors.

