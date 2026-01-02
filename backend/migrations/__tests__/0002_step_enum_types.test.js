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

const { getPool, closePool } = require('../../src/db/connection');
const fs = require('fs');
const path = require('path');

describe('Migration 0002: Step ENUM Types', () => {
  let pool;
  const migrationPath = path.join(__dirname, '../0002_step_enum_types.sql');

  beforeAll(async () => {
    // Setup test database connection
    process.env.NODE_ENV = 'test';
    pool = getPool();

    // Run migration (which is currently empty - RED stage)
    const sql = fs.readFileSync(migrationPath, 'utf8');
    if (sql.trim()) {
      await pool.query(sql);
    }
  });

  afterAll(async () => {
    await closePool();
  });

  describe('ENUM type existence', () => {
    it('should create step_type enum', async () => {
      const res = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'step_type'
        );
      `);
      expect(res.rows[0].exists).toBe(true);
    });

    it('should create status enum', async () => {
      const res = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'status'
        );
      `);
      expect(res.rows[0].exists).toBe(true);
    });

    it('should create assigned_to enum', async () => {
      const res = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'assigned_to'
        );
      `);
      expect(res.rows[0].exists).toBe(true);
    });

    it('should create work_stage enum', async () => {
      const res = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'work_stage'
        );
      `);
      expect(res.rows[0].exists).toBe(true);
    });
  });

  describe('ENUM value verification', () => {
    it('should have correct values for step_type', async () => {
      const res = await pool.query(`
        SELECT enumlabel 
        FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'step_type'
        ORDER BY enumsortorder;
      `);
      const values = res.rows.map(row => row.enumlabel);
      expect(values).toEqual(['implementation', 'test']);
    });

    it('should have correct values for status', async () => {
      const res = await pool.query(`
        SELECT enumlabel 
        FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'status'
        ORDER BY enumsortorder;
      `);
      const values = res.rows.map(row => row.enumlabel);
      expect(values).toEqual(['pending', 'in_progress', 'completed', 'failed']);
    });

    it('should have correct values for assigned_to', async () => {
      const res = await pool.query(`
        SELECT enumlabel 
        FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'assigned_to'
        ORDER BY enumsortorder;
      `);
      const values = res.rows.map(row => row.enumlabel);
      expect(values).toEqual(['TaraAider', 'DevonAider']);
    });

    it('should have correct values for work_stage', async () => {
      const res = await pool.query(`
        SELECT enumlabel 
        FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'work_stage'
        ORDER BY enumsortorder;
      `);
      const values = res.rows.map(row => row.enumlabel);
      expect(values).toEqual([
        'pending',
        'analysis',
        'unit_testing',
        'unit_implementation',
        'integration_testing',
        'integration_implementation',
        'review',
        'completed'
      ]);
    });
  });

  describe('ENUM usability', () => {
    it('should allow creating table with ENUM columns', async () => {
      // Create a test table using the ENUM types
      await pool.query(`
        CREATE TABLE IF NOT EXISTS __test_enum_table (
          id SERIAL PRIMARY KEY,
          step step_type NOT NULL,
          status status NOT NULL,
          assigned_to assigned_to NOT NULL,
          work_stage work_stage NOT NULL
        );
      `);

      // Insert a valid row
      await pool.query(`
        INSERT INTO __test_enum_table (step, status, assigned_to, work_stage)
        VALUES ('implementation', 'pending', 'TaraAider', 'analysis');
      `);

      // Verify insertion
      const res = await pool.query('SELECT * FROM __test_enum_table');
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].step).toBe('implementation');
      expect(res.rows[0].status).toBe('pending');
      expect(res.rows[0].assigned_to).toBe('TaraAider');
      expect(res.rows[0].work_stage).toBe('analysis');

      // Cleanup
      await pool.query('DROP TABLE __test_enum_table');
    });

    it('should reject invalid step_type value', async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS __test_enum_table2 (
          id SERIAL PRIMARY KEY,
          step step_type NOT NULL
        );
      `);

      // Attempt to insert an invalid value - should throw an error
      await expect(
        pool.query("INSERT INTO __test_enum_table2 (step) VALUES ('invalid_value');")
      ).rejects.toThrow();

      await pool.query('DROP TABLE __test_enum_table2');
    });
  });
});
