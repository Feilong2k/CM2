require('dotenv').config();
const { runMigrations, closePool } = require('./src/db/connection');

async function main() {
  try {
    await runMigrations();
    console.log('Migrations applied successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  main();
}
