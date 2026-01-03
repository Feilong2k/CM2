const { runThreePhaseCapProbe } = require('../three_phase_cap_probe');
const { query, closePool, getPool } = require('../../../../src/db/connection');
const { setupFeature2TestData } = require('../setup_feature2_test_data');

describe('Three-Phase CAP Probe Integration', () => {
  let pool;
  const subtaskIds = [
    '2-1-1', '2-1-2', '2-1-3', '2-1-4', '2-1-5', '2-1-6',
    '2-2-1', '2-2-2', '2-2-3', '2-2-4', '2-2-5', '2-2-6',
  ];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    pool = getPool();
    // Ensure test data exists
    await setupFeature2TestData();
    
    // Ensure the skill_test_responses table exists (same as probe's ensureSkillTestTables)
    try {
      await query(`
        SELECT 1 FROM skill_test_responses LIMIT 1
      `);
      console.log('skill_test_responses table exists, skipping creation.');
    } catch (error) {
      if (error.message.includes('relation "skill_test_responses" does not exist')) {
        console.log('Creating skill_test_responses table...');
        await query(`
          CREATE TABLE skill_test_responses (
            id SERIAL PRIMARY KEY,
            test_phase TEXT CHECK (test_phase IN ('baseline', 'discovery', 'compliance')),
            subtask_id TEXT NOT NULL,
            user_prompt TEXT NOT NULL,
            orion_response TEXT NOT NULL,
            response_metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT NOW()
          );
          
          CREATE INDEX idx_skill_test_responses_phase_subtask ON skill_test_responses (test_phase, subtask_id);
          CREATE INDEX idx_skill_test_responses_created_at ON skill_test_responses (created_at);
        `);
        console.log('skill_test_responses table created successfully.');
      } else {
        throw error;
      }
    }
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean out existing probe rows for these subtasks to ensure fresh run
    try {
      await query(
        `DELETE FROM skill_test_responses WHERE subtask_id = ANY($1::text[])`,
        [subtaskIds]
      );
    } catch (error) {
      // If the table doesn't exist, that's okay because the test will create it.
      if (!error.message.includes('relation "skill_test_responses" does not exist')) {
        throw error;
      }
    }
  });

  describe('Test 1 – Probe writes 36 responses', () => {
    it('runs baseline, discovery, compliance for 12 subtasks and stores 36 responses', async () => {
      // Act
      await runThreePhaseCapProbe();

      // Assert
      const res = await query(
        `SELECT test_phase, subtask_id
         FROM skill_test_responses
         WHERE subtask_id = ANY($1::text[])
         ORDER BY subtask_id, test_phase`,
        [subtaskIds]
      );

      // Should have 36 rows (12 subtasks * 3 phases)
      expect(res.rows.length).toBe(36);

      // Check each subtask has all 3 phases
      const phases = ['baseline', 'discovery', 'compliance'];
      for (const id of subtaskIds) {
        const rowsForSubtask = res.rows.filter(r => r.subtask_id === id);
        expect(rowsForSubtask).toHaveLength(3);
        phases.forEach(phase => {
          expect(rowsForSubtask.some(r => r.test_phase === phase)).toBe(true);
        });
      }
    });
  });

  describe('Test 2 – Correct skill_included flags', () => {
    it('sets skill_included=true only for discovery and compliance', async () => {
      await runThreePhaseCapProbe();

      const res = await query(
        `SELECT test_phase, response_metadata
         FROM skill_test_responses
         WHERE subtask_id = ANY($1::text[])`,
        [subtaskIds]
      );

      expect(res.rows.length).toBeGreaterThan(0);

      for (const row of res.rows) {
        const meta = row.response_metadata || {};
        if (row.test_phase === 'baseline') {
          expect(meta.skill_included).toBe(false);
        } else {
          // discovery or compliance
          expect(meta.skill_included).toBe(true);
        }
      }
    });
  });

  describe('Test 3 – Clarification logging', () => {
    it('logs all responses and sets has_clarification flag when Orion asks questions', async () => {
      await runThreePhaseCapProbe();

      const res = await query(
        `SELECT orion_response, response_metadata
         FROM skill_test_responses
         WHERE subtask_id = ANY($1::text[])`,
        [subtaskIds]
      );

      expect(res.rows.length).toBeGreaterThan(0);

      for (const row of res.rows) {
        const { orion_response, response_metadata } = row;
        expect(orion_response).toBeDefined();
        expect(typeof orion_response).toBe('string');
        
        const meta = response_metadata || {};
        expect(typeof meta.has_clarification).toBe('boolean');

        const lower = orion_response.toLowerCase();
        const looksLikeQuestion = lower.includes('clarification') || lower.includes('?');
        if (looksLikeQuestion) {
          expect(meta.has_clarification).toBe(true);
        }
      }
    });
  });

  describe('Test 4 – Prompts differ correctly by phase', () => {
    it('uses natural prompts for baseline/discovery and CAP prompts for compliance', async () => {
      await runThreePhaseCapProbe();

      const res = await query(
        `SELECT test_phase, subtask_id, user_prompt
         FROM skill_test_responses
         WHERE subtask_id = ANY($1::text[])`,
        [subtaskIds]
      );

      expect(res.rows.length).toBeGreaterThan(0);

      // Check specific subtasks as representative samples
      const sampleIds = ['2-1-2', '2-2-3'];
      for (const id of sampleIds) {
        const rows = res.rows.filter(r => r.subtask_id === id);
        // Expect at least some rows if the probe ran for all
        if (rows.length === 0) continue; 

        for (const row of rows) {
          if (row.test_phase === 'baseline' || row.test_phase === 'discovery') {
            expect(row.user_prompt).toMatch(/Review subtask/i);
            expect(row.user_prompt).not.toMatch(/Using the CAP/i);
          } else if (row.test_phase === 'compliance') {
            expect(row.user_prompt).toMatch(/Using the CAP/i);
            expect(row.user_prompt).toMatch(/Apply CAP's 7 steps/i);
          }
        }
      }
    });
  });
});
