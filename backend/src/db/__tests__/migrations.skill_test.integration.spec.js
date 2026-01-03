const { runMigrations, query, closePool } = require('../connection');

describe('Skill test tables migration integration', () => {
  beforeAll(async () => {
    // Ensure we are in test environment and using DATABASE_URL_TEST
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    await closePool();
  });

  it('should create skill_test_responses and skill_test_grades tables after running migrations', async () => {
    // Run all pending migrations (including 0003_skill_test_tables.sql)
    await runMigrations();

    // Check that skill_test_responses table exists
    const responsesCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'skill_test_responses'
      );
    `);
    expect(responsesCheck.rows[0].exists).toBe(true);

    // Check that skill_test_grades table exists
    const gradesCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'skill_test_grades'
      );
    `);
    expect(gradesCheck.rows[0].exists).toBe(true);

    // Optionally, check that the tables have the expected columns
    const responsesColumns = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'skill_test_responses'
      ORDER BY column_name;
    `);
    const expectedResponseColumns = [
      'id', 'test_phase', 'subtask_id', 'user_prompt', 'orion_response',
      'response_metadata', 'created_at'
    ];
    const actualResponseColumns = responsesColumns.rows.map(row => row.column_name);
    expectedResponseColumns.forEach(col => {
      expect(actualResponseColumns).toContain(col);
    });

    const gradesColumns = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'skill_test_grades'
      ORDER BY column_name;
    `);
    const expectedGradesColumns = [
      'id', 'response_id', 'discovery_score', 'cap_steps_applied',
      'total_steps_applied', 'completeness_score', 'depth_score',
      'constraint_count', 'actionable_score', 'grading_rationale',
      'graded_by', 'graded_at', 'created_at'
    ];
    const actualGradesColumns = gradesColumns.rows.map(row => row.column_name);
    expectedGradesColumns.forEach(col => {
      expect(actualGradesColumns).toContain(col);
    });
  });
});
