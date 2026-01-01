const { DS_ReasonerAdapter } = require('../../adapters/DS_ReasonerAdapter');
const ToolOrchestrator = require('../../orchestration/ToolOrchestrator');

// Mock the dependencies
jest.mock('../../adapters/DS_ReasonerAdapter');
jest.mock('../../orchestration/ToolOrchestrator');
// Mock functionDefinitions as an array with a parseFunctionCall property
jest.mock('../../../tools/functionDefinitions', () => {
  const mockFunctionDefinitions = [
    { function: { name: 'FileSystemTool_read_file' } },
    { function: { name: 'DatabaseTool_safe_query' } },
  ];
  mockFunctionDefinitions.parseFunctionCall = jest.fn();
  return mockFunctionDefinitions;
});

// Mock the ContextService
jest.mock('../../services/ContextService');

const ContextService = require('../../services/ContextService');
const OrionAgent = require('../OrionAgent');

describe('OrionAgent with Context Integration', () => {
  let mockContextService;
  let mockAdapter;
  let mockOrchestrator;
  const mockToolRegistry = {
    FileSystemTool: {},
    DatabaseTool: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up mock ContextService
    mockContextService = {
      buildContext: jest.fn(),
    };
    ContextService.mockImplementation(() => mockContextService);

    // Set up mock Adapter
    mockAdapter = {
      // The adapter is mocked by DS_ReasonerAdapter mock, we'll set up a mock instance
    };
    DS_ReasonerAdapter.mockImplementation(() => mockAdapter);

    // Set up mock Orchestrator
    mockOrchestrator = {
      run: jest.fn(async function* () {
        yield { type: 'chunk', content: 'test' };
        yield { type: 'final', content: 'done' };
      }),
    };
    ToolOrchestrator.mockImplementation(() => mockOrchestrator);
  });

  describe('Test 1: Dynamic Context Integration', () => {
    it('should use ContextService to generate dynamic system prompt when projectId is provided', async () => {
      const projectId = 'P1';
      const rootPath = process.cwd(); // Use current directory as example

      const dynamicSystemPrompt = 'Dynamic system prompt with file tree and history.';
      const contextData = {
        file_tree: 'src/index.js',
        history_summary: 'Last 5 messages',
        project_state: 'Active',
      };
      mockContextService.buildContext.mockResolvedValue({
        systemPrompt: dynamicSystemPrompt,
        historyMessages: [],
        contextData,
      });

      // Instantiate agent with contextService and projectId
      const agent = new OrionAgent({
        toolRegistry: mockToolRegistry,
        contextService: mockContextService,
        projectId,
        rootPath,
      });

      // Call processTaskStreaming
      const userMessage = 'What is the status?';
      const iterator = agent.processTaskStreaming(userMessage);
      const events = [];
      for await (const event of iterator) {
        events.push(event);
      }

      // Verify ContextService was called with correct arguments
      expect(mockContextService.buildContext).toHaveBeenCalledWith(projectId, rootPath);

      // Verify that the orchestrator was called with a messages array that includes the dynamic system prompt
      expect(ToolOrchestrator).toHaveBeenCalled();
      // The agent should have used the dynamic system prompt as the first message
      // We can check the call to the orchestrator's run method.
      // The orchestrator's run is called with the messages array and tools.
      const orchestratorRunCall = mockOrchestrator.run.mock.calls[0];
      expect(orchestratorRunCall).toBeDefined();
      const messages = orchestratorRunCall[0];
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'system', content: dynamicSystemPrompt });
      expect(messages[1]).toEqual({ role: 'user', content: userMessage });
    });
  });

  describe('Test 2: Fallback behavior', () => {
    it('should use default system prompt when projectId is not provided', async () => {
      // No projectId, no contextService? We'll assume the agent can be instantiated without contextService.
      // According to the spec, we want backward compatibility: if projectId is missing, use default static prompt.
      // We'll create an agent without contextService and without projectId.
      const agent = new OrionAgent({
        toolRegistry: mockToolRegistry,
        // no contextService, no projectId
      });

      // The agent should have a default system prompt (from _getDefaultSystemPrompt)
      const defaultPrompt = agent.systemPrompt;

      // Call processTaskStreaming
      const userMessage = 'Hello';
      const iterator = agent.processTaskStreaming(userMessage);
      const events = [];
      for await (const event of iterator) {
        events.push(event);
      }

      // The orchestrator should have been called with the default system prompt
      const orchestratorRunCall = mockOrchestrator.run.mock.calls[0];
      expect(orchestratorRunCall).toBeDefined();
      const messages = orchestratorRunCall[0];
      expect(messages[0].content).toBe(defaultPrompt);
      expect(messages[0].role).toBe('system');
      expect(messages[1]).toEqual({ role: 'user', content: userMessage });

      // ContextService.buildContext should NOT have been called
      expect(mockContextService.buildContext).not.toHaveBeenCalled();
    });
  });
});
