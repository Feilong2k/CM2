const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'migrations', '0001_initial_schema.sql');

let content = fs.readFileSync(filePath, 'utf8');

// Remove the line with SET transaction_timeout = 0;
// Also note: the migration runner already removes lines starting with backslash.
// We'll split by newline, filter out the line.
const lines = content.split('\n');
const filtered = lines.filter(line => !line.includes('transaction_timeout = 0'));
console.log(`Removed ${lines.length - filtered.length} lines containing transaction_timeout`);

content = filtered.join('\n');

// Write back
fs.writeFileSync(filePath, content, 'utf8');
console.log('File updated.');
