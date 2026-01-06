# Devon Implementation Instructions: Task 2-1-2 - Create `steps` Table

## Task Overview
**Task ID:** 2-1-2  
**Title:** Create `steps` Table  
**Status:** Ready for Implementation (Tara testing complete)  
**Dependencies:** 2-1-1 (ENUM types) ✅ COMPLETED  

## Implementation Requirements

### 1. Table Specification
Create a PostgreSQL table named `steps` with the following columns:

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing primary key |
| `project_id` | INTEGER | REFERENCES projects(id) | Foreign key to projects table |
| `subtask_id` | INTEGER | REFERENCES subtasks(id) | Foreign key to subtasks table |
| `step_number` | INTEGER | NOT NULL | Sequential step number within subtask |
| `step_type` | ENUM | NOT NULL | Type of step (from 2-1-1 ENUM) |
| `file_path` | TEXT | | Path to file being worked on |
| `instructions` | TEXT | | Step instructions/description |
| `status` | ENUM | NOT NULL | Current status (from 2-1-1 ENUM) |
| `assigned_to` | ENUM | NOT NULL | Agent assigned (from 2-1-1 ENUM) |
| `context_snapshot` | JSON | | JSON snapshot of context at step creation |
| `context_files` | JSONB | | JSONB array of file paths in context |
| `attempt_count` | INTEGER | DEFAULT 0 | Number of attempts made |
| `last_error` | TEXT | | Last error message if failed |
| `parent_step_id` | INTEGER | REFERENCES steps(id) | Self-referencing foreign key for step hierarchy |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

### 2. ENUM Types Required (from 2-1-1)
Ensure these ENUM types exist before creating table:
- `step_type`: ['implementation', 'test']
- `status`: ['pending', 'in_progress', 'completed', 'failed']
- `assigned_to`: ['TaraAider', 'DevonAider']
- `work_stage`: ['pending', 'analysis', 'unit_testing', 'unit_implementation', 'integration_testing', 'integration_implementation', 'review', 'completed']

### 3. Index Requirements
Create indexes for performance:
1. `idx_steps_subtask_id` on `subtask_id`
2. `idx_steps_project_id` on `project_id`
3. `idx_steps_status` on `status`
4. `idx_steps_parent_step_id` on `parent_step_id`
5. `idx_steps_created_at` on `created_at`

### 4. Foreign Key Constraints
- `project_id` references `projects(id)`
- `subtask_id` references `subtasks(id)`
- `parent_step_id` references `steps(id)` (self-reference)

## Implementation Steps

### Step 1: Create Migration File
**File:** `backend/migrations/0003_steps_table.sql`

**Content Requirements:**
```sql
-- Migration: 0003_steps_table.sql
-- Description: Create steps table for tracking individual workflow steps

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_steps_subtask_id ON steps(subtask_id);
CREATE INDEX IF NOT EXISTS idx_steps_project_id ON steps(project_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON steps(status);
CREATE INDEX IF NOT EXISTS idx_steps_parent_step_id ON steps(parent_step_id);
CREATE INDEX IF NOT EXISTS idx_steps_created_at ON steps(created_at);

-- Add comment
COMMENT ON TABLE steps IS 'Tracks individual workflow steps within subtasks';
```

### Step 2: Update Migration Runner
**File:** `backend/apply_migration.js`

**Check:** Ensure the migration runner can handle the new migration file. If needed, update the migration sequence.

### Step 3: Test Migration Locally
**Commands:**
```bash
# Test migration syntax
node backend/apply_migration.js --test 0003_steps_table.sql

# Apply migration
node backend/apply_migration.js 0003_steps_table.sql
```

### Step 4: Verify Table Creation
**SQL Verification:**
```sql
-- Check table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'steps';

-- Check column definitions
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'steps'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'steps';
```

### Step 5: Create Sample Data (Optional)
**For testing purposes:**
```sql
-- Insert sample step
INSERT INTO steps (
    project_id, subtask_id, step_number, step_type,
    file_path, instructions, status, assigned_to,
    context_files, attempt_count
) VALUES (
    1, 1, 1, 'implementation',
    'backend/migrations/0003_steps_table.sql',
    'Create steps table migration',
    'completed', 'DevonAider',
    '["backend/migrations/0003_steps_table.sql"]'::jsonb,
    1
);
```

## Testing Requirements (Based on Tara's Tests)

### Must Pass These Tests:
1. **Migration Execution:** Migration runs without errors
2. **Table Structure:** All columns exist with correct data types
3. **JSONB Support:** `context_files` accepts JSONB arrays
4. **Foreign Keys:** Referential integrity enforced
5. **Default Values:** `attempt_count` defaults to 0, timestamps auto-set
6. **Self-Reference:** `parent_step_id` works correctly
7. **Indexes:** All required indexes created

### Test Commands (from Tara's instructions):
```bash
# Run migration test
node backend/apply_migration.js --test 0003_steps_table.sql

# Verify with sample queries
psql -d your_database -c "SELECT * FROM steps LIMIT 1;"
```

## Error Handling

### Common Issues to Address:
1. **ENUM Dependency:** Ensure ENUM types from 2-1-1 exist before creating table
2. **Migration Number:** Check that migration 0003 is not already used
3. **Permission Issues:** Ensure database user has CREATE TABLE privileges
4. **Syntax Errors:** Validate SQL syntax before applying

### Rollback Plan:
```sql
-- If migration fails, rollback with:
DROP TABLE IF EXISTS steps CASCADE;
```

## Integration Points

### 1. DatabaseTool Integration
The `steps` table should be accessible via DatabaseTool methods. Consider:
- Adding `steps` to any table listing methods
- Ensuring foreign key relationships work in queries

### 2. Workflow Integration
This table supports:
- Step-by-step workflow tracking
- Context preservation across steps
- Error tracking and retry logic

### 3. Future Extensions
Consider:
- Adding `completed_at` timestamp for completed steps
- Adding `started_at` timestamp for in-progress tracking
- Adding `estimated_duration` for planning

## Quality Checklist

### Before Submission:
- [ ] Migration file follows naming convention (`0003_steps_table.sql`)
- [ ] All columns match specification
- [ ] Indexes created as specified
- [ ] Foreign key constraints properly defined
- [ ] Default values set correctly
- [ ] Table comment added
- [ ] Migration tested locally
- [ ] Sample data inserts work (optional)
- [ ] No syntax errors in SQL

### After Implementation:
- [ ] Notify Orion that implementation is complete
- [ ] Update subtask status to `completed`
- [ ] Ready for Tara's review/testing

## File Structure
```
backend/
├── migrations/
│   └── 0003_steps_table.sql
├── apply_migration.js
└── (existing files)
```

## Notes for Devon

1. **Priority:** This is a foundational table for workflow tracking
2. **Accuracy:** Ensure exact column names and types as specified
3. **Testing:** Tara has already prepared comprehensive tests - implementation should pass them
4. **Documentation:** Migration file should include clear comments
5. **Backward Compatibility:** Ensure no breaking changes to existing functionality

## Success Criteria
- ✅ Migration file created at `backend/migrations/0003_steps_table.sql`
- ✅ Table `steps` exists in database with all specified columns
- ✅ All indexes created
- ✅ Foreign key constraints working
- ✅ Tara's tests pass
- ✅ Ready for production use

## Next Steps After Implementation
1. Orion will update subtask status
2. Tara will perform final review/testing
3. If all tests pass, task moves to completion
4. Integration with workflow system can begin

---
**Implementation Deadline:** ASAP (blocking dependent tasks)
**Priority:** High (foundational for workflow tracking)
**Complexity:** Medium (straightforward table creation with ENUM dependencies)

