# Tara Testing Instructions: Task 2-1-2 - Create `steps` Table

## Task Overview
**Task ID:** 2-1-2  
**Title:** Create `steps` Table  
**Status:** Pending  
**Dependencies:** 2-1-1 (ENUM types) ✅ COMPLETED  
**Estimated Steps:** 1-2 (table creation, indexes)

## Acceptance Criteria
1. ✅ Table `steps` exists with correct column names, types, and constraints
2. ✅ `context_files` column accepts JSONB arrays of strings
3. ✅ Foreign keys reference correct tables (`projects`, `subtasks`)
4. ✅ Default values set for `attempt_count` (0) and timestamps

## Testing Strategy

### Phase 1: Pre-Implementation Verification
**Before Devon starts implementation, verify:**

#### 1. ENUM Types Exist (Dependency Check)
```sql
-- Verify ENUM types from 2-1-1 exist
SELECT typname FROM pg_type WHERE typcategory = 'E';
```
**Expected:** `step_type`, `status`, `assigned_to`, `work_stage`

#### 2. Existing Table Structure
```sql
-- Check existing tables that will be referenced
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('projects', 'subtasks');
```

### Phase 2: Migration Testing

#### Test 1: Migration File Creation
**Objective:** Verify migration file follows correct pattern
**Location:** `backend/migrations/0003_steps_table.sql`

**Checklist:**
- [ ] File exists in correct location
- [ ] Uses `CREATE TABLE IF NOT EXISTS` pattern
- [ ] Includes all specified columns:
  - `id` (SERIAL PRIMARY KEY)
  - `project_id` (INTEGER REFERENCES projects(id))
  - `subtask_id` (INTEGER REFERENCES subtasks(id))
  - `step_number` (INTEGER)
  - `step_type` (ENUM from 2-1-1)
  - `file_path` (TEXT)
  - `instructions` (TEXT)
  - `status` (ENUM from 2-1-1)
  - `assigned_to` (ENUM from 2-1-1)
  - `context_snapshot` (JSON)
  - `context_files` (JSONB)
  - `attempt_count` (INTEGER DEFAULT 0)
  - `last_error` (TEXT)
  - `parent_step_id` (INTEGER REFERENCES steps(id))
  - `created_at` (TIMESTAMP DEFAULT NOW())
  - `updated_at` (TIMESTAMP DEFAULT NOW())
- [ ] Includes proper indexes
- [ ] Includes foreign key constraints

#### Test 2: Migration Execution
**Objective:** Verify migration runs without errors
```bash
# Run migration test
node backend/apply_migration.js --test 0003_steps_table.sql
```

**Expected:**
- Migration executes successfully
- No syntax errors
- No constraint violations

#### Test 3: Table Structure Verification
**Objective:** Verify table structure matches specification

```sql
-- Check column definitions
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'steps'
ORDER BY ordinal_position;
```

**Verification Points:**
- All columns exist with correct data types
- `context_files` is JSONB
- `attempt_count` has DEFAULT 0
- Foreign keys defined correctly
- ENUM types used correctly

### Phase 3: CRUD Operations Testing

#### Test 4: Basic CRUD Operations
**Objective:** Test create, read, update, delete operations

```sql
-- Test 4.1: Create step with JSONB array
INSERT INTO steps (
  project_id, subtask_id, step_number, step_type, 
  file_path, instructions, status, assigned_to,
  context_files, attempt_count
) VALUES (
  1, 1, 1, 'implementation',
  'src/test.js', 'Implement test function', 'pending', 'DevonAider',
  '["tests/test.spec.js", "src/utils.js"]'::jsonb, 0
);

-- Test 4.2: Read step
SELECT * FROM steps WHERE id = 1;

-- Test 4.3: Update step (increment attempt_count)
UPDATE steps SET attempt_count = 1, status = 'in_progress' WHERE id = 1;

-- Test 4.4: Delete step
DELETE FROM steps WHERE id = 1;
```

#### Test 5: JSONB Array Operations
**Objective:** Verify JSONB array functionality

```sql
-- Test 5.1: Insert with empty array
INSERT INTO steps (context_files) VALUES ('[]'::jsonb);

-- Test 5.2: Insert with multiple files
INSERT INTO steps (context_files) VALUES ('["file1.js", "file2.js", "file3.js"]'::jsonb);

-- Test 5.3: Query using JSONB operators
SELECT * FROM steps WHERE context_files @> '["file1.js"]'::jsonb;

-- Test 5.4: Update JSONB array
UPDATE steps SET context_files = '["newfile.js"]'::jsonb WHERE id = 2;
```

#### Test 6: Foreign Key Constraints
**Objective:** Verify referential integrity

```sql
-- Test 6.1: Valid foreign key (should succeed)
INSERT INTO steps (project_id, subtask_id) VALUES (1, 1);

-- Test 6.2: Invalid foreign key (should fail)
INSERT INTO steps (project_id, subtask_id) VALUES (999, 999);
-- Expected: Foreign key violation error

-- Test 6.3: Cascade delete test (if configured)
-- (Depends on Devon's implementation)
```

#### Test 7: Default Values
**Objective:** Verify default values work correctly

```sql
-- Test 7.1: Insert without attempt_count
INSERT INTO steps (project_id, subtask_id) VALUES (1, 1);
SELECT attempt_count FROM steps WHERE id = [new_id];
-- Expected: 0

-- Test 7.2: Insert without timestamps
SELECT created_at, updated_at FROM steps WHERE id = [new_id];
-- Expected: Current timestamp for both
```

#### Test 8: Parent-Child Relationship
**Objective:** Test self-referencing foreign key

```sql
-- Test 8.1: Create parent step
INSERT INTO steps (id, project_id, subtask_id) VALUES (100, 1, 1);

-- Test 8.2: Create child step referencing parent
INSERT INTO steps (project_id, subtask_id, parent_step_id) VALUES (1, 1, 100);

-- Test 8.3: Verify relationship
SELECT * FROM steps WHERE parent_step_id = 100;
```

### Phase 4: Edge Cases & Error Handling

#### Test 9: Edge Cases
**Objective:** Test boundary conditions

```sql
-- Test 9.1: Very long file_path
INSERT INTO steps (file_path) VALUES (REPEAT('a', 1000));

-- Test 9.2: Very long instructions
INSERT INTO steps (instructions) VALUES (REPEAT('instruction ', 1000));

-- Test 9.3: Large JSONB array
INSERT INTO steps (context_files) VALUES (
  ('["' || REPEAT('file', 100) || '"]')::jsonb
);

-- Test 9.4: NULL values for optional fields
INSERT INTO steps (project_id, subtask_id, context_files, parent_step_id) 
VALUES (1, 1, NULL, NULL);
```

#### Test 10: Concurrent Operations
**Objective:** Test concurrent access (if time permits)

```sql
-- Simulate concurrent inserts/updates
-- (May require separate test script)
```

### Phase 5: Integration Testing

#### Test 11: Integration with Existing System
**Objective:** Verify table works with existing codebase

```javascript
// Test 11.1: DatabaseTool integration
// Verify existing DatabaseTool methods work with new table
const DatabaseTool = require('../tools/DatabaseTool');

// Test 11.2: Migration runner integration
// Verify migration can be rolled back and reapplied
```

#### Test 12: Performance Testing
**Objective:** Verify performance characteristics

```sql
-- Test 12.1: Index effectiveness
EXPLAIN ANALYZE SELECT * FROM steps WHERE subtask_id = 1;

-- Test 12.2: Large dataset performance
-- Insert 1000 rows and test query performance
```

## Testing Environment Setup

### Prerequisites
1. Test database with clean schema
2. Existing `projects` and `subtasks` tables with sample data
3. ENUM types from 2-1-1
4. Migration runner (`apply_migration.js`)

### Test Data
```sql
-- Setup test data
INSERT INTO projects (id, external_id, title) VALUES (1, 'P1', 'Test Project');
INSERT INTO subtasks (id, task_id, title) VALUES (1, 1, 'Test Subtask');
```

## Test Execution Order

1. **Phase 1:** Pre-implementation verification (Tests 1-2)
2. **Phase 2:** Migration testing (Tests 3-4)
3. **Phase 3:** CRUD operations testing (Tests 5-8)
4. **Phase 4:** Edge cases & error handling (Tests 9-10)
5. **Phase 5:** Integration testing (Tests 11-12)

## Test Reporting Requirements

### Pass/Fail Criteria
- **PASS:** All tests in a phase pass
- **FAIL:** Any test fails
- **BLOCKED:** Cannot proceed due to missing dependencies

### Reporting Format
For each test, report:
1. **Test ID:** e.g., "Test 4.1"
2. **Status:** PASS/FAIL/BLOCKED
3. **Evidence:** SQL output, error messages, or screenshots
4. **Notes:** Any observations or deviations from expected behavior

## Test Completion Checklist

### Phase Completion Criteria
- [ ] **Phase 1:** ENUM types exist, reference tables exist
- [ ] **Phase 2:** Migration file created and executes successfully
- [ ] **Phase 3:** All CRUD operations work correctly
- [ ] **Phase 4:** Edge cases handled appropriately
- [ ] **Phase 5:** Integration with existing system verified

### Final Verification
- [ ] All acceptance criteria met
- [ ] No regression in existing functionality
- [ ] Documentation updated if needed
- [ ] Ready for Orion review

## Next Steps After Testing

1. **If all tests PASS:** Notify Orion that subtask 2-1-2 is ready for Devon implementation
2. **If any test FAILS:** Document failure details and notify Orion for re-planning
3. **If BLOCKED:** Identify blocking issue and request clarification

## Risk Mitigation

### Known Risks
1. **ENUM dependency:** If ENUM types from 2-1-1 are missing, all tests will fail
2. **Migration conflicts:** If migration number 0003 is already used
3. **Database permissions:** Insufficient permissions for table creation

### Mitigation Strategies
1. Verify ENUM types before starting (Phase 1)
2. Check existing migration files for conflicts
3. Test with appropriate database user permissions

## Contact Points

- **Orion:** For workflow coordination and task assignment
- **Devon:** For implementation questions (after tests pass)
- **Database Admin:** For permission issues or schema conflicts

## Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-01-01 | Initial test plan | Orion |
| 1.1 | 2025-01-01 | Added test execution order and completion criteria | Orion |

---

**END OF TESTING INSTRUCTIONS**

