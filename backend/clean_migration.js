const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'migrations', '0001_initial_schema.sql');

// Read file as buffer
const buffer = fs.readFileSync(filePath);
console.log('Original buffer length:', buffer.length);

// Find null bytes
let nullCount = 0;
for (let i = 0; i < buffer.length; i++) {
  if (buffer[i] === 0) nullCount++;
}
console.log('Null bytes found:', nullCount);

// Convert to string, replacing null bytes
let content = buffer.toString('utf8');
console.log('String length:', content.length);

// Check for BOM
const hasBOM = content.charCodeAt(0) === 0xFEFF;
console.log('Has UTF-8 BOM:', hasBOM);

// Remove BOM
if (hasBOM) {
  content = content.slice(1);
}

// Remove all null bytes
content = content.replace(/\0/g, '');

// Remove lines starting with backslash (psql commands)
const lines = content.split('\n');
const filtered = lines.filter(line => !line.trim().startsWith('\\'));
console.log('Lines removed (backslash):', lines.length - filtered.length);
content = filtered.join('\n');

// Write back as UTF-8 without BOM
fs.writeFileSync(filePath, content, 'utf8');
console.log('File cleaned and saved.');

// Verify
const newBuffer = fs.readFileSync(filePath);
console.log('New buffer length:', newBuffer.length);
let newNullCount = 0;
for (let i = 0; i < newBuffer.length; i++) {
  if (newBuffer[i] === 0) newNullCount++;
}
console.log('Null bytes after cleaning:', newNullCount);

// Show first 200 chars
console.log('\nFirst 200 chars:');
console.log(content.substring(0, 200));
