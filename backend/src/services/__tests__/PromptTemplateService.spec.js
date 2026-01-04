const fs = require('fs');
const path = require('path');

// The service we are testing (does not exist yet)
const PromptTemplateService = require('../PromptTemplateService');

describe('PromptTemplateService', () => {
  const promptsDir = path.join(__dirname, '../../../prompts');
  const templatePath = path.join(promptsDir, 'orion_system.md');

  describe('Test 1: Template existence & syntax', () => {
    it('should have a template file at the expected location', () => {
      // The file must exist
      expect(fs.existsSync(templatePath)).toBe(true);
    });

    it('should contain expected placeholders', () => {
      const content = fs.readFileSync(templatePath, 'utf8');
      // We expect at least these placeholders
      expect(content).toContain('{{file_tree}}');
      expect(content).toContain('{{project_state}}');
      expect(content).toContain('{{history_summary}}');
      // The template should be in markdown format (optional check)
      expect(content.trim().length).toBeGreaterThan(0);
    });
  });

  describe('Test 2: Variable replacement', () => {
    it('should replace placeholders with context values', () => {
      // We can test with a mock template string to avoid depending on the actual file content.
      // However, the service is expected to load the template from disk. We'll mock the file read?
      // Instead, we'll test the service's loadTemplate method with the real template, but we need to ensure the template exists.
      // Since the template existence is tested above, we can proceed.

      const service = new PromptTemplateService();
      const context = {
        file_tree: 'src/index.js\nsrc/utils/helper.js',
        project_state: 'Active',
        history_summary: 'Last 5 messages'
      };

      const result = service.loadTemplate('orion_system.md', context);

      // The result should contain the context values
      expect(result).toContain(context.file_tree);
      expect(result).toContain(context.project_state);
      expect(result).toContain(context.history_summary);

      // The result should NOT contain the raw placeholders
      expect(result).not.toContain('{{file_tree}}');
      expect(result).not.toContain('{{project_state}}');
      expect(result).not.toContain('{{history_summary}}');
    });

    it('should handle multiple occurrences of the same placeholder', () => {
      // This test assumes the template might have multiple occurrences of a placeholder.
      // We'll create a temporary template string for this test.
      const templateContent = `File tree: {{file_tree}}\nAnother mention: {{file_tree}}`;
      const tempTemplatePath = path.join(promptsDir, 'test_template.md');
      fs.writeFileSync(tempTemplatePath, templateContent);

      const service = new PromptTemplateService();
      const context = { file_tree: 'test' };
      const result = service.loadTemplate('test_template.md', context);

      // Both placeholders should be replaced
      expect(result).toBe('File tree: test\nAnother mention: test');

      fs.unlinkSync(tempTemplatePath);
    });
  });

  describe('Test 3: Missing variables (Safety)', () => {
    it('should replace missing variables with empty string or default', () => {
      // We'll create a template with a placeholder that is not provided in context.
      const templateContent = `File tree: {{file_tree}}\nMissing: {{missing_var}}`;
      const tempTemplatePath = path.join(promptsDir, 'test_missing.md');
      fs.writeFileSync(tempTemplatePath, templateContent);

      const service = new PromptTemplateService();
      const context = { file_tree: 'test' };
      const result = service.loadTemplate('test_missing.md', context);

      // The provided placeholder should be replaced.
      expect(result).toContain('File tree: test');
      // The missing placeholder should be replaced with empty string or a default.
      // We'll check that the placeholder is gone (replaced by something).
      // The exact behavior is up to the implementation. We'll accept either empty string or a default like 'None'.
      // We'll just assert that the raw placeholder '{{missing_var}}' is not present.
      expect(result).not.toContain('{{missing_var}}');

      fs.unlinkSync(tempTemplatePath);
    });

    it('should not throw when context is empty', () => {
      const templateContent = `File tree: {{file_tree}}`;
      const tempTemplatePath = path.join(promptsDir, 'test_empty.md');
      fs.writeFileSync(tempTemplatePath, templateContent);

      const service = new PromptTemplateService();
      const context = {};
      // Should not throw
      expect(() => service.loadTemplate('test_empty.md', context)).not.toThrow();

      // The placeholder should be replaced with something (empty string or default)
      const result = service.loadTemplate('test_empty.md', context);
      expect(result).not.toContain('{{file_tree}}');

      fs.unlinkSync(tempTemplatePath);
    });
  });
});
