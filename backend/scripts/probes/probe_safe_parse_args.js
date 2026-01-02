/**
 * Probe for testing the enhanced safeParseArgs() function
 * Tests various JSON malformations and complex content that previously failed.
 */

const { parseFunctionCall } = require('../../tools/functionDefinitions');

// Test cases
const testCases = [
  // 1. Normal JSON
  {
    name: 'Normal JSON',
    input: '{"path": "test.txt", "content": "Hello World"}',
    expected: { path: 'test.txt', content: 'Hello World' }
  },
  // 2. JSON with newlines in string (common in markdown)
  {
    name: 'JSON with newlines in string',
    input: '{"path": "test.md", "content": "# Header\\n\\nParagraph with\\nmultiple lines"}',
    expected: { path: 'test.md', content: '# Header\n\nParagraph with\nmultiple lines' }
  },
  // 3. JSON with single quotes (DeepSeek sometimes uses single quotes)
  {
    name: 'JSON with single quotes',
    input: "{'path': 'test.md', 'content': 'Single quoted content'}",
    expected: { path: 'test.md', content: 'Single quoted content' }
  },
  // 4. JSON with unquoted keys
  {
    name: 'JSON with unquoted keys',
    input: '{path: "test.md", content: "Unquoted keys"}',
    expected: { path: 'test.md', content: 'Unquoted keys' }
  },
  // 5. JSON with missing braces (just key-value pairs)
  {
    name: 'JSON missing braces',
    input: '"path": "test.md", "content": "Missing braces"',
    expected: { path: 'test.md', content: 'Missing braces' }
  },
  // 6. Complex markdown content with special characters
  {
    name: 'Complex markdown with special chars',
    input: '{"path": "complex.md", "content": "# Title\\n\\n- List item 1\\n- List item 2\\n\\n`code block`\\n\\n> Quote\\n\\n**Bold** and *italic*"}',
    expected: { 
      path: 'complex.md', 
      content: '# Title\n\n- List item 1\n- List item 2\n\n`code block`\n\n> Quote\n\n**Bold** and *italic*'
    }
  },
  // 7. JSON with tabs in string
  {
    name: 'JSON with tabs',
    input: '{"path": "tabs.txt", "content": "Column1\\tColumn2\\tColumn3"}',
    expected: { path: 'tabs.txt', content: 'Column1\tColumn2\tColumn3' }
  },
  // 8. JSON with escaped backslashes
  {
    name: 'JSON with escaped backslashes',
    input: '{"path": "windows.txt", "content": "C:\\\\Users\\\\Test\\\\file.txt"}',
    expected: { path: 'windows.txt', content: 'C:\\Users\\Test\\file.txt' }
  }
];

function runTest() {
  console.log('=== Testing safeParseArgs via parseFunctionCall ===\n');
  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log(`Input: ${testCase.input.substring(0, 80)}${testCase.input.length > 80 ? '...' : ''}`);

    // We'll simulate a tool call object that parseFunctionCall expects
    const toolCall = {
      function: {
        name: 'FileSystemTool_write_to_file',
        arguments: testCase.input
      }
    };

    try {
      const result = parseFunctionCall(toolCall);
      // We only care about the params (which are the parsed arguments)
      const params = result.params;

      // Compare with expected
      const success = JSON.stringify(params) === JSON.stringify(testCase.expected);
      if (success) {
        console.log('✅ PASSED\n');
        passed++;
      } else {
        console.log('❌ FAILED');
        console.log(`Expected: ${JSON.stringify(testCase.expected)}`);
        console.log(`Got: ${JSON.stringify(params)}`);
        console.log('');
        failed++;
      }
    } catch (error) {
      console.log('❌ ERROR:', error.message);
      console.log('');
      failed++;
    }
  });

  console.log('=== Summary ===');
  console.log(`Total: ${testCases.length}, Passed: ${passed}, Failed: ${failed}`);

  return failed === 0;
}

// Also test the function directly (optional)
function testDirect() {
  console.log('\n=== Direct test of safeParseArgs (if accessible) ===');
  // We cannot directly require safeParseArgs because it's not exported.
  // Instead we rely on parseFunctionCall.
}

if (require.main === module) {
  const success = runTest();
  process.exit(success ? 0 : 1);
} else {
  module.exports = { runTest };
}
