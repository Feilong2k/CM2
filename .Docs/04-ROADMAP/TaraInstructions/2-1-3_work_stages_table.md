# Tara Instructions: Subtask 2-1-3 - Create `work_stages` Table

## Task Overview
Create PostgreSQL table `work_stages` for tracking feature/task progression with optional foreign keys.

## Dependencies Verification
**BLOCKING CONDITION:** Verify these dependencies are met before proceeding:

1. ✅ **2-1-1 Completed:** ENUM type `work_stage` must exist in database
   ```sql
   -- Check if ENUM exists
   SELECT typname FROM pg_type WHERE typname = 'work_stage';
   -- Expected: Should return 'work_stage'
   ```

2. ✅ **Database Access:** Confirm you can connect to PostgreSQL database
3. ✅ **Migration Directory:** `backend/migrations/` directory exists

## Test Requirements

### 1. Table Structure Tests
- Verify `work_stages` table exists with correct schema
- Confirm all columns have correct data types
- Test nullable foreign key constraints

### 2. CRUD Operation Tests
- **Create:** Insert new work_stage records
- **Read:** Query work_stage records with various filters
- **Update:** Modify existing work_stage records
- **Delete:** Remove work_stage records

### 3. Foreign Key Behavior Tests
- Test that `feature_id` can be NULL (optional relationship)
- Test that `task_id` can be NULL (optional relationship)
- Test valid foreign key references when provided
- Test cascade behavior (if implemented)

### 4. ENUM Usage Tests
- Verify `stage` column uses `work_stage` ENUM type
- Test all valid ENUM values can be inserted
- Test invalid ENUM values are rejected

## Test Implementation Steps

### Step 1: Setup Test Environment
```javascript
// Create test database connection
// Load migration file: backend/migrations/0004_work_stages_table.sql
// Verify table creation
```

### Step 2: Write Table Structure Tests
```javascript
describe('work_stages table structure', () => {
  test('table exists', () => { /* ... */ });
  test('has correct columns', () => { /* ... */ });
  test('stage column uses work_stage ENUM', () => { /* ... */ });
});
```

### Step 3: Write CRUD Tests
```javascript
describe('work_stages CRUD operations', () => {
  test('create work_stage', () => { /* ... */ });
  test('read work_stage', () => { /* ... */ });
  test('update work_stage', () => { /* ... */ });
  test('delete work_stage', () => { /* ... */ });
});
```

### Step 4: Write Foreign Key Tests
```javascript
describe('work_stages foreign key behavior', () => {
  test('feature_id can be null', () => { /* ... */ });
  test('task_id can be null', () => { /* ... */ });
  test('valid foreign key references', () => { /* ... */ });
});
```

## Expected Schema
```sql
CREATE TABLE work_stages (
  id SERIAL PRIMARY KEY,
  stage work_stage NOT NULL,
  feature_id INTEGER REFERENCES features(id) ON DELETE SET NULL,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Success Criteria
1. ✅ All tests pass (100% coverage for work_stages table)
2. ✅ Table structure matches specification
3. ✅ ENUM type `work_stage` is correctly used
4. ✅ Optional foreign keys work as expected (nullable)
5. ✅ CRUD operations function correctly

## Failure Conditions
- ❌ ENUM type `work_stage` doesn't exist (blocking)
- ❌ Table creation fails
- ❌ Foreign key constraints violated
- ❌ Any test fails

## Notes
- This is an optional table for tracking progression
- Foreign keys to `features` and `tasks` are optional (nullable)
- Focus on testing the optional nature of relationships
- Ensure proper cleanup between tests

