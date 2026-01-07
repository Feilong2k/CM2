const { getPool, closePool } = require('./src/db/connection');

async function markSkillTestTablesApplied() {
  const pool = getPool();
  try {
    // Check if skill_test_responses table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'skill_test_responses'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('skill_test_responses table does not exist, not marking migration as applied.');
      return;
    }

    // Check if migration record already exists
    const migrationCheck = await pool.query(
      'SELECT name FROM migrations WHERE name = $1',
      ['0003_skill_test_tables.sql']
    );

    if (migrationCheck.rows.length > 0) {
      console.log('Migration 0003_skill_test_tables.sql already marked as applied.');
      return;
    }

    // Insert the migration record
    await pool.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      ['0003_skill_test_tables.sql']
    );
    console.log('Migration 0003_skill_test_tables.sql marked as applied.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  markSkillTestTablesApplied();
}
