const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

// Try to require the WritePlanTool
let WritePlanTool;
let writePlanToolInstance;

beforeAll(() => {
  try {
    WritePlanTool = require('../../tools/WritePlanTool');
    // The module exports { executeWritePlan, execute }
    if (WritePlanTool && typeof WritePlanTool.execute === 'function') {
      writePlanToolInstance = WritePlanTool;
    }
  } catch (e) {
    writePlanToolInstance = null;
    console.error('Failed to load WritePlanTool:', e);
  }
});

describe('WritePlanTool Symbol & Encoding Stress Test', () => {
  const tempDir = path.join(__dirname, 'temp_symbol_tests');
  
  beforeAll(async () => {
    // Clean up and create test directory
    try { 
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
    fs.mkdirSync(tempDir, { recursive: true });
  });
  
  afterAll(() => {
    // Clean up test directory
    try { 
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });
  
  // Helper to get test file path
  const getTestPath = (filename) => path.join(tempDir, filename);
  
  // Helper to check if tool is available
  const requireTool = () => {
    if (!writePlanToolInstance) {
      throw new Error('WritePlanTool not available');
    }
  };
  
  describe('Encoding Preservation Tests', () => {
    test('Basic emojis and Unicode symbols', async () => {
      requireTool();
      const content = '😀 🚀 📝 ∑ ∞ ♪ ♛ ∫ ∂ ∇ ±';
      const filePath = getTestPath('basic_emojis.txt');
      
      await writePlanToolInstance.execute({
        operation: 'create',
        path: filePath,
        content: content
      });
      
      const actualContent = fs.readFileSync(filePath, 'utf-8');
      expect(actualContent).toBe(content);
    });
    
    test('Complex emojis with zero-width joiners', async () => {
      requireTool();
      const content = '👨‍👩‍👧‍👦 🏳️‍🌈 👩‍💻 🇺🇸';
      const filePath = getTestPath('complex_emojis.txt');
      
      await writePlanToolInstance.execute({
        operation: 'create',
        path: filePath,
        content: content
      });
      
      const actualContent = fs.readFileSync(filePath, 'utf-8');
      expect(actualContent).toBe(content);
    });
    
    test('International text mixing', async () => {
      requireTool();
      const content = 'Hello 你好 こんにちは مرحبا Привет नमस्ते';
      const filePath = getTestPath('international.txt');
      
      await writePlanToolInstance.execute({
        operation: 'create',
        path: filePath,
        content: content
      });
      
      const actualContent = fs.readFileSync(filePath, 'utf-8');
      expect(actualContent).toBe(content);
    });
    
    test('Markdown and special formatting characters', async () => {
      requireTool();
      const content = '# Header\n*italic* **bold** `code` > quote | table\n& < > " \'';
      const filePath = getTestPath('markdown.txt');
      
      await writePlanToolInstance.execute({
        operation: 'create',
        path: filePath,
        content: content
      });
      
      const actualContent = fs.readFileSync(filePath, 'utf-8');
      expect(actualContent).toBe(content);
    });
    
    test('Control characters and whitespace', async () => {
      requireTool();
      const content = 'Line 1\n\tTabbed line\nLine 3\r\nWindows line\n\u00A0non-breaking';
      const filePath = getTestPath('control_chars.txt');
      
      await writePlanToolInstance.execute({
        operation: 'create',
        path: filePath,
        content: content
      });
      
      const actualContent = fs.readFileSync(filePath, 'utf-8');
      expect(actualContent).toBe(content);
    });
  });
  
  describe('Operation Consistency Tests', () => {
    test('Create, append, and overwrite with symbols', async () => {
      requireTool();
      const filePath = getTestPath('operation_consistency.txt');
      const initialContent = 'Initial: 😀 ∑ 你好';
      const appendContent = '\nAppended: 🚀 ∞ こんにちは';
      const overwriteContent = 'Overwritten: 📝 ♪ مرحبا';
      
      // Create with symbols
      await writePlanToolInstance.execute({
        operation: 'create',
        path: filePath,
        content: initialContent
      });
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(initialContent);
      
      // Append with symbols
      await writePlanToolInstance.execute({
        operation: 'append',
        path: filePath,
        content: appendContent
      });
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(initialContent + appendContent);
      
      // Overwrite with symbols
      await writePlanToolInstance.execute({
        operation: 'overwrite',
        path: filePath,
        content: overwriteContent
      });
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(overwriteContent);
    });
  });
  
  describe('Edge Cases', () => {
    test('Empty content with symbols', async () => {
      requireTool();
      const filePath = getTestPath('empty_symbols.txt');
      
      await writePlanToolInstance.execute({
        operation: 'create',
        path: filePath,
        content: ''
      });
      
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('');
    });
    
    test('Single character symbol file', async () => {
      requireTool();
      const filePath = getTestPath('single_char.txt');
      const content = '∑';
      
      await writePlanToolInstance.execute({
        operation: 'create',
        path: filePath,
        content: content
      });
      
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(content);
    });
    
    test('Large symbol-heavy content', async () => {
      requireTool();
      const filePath = getTestPath('large_symbols.txt');
      // Create content with repeating symbols
      const symbols = ['😀', '∑', '你好', '🚀', '∞', '♪'];
      let content = '';
      for (let i = 0; i < 100; i++) {
        content += symbols[i % symbols.length] + ' ';
      }
      
      await writePlanToolInstance.execute({
        operation: 'create',
        path: filePath,
        content: content
      });
      
      const actualContent = fs.readFileSync(filePath, 'utf-8');
      expect(actualContent).toBe(content);
      expect(actualContent.length).toBe(content.length);
    });
  });
});