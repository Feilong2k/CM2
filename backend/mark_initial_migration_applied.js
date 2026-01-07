const { getPool, closePool } = require('./src/db/connection');

async function markInitialMigrationApplied() {
  const pool = getPool();
  try {
    // Check if chat_messages table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'chat_messages'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('chat_messages table does not exist, not marking migration as applied.');
      return;
    }

    // Check if migration record already exists
    const migrationCheck = await pool.query(
      'SELECT name FROM migrations WHERE name = $1',
      ['0001_initial_schema.sql']
    );

    if (migrationCheck.rows.length > 0) {
      console.log('Migration 0001_initial_schema.sql already marked as applied.');
      return;
    }

    // Insert the migration record
    await pool.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      ['0001_initial_schema.sql']
    );
    console.log('Migration 0001_initial_schema.sql marked as applied.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  markInitialMigrationApplied();
}
