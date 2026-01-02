# Tara Test Plan: Subtask 2-1-1 — PostgreSQL ENUM Types

## Context
**Feature:** Feature 2 — Autonomous TDD Workflow with Aider Integration  
**Task:** 2-1 — Database Extensions for Step Management  
**Subtask:** 2-1-1 — Create PostgreSQL ENUM Types  
**Status:** RED Stage (Test-First Development)

## Goal
Write failing tests that verify the PostgreSQL ENUM types `step_type`, `status`, `assigned_to`, and `work_stage` are created with correct values.

## Acceptance Criteria (From Specification)
1. ENUM types exist in PostgreSQL and can be used in table definitions
2. Values match specification:
   - `step_type`: ('implementation', 'test')
   - `status`: ('pending', 'in_progress', 'completed', 'failed')
   - `assigned_to`: ('TaraAider', 'DevonAider')
   - `work_stage`: ('pending', 'analysis', 'unit_testing', 'unit_implementation', 'integration_testing', 'integration_implementation', 'review', 'completed')

## Constraint Discovery Protocol (CDP) Analysis

### A. Atomic Actions
1. **Migration Execution**: Running SQL `CREATE TYPE IF NOT EXISTS` for each ENUM
2. **Schema Verification**: Querying PostgreSQL system catalogs (`pg_type`, `pg_enum`) to verify ENUM existence and values
3. **Type Usability**: Using ENUM types in a test table definition to ensure they are usable

### B. Resources Touched
- **Database**: PostgreSQL test instance (isolated from production)
- **Migration File**: `backend/migrations/0002_step_enum_types.sql`
- **Test Database**: Clean state required for each test run

### C. System Physics
- **Race Conditions**: None (migrations are idempotent with `IF NOT EXISTS`)
- **Failure Modes**:
  - Database connection failure
  - Incorrect SQL syntax
  - Missing database permissions
  - ENUM values mismatch with specification
- **Isolation**: Tests must run in isolated test database to avoid contaminating development/production data

## Test Seam Validation
- **Migration Runner**: Must be testable without affecting production
- **Database Connection**: Must be mockable or use isolated test instance
- **Schema Queries**: Must be executable via database client (e.g., `node-postgres`)

## Test Scenarios

### Scenario 1: ENUM Type Existence
**Description:** Verify each ENUM type exists in the database after migration.

**Test Cases:**
1. Query `pg_type` for each ENUM type name
2. Assert that each type exists and is of type `enum`

**Expected Failure:** Types do not exist (migration not run).

### Scenario 2: ENUM Value Verification
**Description:** Verify each ENUM type has the correct allowed values.

**Test Cases:**
1. For each ENUM type, query `pg_enum` to get ordered list of values
2. Assert the values match the specification exactly (order matters in ENUMs)

**Expected Failure:** Values are missing, extra, or in wrong order.

### Scenario 3: ENUM Usability
**Description:** Verify ENUM types can be used in table definitions.

**Test Cases:**
1. Create a test table with columns using each ENUM type
2. Insert valid values into each column
3. Attempt to insert invalid value (should fail with constraint violation)

**Expected Failure:** Table creation fails or invalid value is accepted.

## Implementation Instructions

### Test File Location
Create test file: `backend/migrations/__tests__/0002_step_enum_types.test.js`

### Test Structure Pattern
Follow existing Jest patterns (see `backend/__tests__/health.test.js` and `backend/src/services/__tests__/ContextService.spec.js`).

### Database Setup
Use the existing database connection from `backend/src/db/connection.js` with test configuration.
Ensure tests run in a transaction and rollback after each test.

### Migration Execution
The test should run the migration file before the tests. Use a helper to execute SQL from the migration file.

### Example Test Outline
```javascript
/**
 * Migration: 0002_step_enum_types.sql
 *
 * Goal: Verify PostgreSQL ENUM types for step management are created with correct values
 *
 * Requirements:
 * - ENUM types step_type, status, assigned_to, work_stage exist
 * - Each ENUM has exactly the specified values in correct order
 * - ENUMs can be used in table definitions and enforce value constraints
 *
 * Non-goals:
 * - Testing table relationships or foreign keys
 * - Testing application logic using these ENUMs
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

describe('Migration 0002: Step ENUM Types', () => {
  let client;
  const migrationPath = path.join(__dirname, '../../0002_step_enum_types.sql');

  beforeAll(async () => {
    // Setup test database connection
    client = new Client({
      // test database config
    });
    await client.connect();
    
    // Run migration
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
  });

  afterAll(async () => {
    await client.end();
  });

  describe('ENUM type existence', () => {
    it('should create step_type enum', async () => {
      const res = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'step_type'
        );
      `);
      expect(res.rows[0].exists).toBe(true);
    });

    // ... similar tests for other ENUMs
  });

  describe('ENUM value verification', () => {
    it('should have correct values for step_type', async () => {
      const res = await client.query(`
        SELECT enumlabel 
        FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'step_type'
        ORDER BY enumsortorder;
      `);
      const values = res.rows.map(row => row.enumlabel);
      expect(values).toEqual(['implementation', 'test']);
    });

    // ... similar tests for other ENUMs
  });

  describe('ENUM usability', () => {
    it('should allow creating table with step_type column', async () => {
      await expect(
        client.query(`
          CREATE TABLE test_table (
            id SERIAL PRIMARY KEY,
            step step_type NOT NULL
          );
        `)
      ).resolves.not.toThrow();
      
      // Cleanup
      await client.query('DROP TABLE test_table');
    });

    it('should reject invalid step_type value', async () => {
      await client.query(`
        CREATE TABLE test_table (
          id SERIAL PRIMARY KEY,
          step step_type NOT NULL
        );
      `);

      await expect(
        client.query("INSERT INTO test_table (step) VALUES ('invalid_value');")
      ).rejects.toThrow(); // Should throw constraint violation

      await client.query('DROP TABLE test_table');
    });
  });
});
```

## CDP Findings Log
Create YAML file: `.Docs/Roadmap/TaraTests/2-1-1_CDP.yaml`

```yaml
subtask: 2-1-1
cdp_analysis:
  atomic_actions:
    - migration_execution
    - schema_verification
    - enum_usability
  resources_touched:
    - postgresql_test_instance
    - migration_file
  system_physics:
    - idempotent_migration
    - database_isolation_required
test_scenarios:
  - enum_existence
  - value_verification
  - usability
assumptions:
  - test_database_is_isolated
  - migration_sql_is_correct
  - postgresql_version_supports_if_not_exists
risks:
  - database_connection_failure: medium
  - value_order_mismatch: low
  - migration_idempotency: low
questions: []
blockers: none
```

## Success Criteria (Tara Phase)
- [ ] Test file created with proper goal header
- [ ] Tests fail when migration is not run (RED stage)
- [ ] Tests pass after Devon implements migration (GREEN stage)
- [ ] CDP findings logged in YAML file
- [ ] No placeholders or hardcoded values in tests

## Next Steps for Tara
1. Create test file structure
2. Write failing tests for each scenario
3. Log CDP analysis
4. Run tests to confirm they fail (RED)
5. Hand off to Devon for migration implementation

## Dependencies
- Feature 1 (DatabaseTool integration) must be stable
- Test database configuration must be available
- Jest and PostgreSQL client must be configured

---

*Test Plan Prepared by Adam (Architect) for Tara (Tester)*  
*Date: 2026-01-01*  
*Status: Ready for RED stage test implementation*
