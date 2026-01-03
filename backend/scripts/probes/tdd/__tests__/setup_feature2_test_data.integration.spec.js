const { getPool, query, closePool } = require('../../../../src/db/connection');

// The function we are testing (will be implemented by Devon)
const { setupFeature2TestData } = require('../setup_feature2_test_data');

describe('Feature 2 test data seeding integration', () => {
  let pool;

  beforeAll(async () => {
    // Ensure we are in test environment and using DATABASE_URL_TEST
    process.env.NODE_ENV = 'test';
    pool = getPool();
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean up any existing Feature 2 data to start fresh
    // We delete in reverse order due to foreign key constraints
    await pool.query(`DELETE FROM subtasks WHERE external_id IN (
      '2-1-1', '2-1-2', '2-1-3', '2-1-4', '2-1-5', '2-1-6',
      '2-2-1', '2-2-2', '2-2-3', '2-2-4', '2-2-5', '2-2-6'
    )`);
    await pool.query(`DELETE FROM tasks WHERE external_id IN ('P1-F2-T1', 'P1-F2-T2')`);
    await pool.query(`DELETE FROM features WHERE external_id = 'P1-F2'`);
  });

  describe('Test 1 – Creates full Feature 2 hierarchy', () => {
    it('should insert P1‑F2, its two tasks, and all 12 subtasks', async () => {
      // Act
      await setupFeature2TestData();

      // Assert Feature
      const featureResult = await query(
        'SELECT * FROM features WHERE external_id = $1',
        ['P1-F2']
      );
      expect(featureResult.rows).toHaveLength(1);
      const feature = featureResult.rows[0];
      expect(feature.external_id).toBe('P1-F2');
      expect(feature.title).toBe('Feature 2: Skills Framework MVP');

      // Assert Tasks (should be 2)
      const tasksResult = await query(
        'SELECT * FROM tasks WHERE external_id IN ($1, $2) ORDER BY external_id',
        ['P1-F2-T1', 'P1-F2-T2']
      );
      expect(tasksResult.rows).toHaveLength(2);

      const task1 = tasksResult.rows.find(r => r.external_id === 'P1-F2-T1');
      const task2 = tasksResult.rows.find(r => r.external_id === 'P1-F2-T2');

      expect(task1).toBeDefined();
      expect(task2).toBeDefined();
      expect(task1.feature_id).toBe(feature.id);
      expect(task2.feature_id).toBe(feature.id);

      // Assert Subtasks (should be 12 total, 6 per task)
      const subtasksResult = await query(
        `SELECT s.*, t.external_id as task_external_id
         FROM subtasks s
         INNER JOIN tasks t ON s.task_id = t.id
         WHERE t.external_id IN ('P1-F2-T1', 'P1-F2-T2')
         ORDER BY s.external_id`
      );
      expect(subtasksResult.rows).toHaveLength(12);

      // Check that we have the 6 expected external IDs for each task
      const task1Subtasks = subtasksResult.rows.filter(r => r.task_external_id === 'P1-F2-T1');
      const task2Subtasks = subtasksResult.rows.filter(r => r.task_external_id === 'P1-F2-T2');

      expect(task1Subtasks).toHaveLength(6);
      expect(task2Subtasks).toHaveLength(6);

      const expectedTask1Ids = ['2-1-1', '2-1-2', '2-1-3', '2-1-4', '2-1-5', '2-1-6'];
      const expectedTask2Ids = ['2-2-1', '2-2-2', '2-2-3', '2-2-4', '2-2-5', '2-2-6'];

      task1Subtasks.forEach(st => {
        expect(expectedTask1Ids).toContain(st.external_id);
      });
      task2Subtasks.forEach(st => {
        expect(expectedTask2Ids).toContain(st.external_id);
      });
    });
  });

  describe('Test 2 – Idempotence', () => {
    it('should not duplicate rows when run twice', async () => {
      // Run first time
      await setupFeature2TestData();
      // Run second time
      await setupFeature2TestData();

      // Counts should be exactly 1 feature, 2 tasks, 12 subtasks
      const featureCount = await query('SELECT COUNT(*) FROM features WHERE external_id = $1', ['P1-F2']);
      expect(parseInt(featureCount.rows[0].count, 10)).toBe(1);

      const taskCount = await query('SELECT COUNT(*) FROM tasks WHERE external_id IN ($1, $2)', ['P1-F2-T1', 'P1-F2-T2']);
      expect(parseInt(taskCount.rows[0].count, 10)).toBe(2);

      const subtaskCount = await query(`
        SELECT COUNT(*)
        FROM subtasks s
        INNER JOIN tasks t ON s.task_id = t.id
        WHERE t.external_id IN ('P1-F2-T1', 'P1-F2-T2')
      `);
      expect(parseInt(subtaskCount.rows[0].count, 10)).toBe(12);
    });
  });
});
