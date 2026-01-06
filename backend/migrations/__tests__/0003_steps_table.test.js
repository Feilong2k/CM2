/**
 * Migration: 0003_steps_table.sql (Task 2-1-2)
 *
 * Goal: Verify PostgreSQL `steps` table is created with correct columns,
 *       types, defaults, and foreign key relationships to `projects` and `subtasks`.
 *
 * Requirements (from tara_instructions_2-1-2.md):
 * - Table `steps` exists with correct column names, types, and constraints
 * - `context_files` column accepts JSONB arrays of strings
 * - Foreign keys reference correct tables (`projects`, `subtasks`, self FK on parent_step_id)
 * - Default values set for `attempt_count` (0) and timestamps
 *
 * Non-goals:
 * - Testing higher-level application logic using `steps`
 */

const { getPool, closePool } = require('../../src/db/connection');
const fs = require('fs');
const path = require('path');

describe('Migration 0003: steps table', () => {
  let pool;
  const migrationPath = path.join(__dirname, '../0003_steps_table.sql');

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    pool = getPool();

    // Ensure ENUM types and referenced tables exist (dependency on 0002 + base schema)
    // For RED stage we assume migrations 0001 and 0002 have already been applied
    
    // Drop and recreate test tables to ensure clean state
    await pool.query(`DROP TABLE IF EXISTS steps CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS subtasks CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS projects CASCADE;`);
    
    // Create mock projects table for testing
    await pool.query(`
      CREATE TABLE projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create mock subtasks table for testing
    await pool.query(`
      CREATE TABLE subtasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Insert test data
    await pool.query(`INSERT INTO projects (id, name) VALUES (1, 'Test Project');`);
    await pool.query(`INSERT INTO subtasks (id, title) VALUES (1, 'Test Subtask');`);

    // Run migration 0003 if file exists (should be empty / missing in RED)
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      if (sql.trim()) {
        await pool.query(sql);
      }
    }
  });

  afterAll(async () => {
    await closePool();
  });

  describe('Table existence', () => {
    it('should create steps table', async () => {
      const res = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'steps'
        );
      `);
      // RED stage expectation: this will be false until migration exists
      expect(res.rows[0].exists).toBe(true);
    });
  });

  describe('Column definitions', () => {
    it('should have all required columns with correct types and defaults', async () => {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'steps'
        ORDER BY ordinal_position;
      `);
      const cols = Object.fromEntries(res.rows.map(r => [r.column_name, r]));

      // id SERIAL PRIMARY KEY
      expect(cols.id).toBeDefined();
      expect(cols.id.data_type).toBe('integer');
      expect(cols.id.column_default).toMatch(/nextval/);

      // project_id, subtask_id
      expect(cols.project_id).toBeDefined();
      expect(cols.project_id.data_type).toBe('integer');
      expect(cols.subtask_id).toBeDefined();
      expect(cols.subtask_id.data_type).toBe('integer');

      // step_number
      expect(cols.step_number).toBeDefined();
      expect(cols.step_number.data_type).toBe('integer');

      // step_type, status, assigned_to - should be enums
      expect(cols.step_type).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.assigned_to).toBeDefined();

      // file_path, instructions
      expect(cols.file_path).toBeDefined();
      expect(cols.file_path.data_type).toBe('text');
      expect(cols.instructions).toBeDefined();
      expect(cols.instructions.data_type).toBe('text');

      // context_snapshot JSON, context_files JSONB
      expect(cols.context_snapshot).toBeDefined();
      expect(cols.context_snapshot.data_type).toBe('json');
      expect(cols.context_files).toBeDefined();
      expect(cols.context_files.data_type).toBe('jsonb');

      // attempt_count INTEGER DEFAULT 0
      expect(cols.attempt_count).toBeDefined();
      expect(cols.attempt_count.data_type).toBe('integer');
      expect(cols.attempt_count.column_default).toMatch(/0/);

      // last_error TEXT
      expect(cols.last_error).toBeDefined();
      expect(cols.last_error.data_type).toBe('text');

      // parent_step_id INTEGER
      expect(cols.parent_step_id).toBeDefined();
      expect(cols.parent_step_id.data_type).toBe('integer');

      // created_at, updated_at TIMESTAMP DEFAULT NOW()
      expect(cols.created_at).toBeDefined();
      expect(cols.created_at.data_type).toMatch(/timestamp/);
      expect(String(cols.created_at.column_default || '')).toMatch(/now\(/i);

      expect(cols.updated_at).toBeDefined();
      expect(cols.updated_at.data_type).toMatch(/timestamp/);
      expect(String(cols.updated_at.column_default || '')).toMatch(/now\(/i);
    });
  });

  describe('Basic CRUD and JSONB behavior', () => {
    it('should allow inserting a row with JSONB context_files array', async () => {
      // Insert a minimal project/subtask to satisfy FKs (assumes 1,1 exist in test DB)
      const insertRes = await pool.query(`
        INSERT INTO steps (
          project_id, subtask_id, step_number, step_type,
          file_path, instructions, status, assigned_to,
          context_files, attempt_count
        ) VALUES (
          1, 1, 1, 'implementation',
          'src/test.js', 'Implement test function', 'pending', 'DevonAider',
          '["tests/test.spec.js", "src/utils.js"]'::jsonb, 0
        ) RETURNING id, context_files;
      `);

      expect(insertRes.rows.length).toBe(1);
      const row = insertRes.rows[0];
      expect(row.context_files).toEqual(['tests/test.spec.js', 'src/utils.js']);
    });
  });

  describe('Foreign key constraints', () => {
    it('should reject rows with invalid project_id / subtask_id', async () => {
      // Expect FK violation when referencing non-existent project/subtask
      await expect(
        pool.query(`
          INSERT INTO steps (
            project_id, subtask_id, step_number, step_type,
            file_path, instructions, status, assigned_to,
            attempt_count
          ) VALUES (
            9999, 9999, 1, 'implementation',
            'src/invalid.js', 'Should fail', 'pending', 'DevonAider',
            0
          );
        `)
      ).rejects.toThrow();
    });
  });

  describe('Parent-child self-reference', () => {
    it('should allow referencing parent_step_id within steps table', async () => {
      // Create a parent step (assumes valid project_id/subtask_id exist: 1,1)
      const parentRes = await pool.query(`
        INSERT INTO steps (project_id, subtask_id, step_number, step_type, status, assigned_to)
        VALUES (1, 1, 1, 'implementation', 'pending', 'TaraAider')
        RETURNING id;
      `);
      const parentId = parentRes.rows[0].id;

      // Create a child that references the parent
      const childRes = await pool.query(`
        INSERT INTO steps (project_id, subtask_id, step_number, step_type, status, assigned_to, parent_step_id)
        VALUES (1, 1, 2, 'implementation', 'pending', 'DevonAider', $1)
        RETURNING parent_step_id;
      `, [parentId]);

      expect(childRes.rows[0].parent_step_id).toBe(parentId);
    });
  });
});
