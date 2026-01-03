jest.mock('../FileTreeContextBuilder');
jest.mock('../PromptTemplateService');
jest.mock('../HistoryLoaderService');
jest.mock('../SkillLoaderService');

const FileTreeContextBuilder = require('../FileTreeContextBuilder');
const PromptTemplateService = require('../PromptTemplateService');
const HistoryLoaderService = require('../HistoryLoaderService');
const SkillLoaderService = require('../SkillLoaderService');
const ContextService = require('../ContextService');

describe('ContextService', () => {
  let contextService;
  const mockFileTreeBuilder = {
    buildTree: jest.fn(),
  };
  const mockPromptTemplateService = {
    loadTemplate: jest.fn(),
  };
  const mockHistoryLoaderService = {
    loadRecentChatHistory: jest.fn(),
  };
  const mockSkillLoader = {
    generateSkillsPromptSection: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mocks to return default values
    FileTreeContextBuilder.mockImplementation(() => mockFileTreeBuilder);
    PromptTemplateService.mockImplementation(() => mockPromptTemplateService);
    HistoryLoaderService.mockImplementation(() => mockHistoryLoaderService);
    SkillLoaderService.mockImplementation(() => mockSkillLoader);

    contextService = new ContextService();
  });

  describe('Test 1: Full Integration Flow (Baseline)', () => {
    it('should orchestrate sub-services to build context and system prompt without skills when includeSkills is false', async () => {
      const projectId = 'P1';
      const rootPath = '/mock/root';

      // Mock return values
      const mockFileTree = 'src/index.js\nsrc/utils/helper.js';
      const mockHistory = [
        { sender: 'user', content: 'Hello' },
        { sender: 'orion', content: 'Hi there' },
      ];
      const mockSystemPrompt = 'Filled template with file tree and history';

      mockFileTreeBuilder.buildTree.mockResolvedValue(mockFileTree);
      mockHistoryLoaderService.loadRecentChatHistory.mockResolvedValue(mockHistory);
      mockPromptTemplateService.loadTemplate.mockReturnValue(mockSystemPrompt);

      // Call the method without options (includeSkills defaults to false)
      const result = await contextService.buildContext(projectId, rootPath);

      // Verify the calls
      expect(mockFileTreeBuilder.buildTree).toHaveBeenCalledWith(rootPath, {
        maxDepth: 2,
        maxLines: 50,
      });
      expect(mockHistoryLoaderService.loadRecentChatHistory).toHaveBeenCalledWith({
        projectId,
        limit: 20,
      });
      // SkillLoader should not be called
      expect(mockSkillLoader.generateSkillsPromptSection).not.toHaveBeenCalled();

      // Check that the prompt template service was called with the correct context.
      const templateCall = mockPromptTemplateService.loadTemplate.mock.calls[0];
      expect(templateCall[0]).toBe('orion_system.md');
      const context = templateCall[1];
      expect(context.file_tree).toBe(mockFileTree);
      expect(typeof context.history_summary).toBe('string');
      expect(context.project_state).toBe('Active');
      // skills_section should be empty string
      expect(context.skills_section).toBe('');

      // Verify the result structure
      expect(result).toEqual({
        systemPrompt: mockSystemPrompt,
        historyMessages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
        contextData: {
          file_tree: mockFileTree,
          history_summary: context.history_summary,
          project_state: 'Active',
          skills_section: '',
        },
      });
    });
  });

  describe('Test 2: Discovery/Compliance Phase with Skills', () => {
    it('should include skills section from SkillLoaderService when includeSkills is true', async () => {
      const projectId = 'P1';
      const rootPath = '/mock/root';

      // Mock return values
      const mockFileTree = 'src/index.js\nsrc/utils/helper.js';
      const mockHistory = [
        { sender: 'user', content: 'Hello' },
        { sender: 'orion', content: 'Hi there' },
      ];
      const mockSystemPrompt = 'Filled template with file tree and history';
      const mockSkillsSummary = [
        '- **CAP** – Constraint-Aware Planning skill for analyzing and planning technical implementations',
        '- **RED** – Requirement Extraction and Decomposition skill for analyzing ambiguous requirements',
      ].join('\n');

      mockFileTreeBuilder.buildTree.mockResolvedValue(mockFileTree);
      mockHistoryLoaderService.loadRecentChatHistory.mockResolvedValue(mockHistory);
      mockPromptTemplateService.loadTemplate.mockReturnValue(mockSystemPrompt);
      mockSkillLoader.generateSkillsPromptSection.mockReturnValue(mockSkillsSummary);

      // Call the method with includeSkills: true
      const result = await contextService.buildContext(projectId, rootPath, { includeSkills: true });

      // Verify the calls
      expect(mockFileTreeBuilder.buildTree).toHaveBeenCalledWith(rootPath, {
        maxDepth: 2,
        maxLines: 50,
      });
      expect(mockHistoryLoaderService.loadRecentChatHistory).toHaveBeenCalledWith({
        projectId,
        limit: 20,
      });
      // SkillLoader should be called with no arguments (default production behavior)
      expect(mockSkillLoader.generateSkillsPromptSection).toHaveBeenCalledWith(null);

      // Check that the prompt template service was called with the correct context.
      const templateCall = mockPromptTemplateService.loadTemplate.mock.calls[0];
      expect(templateCall[0]).toBe('orion_system.md');
      const context = templateCall[1];
      expect(context.file_tree).toBe(mockFileTree);
      expect(typeof context.history_summary).toBe('string');
      expect(context.project_state).toBe('Active');
      expect(context.skills_section).toBe(mockSkillsSummary);

      // Verify the result structure
      expect(result).toEqual({
        systemPrompt: mockSystemPrompt,
        historyMessages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
        contextData: {
          file_tree: mockFileTree,
          history_summary: context.history_summary,
          project_state: 'Active',
          skills_section: mockSkillsSummary,
        },
      });
    });
  });

  describe('Test 3: Error Handling', () => {
    it('should fail loud when FileTreeContextBuilder throws', async () => {
      const projectId = 'P1';
      const rootPath = '/mock/root';
      const mockError = new Error('Failed to build tree');

      mockFileTreeBuilder.buildTree.mockRejectedValue(mockError);

      await expect(contextService.buildContext(projectId, rootPath)).rejects.toThrow(mockError);

      // Ensure that if the file tree fails, we don't proceed to load history or template.
      expect(mockHistoryLoaderService.loadRecentChatHistory).not.toHaveBeenCalled();
      expect(mockPromptTemplateService.loadTemplate).not.toHaveBeenCalled();
      expect(mockSkillLoader.generateSkillsPromptSection).not.toHaveBeenCalled();
    });

    it('should fail loud when HistoryLoaderService throws', async () => {
      const projectId = 'P1';
      const rootPath = '/mock/root';
      const mockError = new Error('Failed to load history');

      mockFileTreeBuilder.buildTree.mockResolvedValue('some tree');
      mockHistoryLoaderService.loadRecentChatHistory.mockRejectedValue(mockError);

      await expect(contextService.buildContext(projectId, rootPath)).rejects.toThrow(mockError);

      // The file tree succeeded, but history failed, so we should not call the template or skill loader.
      expect(mockPromptTemplateService.loadTemplate).not.toHaveBeenCalled();
      expect(mockSkillLoader.generateSkillsPromptSection).not.toHaveBeenCalled();
    });
  });
});
