// OrionAgent.spec.js
// Unit tests for OrionAgent

const OrionAgent = require('../OrionAgent.js');

jest.mock('../../orchestration/ToolOrchestrator.js', () => {
  return jest.fn().mockImplementation(() => ({
    run: jest.fn(() => ({
      [Symbol.asyncIterator]: function* () {
        yield { type: 'final', content: 'done' };
      }
    }))
  }));
});
jest.mock('../../adapters/DS_ReasonerAdapter.js', () => {
  return jest.fn().mockImplementation(() => ({}));
});

const functionDefinitions = [
  {
    function: { name: 'FileSystemTool_read_file' }
  },
  {
    function: { name: 'DatabaseTool_get_subtask_full_context' }
  }
];

describe('OrionAgent', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should instantiate with valid toolRegistry', () => {
      const toolRegistry = { FileSystemTool: {} };
      expect(() => new OrionAgent({ toolRegistry })).not.toThrow();
    });

    it('should throw if toolRegistry is missing', () => {
      expect(() => new OrionAgent({})).toThrow();
    });

    it('should use default system prompt if none provided', () => {
      const toolRegistry = { FileSystemTool: {} };
      const agent = new OrionAgent({ toolRegistry });
      expect(typeof agent._getDefaultSystemPrompt()).toBe('string');
    });

    it('should accept custom system prompt', () => {
      const toolRegistry = { FileSystemTool: {} };
      const agent = new OrionAgent({ toolRegistry, systemPrompt: 'Custom prompt' });
      expect(agent.systemPrompt).toBe('Custom prompt');
    });
  });

  describe('Tool Registry Handling', () => {
    it('should filter functionDefinitions based on toolRegistry keys', () => {
      const toolRegistry = { FileSystemTool: {} };
      const agent = new OrionAgent({ toolRegistry });
      const filtered = agent._filterFunctionDefinitions(functionDefinitions);
      expect(filtered).toEqual([
        { function: { name: 'FileSystemTool_read_file' } }
      ]);
    });

    it('should handle empty registry gracefully', () => {
      const toolRegistry = {};
      const agent = new OrionAgent({ toolRegistry });
      const filtered = agent._filterFunctionDefinitions(functionDefinitions);
      expect(filtered).toEqual([]);
    });
  });

  describe('Orchestration Delegation', () => {
    it('should call orchestrator.run with correct messages and tools', async () => {
      const toolRegistry = { FileSystemTool: {} };
      const agent = new OrionAgent({ toolRegistry });
      const messages = ['user message'];
      const tools = [{ function: { name: 'FileSystemTool_read_file' } }];
      agent._filterFunctionDefinitions = jest.fn(() => tools);

      const stream = agent.processTaskStreaming('user message');
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }
      expect(events).toContainEqual({ type: 'final', content: 'done' });
    });
  });

  describe('Default Prompt', () => {
    it('should return a string containing key instructions', () => {
      const toolRegistry = { FileSystemTool: {} };
      const agent = new OrionAgent({ toolRegistry });
      const prompt = agent._getDefaultSystemPrompt();
      expect(prompt).toMatch(/natural conversations/i);
      expect(prompt).toMatch(/filesystem tools/i);
    });
  });
});
