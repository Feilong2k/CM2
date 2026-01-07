const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'migrations', '0001_initial_schema.sql');

// Read as buffer
const buffer = fs.readFileSync(filePath);
console.log('First 10 bytes in hex:');
for (let i = 0; i < Math.min(10, buffer.length); i++) {
  console.log(`  ${i}: 0x${buffer[i].toString(16).padStart(2, '0')} (${buffer[i]})`);
}

// Check for BOMs
// UTF-8 BOM: 0xEF, 0xBB, 0xBF
// UTF-16 LE BOM: 0xFF, 0xFE
// UTF-16 BE BOM: 0xFE, 0xFF
let offset = 0;
if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
  console.log('Found UTF-8 BOM, skipping 3 bytes');
  offset = 3;
} else if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
  console.log('Found UTF-16 LE BOM, skipping 2 bytes');
  offset = 2;
} else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
  console.log('Found UTF-16 BE BOM, skipping 2 bytes');
  offset = 2;
}

// Convert to string from the offset, using UTF-8
let content = buffer.slice(offset).toString('utf8');

// Remove any remaining null bytes
content = content.replace(/\0/g, '');

// Remove lines starting with backslash
const lines = content.split('\n');
const filtered = lines.filter(line => !line.trim().startsWith('\\'));
console.log(`Removed ${lines.length - filtered.length} lines starting with backslash`);
content = filtered.join('\n');

// Remove any non-ASCII control characters (except newline, carriage return, tab)
// We'll keep all characters that are in the range 32-126 or whitespace (9,10,13,32)
// But note: there might be non-ASCII in comments? We'll assume not for migration.
// We can also remove any character with code less than 32 except 9,10,13.
let cleaned = '';
for (let i = 0; i < content.length; i++) {
  const ch = content[i];
  const code = content.charCodeAt(i);
  if (code >= 32 || code === 9 || code === 10 || code === 13) {
    cleaned += ch;
  } else {
    console.log(`Removing control character at index ${i}: code ${code}`);
  }
}

// If we removed any, update content
if (cleaned.length !== content.length) {
  console.log(`Removed ${content.length - cleaned.length} control characters`);
  content = cleaned;
}

// Write back
fs.writeFileSync(filePath, content, 'utf8');
console.log('File fixed and saved.');

// Show first 100 characters of cleaned file
console.log('\nFirst 100 chars after cleaning:');
console.log(content.substring(0, 100));
