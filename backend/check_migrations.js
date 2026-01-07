const { getPool, closePool } = require('./src/db/connection');

async function check() {
  const pool = getPool();
  try {
    // Check migrations table
    const migrationsRes = await pool.query('SELECT name FROM migrations ORDER BY name');
    console.log('Applied migrations:');
    migrationsRes.rows.forEach(row => console.log('  ', row.name));

    // Check if steps and work_stages tables exist
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('steps', 'work_stages')
    `);
    console.log('Tables found:', tablesRes.rows.map(r => r.table_name));

    // If steps table exists, show columns
    if (tablesRes.rows.some(r => r.table_name === 'steps')) {
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'steps'
        ORDER BY ordinal_position
      `);
      console.log('steps columns:');
      cols.rows.forEach(col => console.log('  ', col.column_name, col.data_type, col.is_nullable));
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await closePool();
  }
}

check();
