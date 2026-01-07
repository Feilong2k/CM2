const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'migrations', '0001_initial_schema.sql');

// Read as buffer
const buffer = fs.readFileSync(filePath);

// Convert each byte to a Latin-1 character (0-255)
let content = '';
for (let i = 0; i < buffer.length; i++) {
  const byte = buffer[i];
  // Skip null bytes
  if (byte === 0) continue;
  // Convert byte to Latin-1 character
  content += String.fromCharCode(byte);
}

// Now remove lines starting with backslash (psql commands)
const lines = content.split('\n');
const filtered = lines.filter(line => !line.trim().startsWith('\\'));
console.log(`Removed ${lines.length - filtered.length} lines starting with backslash`);
content = filtered.join('\n');

// Remove any non-ASCII control characters (except newline, carriage return, tab)
let cleaned = '';
for (let i = 0; i < content.length; i++) {
  const code = content.charCodeAt(i);
  // Keep printable ASCII (32-126) and whitespace (9,10,13)
  if (code >= 32 && code <= 126 || code === 9 || code === 10 || code === 13) {
    cleaned += content[i];
  } else {
    // Replace with space? Let's just skip for now.
    // But note: we might have non-ASCII characters in comments? We'll skip them.
  }
}

// If we removed any, update content
if (cleaned.length !== content.length) {
  console.log(`Removed ${content.length - cleaned.length} non-printable characters`);
  content = cleaned;
}

// Write back as UTF-8
fs.writeFileSync(filePath, content, 'utf8');
console.log('File cleaned and saved.');

// Show first 200 characters
console.log('\nFirst 200 chars:');
console.log(content.substring(0, 200));
