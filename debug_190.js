// Debug script to find what's at position 190 in the original test content

// Recreate the original test content up to the problematic point
const testContent = `const { WritePlanTool } = require('../../tools/WritePlanTool');
const fs = require('fs').promises;
const path = require('path');

describe('WritePlanTool Symbol & Encoding Stress Test', () => {
  const testDir = path.join(__dirname, 'temp_symbol_tests');
  
  beforeAll(async () => {
    // Clean up and create test directory
    try { await fs.rm(testDir, { recursive: true, force: true }); } catch {}
    await fs.mkdir(testDir, { recursive: true });
  });
  
  afterAll(async () => {
    // Clean up test directory
    try { await fs.rm(testDir, { recursive: true, force: true }); } catch {}
  });
  
  // Helper function to get test file path
  const getTestPath = (filename) => path.join(testDir, filename);
  
  // Helper function to read and verify file content
  const verifyFileContent = async (filePath, expectedContent) => {
    const actualContent = await fs.readFile(filePath, 'utf-8');
    expect(actualContent).toBe(expectedContent);
    return actualContent;
  };
  
  describe('Encoding Preservation Tests', () => {
    test('Basic emojis and Unicode symbols', async () => {
      const content = '😀 🚀 📝 ∑ ∞ ♪ ♛ ∫ ∂ ∇ ±';
      const filePath = getTestPath('basic_emojis.txt');
      
      const result = await WritePlanTool({
        operation: 'create',
        path: filePath,
        content: content
      });
      
      expect(result.success).toBe(true);
      await verifyFileContent(filePath, content);
    });
    
    test('Complex emojis and zero-width joiners', async () => {
      const content = '👨‍👩‍👧‍👦 🏳️‍🌈 👩‍💻 🇺🇸';
      const filePath = getTestPath('complex_emojis.txt');
      
      const result = await WritePlanTool({
        operation: 'create',
        path: filePath,
        content: content
      });
      
      expect(result.success).toBe(true);
      await verifyFileContent(filePath, content);
    });
    
    test('International text mixing', async () => {
      const content = 'Hello 你好 こんにちは مرحبا Привет नमस्ते';
      const filePath = getTestPath('international.txt');
      
      const result = await WritePlanTool({
        operation: 'create',
        path: filePath,
        content: content
      });
      
      expect(result.success).toBe(true);
      await verifyFileContent(filePath, content);
    });
    
    test('Markdown and special formatting characters', async () => {
      const content = '# Header\n*italic* **bold** `code` > quote | table\n& < > " \'';
      const filePath = getTestPath('markdown.txt');
      
      const result = await WritePlanTool({
        operation: 'create',
        path: filePath,
        content: content
      });
      
      expect(result.success).toBe(true);
      await verifyFileContent(filePath, content);
    });
    
    test('Control characters and whitespace', async () => {
      const content = 'Line 1\n\tTabbed line\nLine 3\r\nWindows line\n\u00A0non-breaking';
      const filePath = getTestPath('control_chars.txt');
      
      const result = await WritePlanTool({
        operation: 'create',
        path: filePath,
        content: content
      });
      
      expect(result.success).toBe(true);
      await verifyFileContent(filePath, content);
    });
  });
`;

// Find what's at position 190
console.log('Total length:', testContent.length);
console.log('Character at position 190:', testContent[190]);
console.log('Character code at position 190:', testContent.charCodeAt(190));
console.log('Context around position 190 (180-200):');
console.log(testContent.substring(180, 200));
console.log('Full line containing position 190:');

// Find the line containing position 190
const lines = testContent.split('\n');
let currentPos = 0;
for (const line of lines) {
  if (currentPos <= 190 && currentPos + line.length + 1 > 190) {
    console.log('Line:', line);
    console.log('Position in line:', 190 - currentPos);
    console.log('Character in line:', line[190 - currentPos]);
    break;
  }
  currentPos += line.length + 1; // +1 for newline
}