// Check the length of the test file content
const fs = require('fs');
const path = require('path');

const testFilePath = path.join(__dirname, 'backend/__tests__/tools/writePlanTool.symbolEncodingStress.test.js');

try {
  const content = fs.readFileSync(testFilePath, 'utf-8');
  console.log('Total length:', content.length);
  console.log('\nCharacters around position 190 (180-200):');
  console.log('Indices:     ' + Array.from({length: 20}, (_, i) => (180 + i).toString().padStart(3)).join(' '));
  console.log('Characters:  ' + content.substring(180, 200).split('').map(c => c.charCodeAt(0) < 32 ? '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0') : c).join('   '));
  console.log('Char codes:  ' + content.substring(180, 200).split('').map(c => c.charCodeAt(0).toString().padStart(3)).join(' '));
  
  console.log('\nFull line containing position 190:');
  const lines = content.split('\n');
  let currentPos = 0;
  for (const line of lines) {
    if (currentPos <= 190 && currentPos + line.length + 1 > 190) {
      const posInLine = 190 - currentPos;
      console.log('Line:', line);
      console.log('Position in line:', posInLine);
      console.log('Character at position 190:', JSON.stringify(line[posInLine]));
      console.log('Character code:', line.charCodeAt(posInLine));
      console.log('Context (10 chars before/after):', JSON.stringify(line.substring(Math.max(0, posInLine - 10), Math.min(line.length, posInLine + 10))));
      break;
    }
    currentPos += line.length + 1; // +1 for newline
  }
} catch (error) {
  console.error('Error reading file:', error.message);
}