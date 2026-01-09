# Devon Implementation Prompt: Subtask 2-1-1 — PostgreSQL ENUM Types

## Context
**Feature:** Feature 2 — Autonomous TDD Workflow with Aider Integration  
**Task:** 2-1 — Database Extensions for Step Management  
**Subtask:** 2-1-1 — Create PostgreSQL ENUM Types  
**TDD Stage:** RED → GREEN (Tests exist and are failing)

## Test Status
- **Test File:** `backend/migrations/__tests__/0002_step_enum_types.test.js`
- **Current Status:** RED (All tests fail - ENUM types do not exist)
- **Tests Written By:** Tara (following CDP protocol)
- **Test Coverage:** 10 tests covering ENUM existence, value verification, and usability

## Acceptance Criteria (From Feature 2 v5 Specification)
1. ENUM types exist in PostgreSQL and can be used in table definitions
2. Values match specification:
   - `step_type`: ('implementation', 'test')
   - `status`: ('pending', 'in_progress', 'completed', 'failed')
   - `assigned_to`: ('TaraAider', 'DevonAider')
   - `work_stage`: ('pending', 'analysis', 'unit_testing', 'unit_implementation', 'integration_testing', 'integration_implementation', 'review', 'completed')

## Implementation Requirements

### 1. Migration File
**Location:** `backend/migrations/0002_step_enum_types.sql`  
**Current State:** Empty placeholder (RED stage)  
**Required State:** Complete SQL migration with ENUM definitions

### 2. SQL Requirements
- Use `CREATE TYPE IF NOT EXISTS` for idempotency
- Define ENUMs in correct order (as specified above)
- Include comments for documentation
- Ensure proper PostgreSQL syntax

### 3. Integration Constraints
- **No placeholders**: Migration must create real ENUM types
- **Idempotent**: Migration should be safe to run multiple times
- **Backward compatible**: Should not break existing schema
- **Testable**: Must pass all 10 existing tests

## SQL Template

```sql
-- Migration 0002: Create PostgreSQL ENUM types for step management
-- For Feature 2: Autonomous TDD Workflow with Aider Integration
-- Subtask: 2-1-1 Create PostgreSQL ENUM Types

-- ENUM: step_type - Type of work step (implementation vs test)
CREATE TYPE IF NOT EXISTS step_type AS ENUM (
    'implementation',  -- Code implementation step
    'test'            -- Test creation/execution step
);

-- ENUM: status - Current status of a step
CREATE TYPE IF NOT EXISTS status AS ENUM (
    'pending',      -- Not yet started
    'in_progress',  -- Currently being worked on
    'completed',    -- Successfully finished
    'failed'        -- Failed during execution
);

-- ENUM: assigned_to - Which Aider agent is responsible
CREATE TYPE IF NOT EXISTS assigned_to AS ENUM (
    'TaraAider',   -- Responsible for test creation/execution
    'DevonAider'   -- Responsible for implementation
);

-- ENUM: work_stage - Overall progression stage for feature/task
CREATE TYPE IF NOT EXISTS work_stage AS ENUM (
    'pending',                    -- Initial state
    'analysis',                   -- Requirements analysis
    'unit_testing',               -- Unit test creation (Tara)
    'unit_implementation',        -- Unit code implementation (Devon)
    'integration_testing',        -- Integration test creation (Tara)
    'integration_implementation', -- Integration code implementation (Devon)
    'review',                     -- Code review and validation
    'completed'                   -- Feature/task complete
);

-- Optional: Add comments to system catalog
COMMENT ON TYPE step_type IS 'Type of work step: implementation or test creation';
COMMENT ON TYPE status IS 'Current status of a step: pending, in_progress, completed, failed';
COMMENT ON TYPE assigned_to IS 'Aider agent responsible: TaraAider (tests) or DevonAider (implementation)';
COMMENT ON TYPE work_stage IS 'Overall work stage for feature/task progression';
```

## Verification Steps

### Before Implementation:
1. Review existing test file to understand expected behavior
2. Confirm database connection works for test environment
3. Backup current migration file (empty placeholder)

### During Implementation:
1. Replace empty migration file with complete SQL
2. Use "Plan-in-Code" protocol: Add step-by-step comments if complex
3. Ensure no syntax errors

### After Implementation:
1. Run tests: `cd backend && npm test -- migrations/__tests__/0002_step_enum_types.test.js`
2. Verify all 10 tests pass (GREEN stage)
3. Test migration idempotency: Run migration twice, ensure no errors
4. Verify ENUM usability: Create a test table with all ENUM columns

## Error Handling

### Expected Errors (Should Not Occur):
- SQL syntax errors
- Duplicate type creation (prevented by `IF NOT EXISTS`)
- Permission issues (ensure test DB user has CREATE TYPE privilege)

### If Tests Still Fail:
1. Check ENUM values order matches specification exactly
2. Verify ENUM names are lowercase as per PostgreSQL convention
3. Confirm migration actually ran (check `pg_type` system table)
4. Ensure test database is properly isolated and migrated

## Design Considerations

### 1. Naming Consistency
- Use snake_case for ENUM type names
- Use lowercase for ENUM values (except `TaraAider`/`DevonAider` which are proper nouns)
- Match naming exactly to test expectations

### 2. Future Extensibility
- ENUM values can be added later with `ALTER TYPE ADD VALUE`
- Consider if any values might need to be renamed (unlikely at this stage)

### 3. Integration with Feature 2
These ENUMs will be used in:
- `steps` table (Task 2-1-2)
- `work_stages` table (optional, Task 2-1-3)
- DatabaseTool methods (Task 2-1-5)

## Self-Review Checklist (Devon Protocol)

Before completion, verify:
- [ ] Migration file contains complete, valid SQL
- [ ] No placeholders or stub values
- [ ] ENUM values match specification exactly (order matters)
- [ ] `IF NOT EXISTS` used for idempotency
- [ ] Comments added for documentation
- [ ] Tests pass (10/10)
- [ ] Migration can be run multiple times without error
- [ ] ENUMs can be used in table definitions (tested)
- [ ] Invalid values are rejected (tested)

## Success Criteria

- [ ] All 10 tests pass (GREEN stage)
- [ ] Migration file is complete and production-ready
- [ ] No architectural violations (layered architecture not applicable for migrations)
- [ ] Integration traceability: ENUMs exist and are usable
- [ ] Code survives senior-level review

---

*Prompt Prepared by Adam (Architect) for Devon (Implementation Agent)*  
*Date: 2026-01-01*  
*Status: Ready for GREEN stage implementation*
