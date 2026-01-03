const FileTreeContextBuilder = require('./FileTreeContextBuilder');
const PromptTemplateService = require('./PromptTemplateService');
const HistoryLoaderService = require('./HistoryLoaderService');
const SkillLoaderService = require('./SkillLoaderService');

class ContextService {
  constructor(options = {}) {
    // Inject dependencies or instantiate defaults
    this.fileTreeBuilder = options.fileTreeBuilder || new FileTreeContextBuilder();
    this.promptService = options.promptService || new PromptTemplateService();
    this.historyService = options.historyService || new HistoryLoaderService();
    this.skillLoader = options.skillLoader || new SkillLoaderService();
  }

  /**
   * Builds the system prompt and context data for a project.
   * @param {string} projectId - Project ID
   * @param {string} rootPath - File system root path
   * @param {Object} options - Optional parameters
   * @param {boolean} options.includeSkills - Whether to include skills in the prompt (default: false)
   * @param {Array<string>} options.skillNames - Specific skill names to include (if null, include all)
   * @returns {Promise<{ systemPrompt: string, historyMessages: Array, contextData: Object }>}
   */
  async buildContext(projectId, rootPath, options = {}) {
    const { includeSkills = false, skillNames = null } = options;

    // 1. File tree with concise limits
    const fileTree = await this.fileTreeBuilder.buildTree(rootPath, {
      maxDepth: 2,
      maxLines: 50,
    });

    // 2. Recent chat history (limit 20)
    const historyRows = await this.historyService.loadRecentChatHistory({
      projectId,
      limit: 20,
    });

    // 3. Map history rows to message objects (role: 'user' | 'assistant' | 'system')
    const historyMessages = historyRows.map(row => {
      // Map sender to role
      let role;
      switch (row.sender) {
        case 'orion':
          role = 'assistant';
          break;
        case 'system':
          role = 'system';
          break;
        default:
          role = 'user'; // 'user' or any other
      }
      return { role, content: row.content };
    });

    // 4. History summary (using the same rows, but we can limit to 10 for brevity)
    const historySummary = this._formatHistorySummary(historyRows);

    // 5. Project state (placeholder)
    const projectState = 'Active';

    // 6. Skills section (conditional)
    let skillsSection = '';
    if (includeSkills) {
      skillsSection = this.skillLoader.generateSkillsPromptSection(skillNames);
    }

    // 7. Load and fill the template
    const systemPrompt = this.promptService.loadTemplate('orion_system.md', {
      file_tree: fileTree,
      history_summary: historySummary,
      project_state: projectState,
      skills_section: skillsSection,
    });

    // 8. Return
    return {
      systemPrompt,
      historyMessages,
      contextData: {
        file_tree: fileTree,
        history_summary: historySummary,
        project_state: projectState,
        skills_section: skillsSection,
      },
    };
  }

  /**
   * Format chat history into a simple string summary.
   * @param {Array} history - Array of message objects
   * @returns {string}
   */
  _formatHistorySummary(history) {
    if (history.length === 0) {
      return 'No recent history.';
    }

    const lines = history.map(msg => {
      // Truncate content if too long? We'll keep it as is for now.
      const content = msg.content.length > 100
        ? msg.content.substring(0, 100) + '...'
        : msg.content;
      return `- ${msg.sender}: ${content}`;
    });

    return `Last ${history.length} messages:\n${lines.join('\n')}`;
  }
}

module.exports = ContextService;
