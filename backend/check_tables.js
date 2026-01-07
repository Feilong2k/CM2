const { getPool, closePool } = require('./src/db/connection');

async function check() {
  const pool = getPool();
  try {
    // List all tables
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('All tables in public schema:');
    tablesRes.rows.forEach(row => console.log('  ', row.table_name));

    // Check for projects table
    const projectsCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'projects'
      ORDER BY ordinal_position
    `);
    if (projectsCheck.rows.length === 0) {
      console.log('\nprojects table does NOT exist.');
    } else {
      console.log('\nprojects table exists with columns:');
      projectsCheck.rows.forEach(col => console.log('  ', col.column_name, col.data_type, col.is_nullable));
    }

    // Check for subtasks table
    const subtasksCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'subtasks'
      ORDER BY ordinal_position
    `);
    if (subtasksCheck.rows.length === 0) {
      console.log('\nsubtasks table does NOT exist.');
    } else {
      console.log('\nsubtasks table exists with columns:');
      subtasksCheck.rows.forEach(col => console.log('  ', col.column_name, col.data_type, col.is_nullable));
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await closePool();
  }
}

check();
