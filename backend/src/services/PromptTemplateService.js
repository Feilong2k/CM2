const fs = require('fs');
const path = require('path');

class PromptTemplateService {
  /**
   * Loads a template and replaces placeholders with context values.
   * @param {string} templateName - Filename in backend/prompts/ (e.g. 'orion_system.md')
   * @param {Object} context - Key-value pairs for replacement
   * @returns {string} Processed template string
   */
  loadTemplate(templateName, context = {}) {
    // Resolve to the canonical prompts directory at backend/prompts
    const promptsDir = path.join(__dirname, '../../prompts');
    const templatePath = path.join(promptsDir, templateName);

    // Read the template file
    let templateContent;
    try {
      templateContent = fs.readFileSync(templatePath, 'utf8');
    } catch (err) {
      throw new Error(`Cannot read template file: ${templatePath}. ${err.message}`);
    }

    // Replace all occurrences of {{key}} with context[key]
    // If a key is missing, replace with empty string.
    const replaced = templateContent.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context.hasOwnProperty(key) ? context[key] : '';
    });

    return replaced;
  }
}

module.exports = PromptTemplateService;
