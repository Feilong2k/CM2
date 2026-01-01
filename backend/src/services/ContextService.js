const FileTreeContextBuilder = require('./FileTreeContextBuilder');
const PromptTemplateService = require('./PromptTemplateService');
const HistoryLoaderService = require('./HistoryLoaderService');

class ContextService {
  constructor(options = {}) {
    // Inject dependencies or instantiate defaults
    this.fileTreeBuilder = options.fileTreeBuilder || new FileTreeContextBuilder();
    this.promptService = options.promptService || new PromptTemplateService();
    this.historyService = options.historyService || new HistoryLoaderService();
  }

  /**
   * Builds the system prompt and context data for a project.
   * @param {string} projectId - Project ID
   * @param {string} rootPath - File system root path
   * @returns {Promise<{ systemPrompt: string, contextData: Object }>}
   */
  async buildContext(projectId, rootPath) {
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

    // 6. Load and fill the template
    const systemPrompt = this.promptService.loadTemplate('orion_system.md', {
      file_tree: fileTree,
      history_summary: historySummary,
      project_state: projectState,
    });

    // 7. Return
    return {
      systemPrompt,
      historyMessages,
      contextData: {
        file_tree: fileTree,
        history_summary: historySummary,
        project_state: projectState,
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
