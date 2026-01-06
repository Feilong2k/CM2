/**
 * Migration: 0004_work_stages_table.sql (Task 2-1-3)
 *
 * Goal: Verify PostgreSQL `work_stages` table is created with correct columns,
 *       types, defaults, and optional foreign key relationships.
 *
 * Requirements (from 2-1-3_work_stages_table.md):
 * - Table `work_stages` exists with correct schema
 * - `stage` column uses `work_stage` ENUM type
 * - `feature_id` and `task_id` are optional (nullable) foreign keys
 * - Default timestamps set correctly
 *
 * Non-goals:
 * - Testing higher-level application logic using `work_stages`
 */

const { getPool, closePool } = require('../../src/db/connection');
const fs = require('fs');
const path = require('path');

describe('Migration 0004: work_stages table', () => {
  let pool;
  const migrationPath = path.join(__dirname, '../0004_work_stages_table.sql');

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    pool = getPool();

    // Ensure ENUM type exists (dependency on 0002)
    // For RED stage we assume migration 0002 has already been applied
    
    // Drop and recreate test tables to ensure clean state
    await pool.query(`DROP TABLE IF EXISTS work_stages CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS features CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS tasks CASCADE;`);
    
    // Create mock features table for testing
    await pool.query(`
      CREATE TABLE features (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create mock tasks table for testing
    await pool.query(`
      CREATE TABLE tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Insert test data
    await pool.query(`INSERT INTO features (id, title) VALUES (1, 'Test Feature');`);
    await pool.query(`INSERT INTO tasks (id, title) VALUES (1, 'Test Task');`);

    // Run migration 0004 if file exists
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
    it('should create work_stages table', async () => {
      const res = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'work_stages'
        );
      `);
      expect(res.rows[0].exists).toBe(true);
    });
  });

  describe('Column definitions', () => {
    it('should have all required columns with correct types and defaults', async () => {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'work_stages'
        ORDER BY ordinal_position;
      `);
      const cols = Object.fromEntries(res.rows.map(r => [r.column_name, r]));

      // id SERIAL PRIMARY KEY
      expect(cols.id).toBeDefined();
      expect(cols.id.data_type).toBe('integer');
      expect(cols.id.column_default).toMatch(/nextval/);

      // stage work_stage NOT NULL
      expect(cols.stage).toBeDefined();
      // ENUM type checking - data_type may show as USER-DEFINED or specific type
      expect(cols.stage.is_nullable).toBe('NO');

      // feature_id INTEGER REFERENCES features(id) ON DELETE SET NULL
      expect(cols.feature_id).toBeDefined();
      expect(cols.feature_id.data_type).toBe('integer');
      expect(cols.feature_id.is_nullable).toBe('YES'); // nullable

      // task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL
      expect(cols.task_id).toBeDefined();
      expect(cols.task_id.data_type).toBe('integer');
      expect(cols.task_id.is_nullable).toBe('YES'); // nullable

      // notes TEXT
      expect(cols.notes).toBeDefined();
      expect(cols.notes.data_type).toBe('text');
      expect(cols.notes.is_nullable).toBe('YES'); // nullable

      // created_at, updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      expect(cols.created_at).toBeDefined();
      expect(cols.created_at.data_type).toMatch(/timestamp/);
      expect(String(cols.created_at.column_default || '')).toMatch(/now\(/i);

      expect(cols.updated_at).toBeDefined();
      expect(cols.updated_at.data_type).toMatch(/timestamp/);
      expect(String(cols.updated_at.column_default || '')).toMatch(/now\(/i);
    });
  });

  describe('ENUM usage', () => {
    it('should accept valid work_stage ENUM values', async () => {
      // Test all ENUM values from 0002 migration
      const validStages = [
        'pending',
        'analysis', 
        'unit_testing',
        'unit_implementation',
        'integration_testing',
        'integration_implementation',
        'review',
        'completed'
      ];

      for (const stage of validStages) {
        const insertRes = await pool.query(`
          INSERT INTO work_stages (stage, feature_id, task_id, notes)
          VALUES ($1, 1, 1, 'Test notes for ${stage}')
          RETURNING stage;
        `, [stage]);
        
        expect(insertRes.rows[0].stage).toBe(stage);
      }
    });

    it('should reject invalid ENUM values', async () => {
      await expect(
        pool.query(`INSERT INTO work_stages (stage) VALUES ('invalid_stage');`)
      ).rejects.toThrow();
    });
  });

  describe('Foreign key behavior (optional)', () => {
    it('should allow feature_id and task_id to be null', async () => {
      const insertRes = await pool.query(`
        INSERT INTO work_stages (stage, feature_id, task_id, notes)
        VALUES ('pending', NULL, NULL, 'No foreign keys')
        RETURNING id, feature_id, task_id;
      `);
      
      const row = insertRes.rows[0];
      expect(row.feature_id).toBeNull();
      expect(row.task_id).toBeNull();
    });

    it('should accept valid foreign key references', async () => {
      const insertRes = await pool.query(`
        INSERT INTO work_stages (stage, feature_id, task_id, notes)
        VALUES ('analysis', 1, 1, 'With valid foreign keys')
        RETURNING feature_id, task_id;
      `);
      
      const row = insertRes.rows[0];
      expect(row.feature_id).toBe(1);
      expect(row.task_id).toBe(1);
    });

    it('should reject invalid foreign key references', async () => {
      await expect(
        pool.query(`INSERT INTO work_stages (stage, feature_id) VALUES ('pending', 9999);`)
      ).rejects.toThrow();
      
      await expect(
        pool.query(`INSERT INTO work_stages (stage, task_id) VALUES ('pending', 9999);`)
      ).rejects.toThrow();
    });
  });

  describe('CRUD operations', () => {
    it('should support create, read, update, delete operations', async () => {
      // Create
      const insertRes = await pool.query(`
        INSERT INTO work_stages (stage, notes)
        VALUES ('unit_testing', 'Test CRUD operations')
        RETURNING id;
      `);
      const id = insertRes.rows[0].id;
      
      // Read
      const readRes = await pool.query(`SELECT * FROM work_stages WHERE id = $1`, [id]);
      expect(readRes.rows.length).toBe(1);
      expect(readRes.rows[0].notes).toBe('Test CRUD operations');
      
      // Update
      await pool.query(`UPDATE work_stages SET notes = 'Updated notes' WHERE id = $1`, [id]);
      const updateRes = await pool.query(`SELECT notes FROM work_stages WHERE id = $1`, [id]);
      expect(updateRes.rows[0].notes).toBe('Updated notes');
      
      // Delete
      await pool.query(`DELETE FROM work_stages WHERE id = $1`, [id]);
      const deleteRes = await pool.query(`SELECT * FROM work_stages WHERE id = $1`, [id]);
      expect(deleteRes.rows.length).toBe(0);
    });
  });
});
