require('dotenv').config();
const fs = require('fs');
const { pool } = require('./config/db');

async function run() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'not set');
  
  try {
    // Apply migration
    const sql = fs.readFileSync('./migrations/0002_step_enum_types.sql', 'utf8');
    console.log('Running migration...');
    await pool.query(sql);
    console.log('Migration applied successfully (or already exists).');
    
    // Verify ENUMs
    const res = await pool.query(
      "SELECT typname FROM pg_type WHERE typname IN ('step_type', 'status', 'assigned_to', 'work_stage') ORDER BY typname;"
    );
    console.log(`Found ${res.rows.length} ENUM types:`);
    res.rows.forEach(row => console.log(' -', row.typname));
    
    if (res.rows.length === 4) {
      console.log('SUCCESS: All 4 ENUM types are present in the database.');
    } else {
      console.error('ERROR: Missing some ENUM types.');
      process.exit(1);
    }
    
    // Test idempotency: run migration again
    console.log('\nTesting idempotency (running migration a second time)...');
    await pool.query(sql);
    console.log('Idempotency test passed (no error on second run).');
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
