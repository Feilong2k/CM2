const fs = require('fs');
const path = require('path');
const fileSystemTool = require('../../../tools/FileSystemTool');
const functionDefinitions = require('../../../tools/functionDefinitions');
const ToolRunner = require('../../../tools/ToolRunner');

describe('Tool Reliability – write_to_file', () => {
  const testOutputDir = path.join(__dirname, '../../test-output');
  const tool = fileSystemTool;

  beforeAll(() => {
    // Ensure test output directory exists
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test output directory after all tests
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean up any existing files in the test output directory before each test
    if (fs.existsSync(testOutputDir)) {
      fs.readdirSync(testOutputDir).forEach((file) => {
        const filePath = path.join(testOutputDir, file);
        fs.rmSync(filePath, { force: true });
      });
    }
  });

  describe('Test Case A: Increasing File Size', () => {
    const sizes = [1_000, 10_000, 50_000, 100_000];

    sizes.forEach((size) => {
      it(`should write ${size} characters without error`, async () => {
        const fileName = `write-size-${size}.txt`;
        const filePath = path.join(testOutputDir, fileName);
        // Generate a string of exactly `size` 'X' characters (no newlines to avoid complexity)
        const content = 'X'.repeat(size);

        expect(content.length).toBe(size);

        // Call the write_to_file tool method
        const toolArgs = { path: filePath, content };
        let result;
        try {
          result = await tool.tools.write_to_file(toolArgs);
        } catch (error) {
          // Log the error and rethrow so the test fails
          console.error(`Failed to write ${size} characters:`, error);
          throw error;
        }

        // Assert the tool returned a success message
        expect(result).toBe(`Successfully wrote to ${filePath}`);

        // Assert the file exists and has the correct size
        expect(fs.existsSync(filePath)).toBe(true);
        const stats = fs.statSync(filePath);
        // Since we are writing only ASCII 'X' (1 byte each) and no newlines, the file size should equal `size`
        const tolerance = 0; // No tolerance because we expect exact match
        expect(Math.abs(stats.size - size)).toBeLessThanOrEqual(tolerance);
      });
    });
  });

  describe('Test Case B: Special Characters / JSON Issues', () => {
    it('should write content with complex characters without argument parsing failures', async () => {
      const fileName = 'write-special-characters.md';
      const filePath = path.join(testOutputDir, fileName);

      // Construct a string with tricky characters
      const content = `
# Test File with Special Characters

## Quotes
- Double quote: "
- Single quote: '

## Backslashes
- One backslash: \\
- Two backslashes: \\\\

## Newlines
This line has a newline after it.
This is the next line.

## Markdown
\`\`\`javascript
const code = "with quotes and backslashes \\\\";
\`\`\`

## JSON-like content
{
  "key": "value with \\"quotes\\" and 'apostrophes'",
  "another": "backslash \\\\"
}

End of file.
      `.trim();

      // Call the write_to_file tool method
      const toolArgs = { path: filePath, content };
      let result;
      try {
        result = await tool.tools.write_to_file(toolArgs);
      } catch (error) {
        console.error('Failed to write special characters:', error);
        throw error;
      }

      // Assert the tool returned a success message
      expect(result).toBe(`Successfully wrote to ${filePath}`);

      // Read the file back and compare content exactly
      const fileContent = fs.readFileSync(filePath, 'utf8');
      expect(fileContent).toBe(content);
    });
  });

  // Test Case C: Simulated Heavy Context (Optional) - we'll skip for now as per instructions
  // but we can leave a placeholder.
  describe('Test Case C: Simulated Heavy Context (Stretch)', () => {
    it('should write large content after simulating heavy context (placeholder)', async () => {
      // This is a placeholder test that passes. In the future, we can expand.
      expect(true).toBe(true);
    });
  });

  describe('ToolRunner + functionDefinitions integration', () => {
    it('writes a large file end-to-end via FileSystemTool_write_to_file', async () => {
      const size = 50_000;
      const content = 'X'.repeat(size);
      const targetPath = path.join(testOutputDir, 'toolrunner-large.txt');

      const toolCall = {
        function: {
          // We no longer expose FileSystemTool_write_to_file via
          // functionDefinitions, but parseFunctionCall can still
          // interpret this function-style name. This keeps the
          // ToolRunner + argument parsing contract exercised
          // without requiring the function to be LLM-callable.
          name: 'FileSystemTool_write_to_file',
          arguments: JSON.stringify({
            path: targetPath,
            content,
          }),
        },
      };

      const { parseFunctionCall } = functionDefinitions;
      const { tool: toolName, action, params } = parseFunctionCall(toolCall);

      expect(toolName).toBe('FileSystemTool');
      expect(action).toBe('write_to_file');
      expect(params.path).toBe(targetPath);
      expect(params.content.length).toBe(size);

      const toolRegistry = { FileSystemTool: tool };
      const context = {};
      const result = await ToolRunner.executeToolCall(toolRegistry, toolCall, context);

      // The result should be the success message.
      expect(result).toBe(`Successfully wrote to ${targetPath}`);

      const stat = fs.statSync(targetPath);
      expect(stat.size).toBe(size);
    });

    it('writes complex content via ToolRunner without argument parsing errors', async () => {
      const complexContent = `
# Title "with quotes" and 'single quotes'

Some JSON-like structure:
{
  "key": "value with \\\\ backslashes and \\"escaped quotes\\"",
  "array": [1, 2, 3],
  "nested": {"a": "b"}
}

\`\`\`js
// code block
const foo = "bar";
\`\`\`
`.trim();

      const targetPath = path.join(testOutputDir, 'toolrunner-special.md');

      const toolCall = {
        function: {
          name: 'FileSystemTool_write_to_file',
          arguments: JSON.stringify({
            path: targetPath,
            content: complexContent,
          }),
        },
      };

      const { parseFunctionCall } = functionDefinitions;
      const { tool: toolName, action, params } = parseFunctionCall(toolCall);

      expect(toolName).toBe('FileSystemTool');
      expect(action).toBe('write_to_file');

      const toolRegistry = { FileSystemTool: tool };
      const context = {};
      const result = await ToolRunner.executeToolCall(toolRegistry, toolCall, context);

      expect(result).toBe(`Successfully wrote to ${targetPath}`);

      const readBack = fs.readFileSync(targetPath, 'utf8');
      expect(readBack).toBe(complexContent);
    });
  });
});
