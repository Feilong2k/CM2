const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'migrations', '0001_initial_schema.sql');

let content = fs.readFileSync(filePath, 'utf8');

// Replace CREATE FUNCTION with CREATE OR REPLACE FUNCTION for update_updated_at_column
// We have to be careful because there might be multiple functions, but in this dump there is only one.
// We'll look for the line that starts with "CREATE FUNCTION public.update_updated_at_column()"
const lines = content.split('\n');
let updated = false;
const newLines = lines.map(line => {
  if (line.trim().startsWith('CREATE FUNCTION public.update_updated_at_column()')) {
    updated = true;
    return line.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION');
  }
  return line;
});

if (updated) {
  console.log('Replaced CREATE FUNCTION with CREATE OR REPLACE FUNCTION');
  content = newLines.join('\n');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Migration file updated.');
} else {
  console.log('Did not find the function creation line.');
}
