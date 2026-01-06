/**
 * OrionAgent Skills Prompt Integration Tests
 *
 * Objective:
 * Verify Orion's system prompt includes available skills when built via ContextService.
 *
 * Notes:
 * - These tests are intentionally written to fail initially (RED) until OrionAgent passes
 *   `{ includeSkills: true }` into ContextService.buildContext(...).
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

const SkillLoaderService = require('../../services/SkillLoaderService');

// Mock the dependencies that would otherwise call real LLMs / run orchestration.
// Use factory functions for named exports.
// Use global to share mock instance across Jest's module boundary
const mockState = { orchestratorInstance: null };

jest.mock('../../adapters/DS_ReasonerAdapter', () => ({
  DS_ReasonerAdapter: jest.fn(() => ({})),
  ContextLimitError: class extends Error {},
}));

jest.mock('../../orchestration/ToolOrchestrator', () => {
  return jest.fn().mockImplementation(() => {
    mockState.orchestratorInstance = {
      run: jest.fn(async function* () {
        yield { type: 'final', content: 'done' };
      }),
    };
    return mockState.orchestratorInstance;
  });
});

// Mock functionDefinitions as an array with a parseFunctionCall property (pattern used elsewhere).
jest.mock('../../../tools/functionDefinitions', () => {
  const mockFunctionDefinitions = [
    { function: { name: 'FileSystemTool_read_file' } },
    { function: { name: 'DatabaseTool_safe_query' } },
    { function: { name: 'SkillTool_execute' } },
  ];
  mockFunctionDefinitions.parseFunctionCall = jest.fn();
  return mockFunctionDefinitions;
});

const OrionAgent = require('../OrionAgent');

describe('OrionAgent skills prompt injection', () => {
  const mockToolRegistry = {
    FileSystemTool: {},
    DatabaseTool: {},
    SkillTool: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // mockState.orchestratorInstanceInstance is set by the ToolOrchestrator mock factory
  });

  function createContextServiceBackedBySkillLoader({ skillLoader } = {}) {
    const loader = skillLoader || new SkillLoaderService();

    return {
      buildContext: jest.fn(async (_projectId, _rootPath, options = {}) => {
        // ContextService defaults includeSkills=false.
        // We mimic that behavior here so tests fail until OrionAgent passes includeSkills:true.
        const includeSkills = Boolean(options.includeSkills);
        const skillsSection = includeSkills ? loader.generateSkillsPromptSection() : '';
        const systemPrompt = `Dynamic system prompt.\n\n${skillsSection}`;
        return {
          systemPrompt,
          historyMessages: [],
          contextData: { skills_section: skillsSection },
        };
      }),
    };
  }

  it('should include skills section in system prompt when contextService is used', async () => {
    const projectId = 'P1';
    const rootPath = process.cwd();

    const contextService = createContextServiceBackedBySkillLoader();

    const agent = new OrionAgent({
      toolRegistry: mockToolRegistry,
      contextService,
      projectId,
      rootPath,
    });

    const iterator = agent.processTaskStreaming('hello');
    for await (const _evt of iterator) {
      // Drain iterator
    }

    // Expect OrionAgent to request skills injection when using ContextService.
    expect(contextService.buildContext).toHaveBeenCalledWith(
      projectId,
      rootPath,
      expect.objectContaining({ includeSkills: true })
    );

    const orchestratorRunCall = mockState.orchestratorInstance.run.mock.calls[0];
    const messages = orchestratorRunCall[0];
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('Available Skills');
    expect(messages[0].content).toContain('skill-creator');
  });

  it('should include skill-creator, CAP, and RED in skills section', async () => {
    const projectId = 'P1';
    const rootPath = process.cwd();

    const contextService = createContextServiceBackedBySkillLoader();

    const agent = new OrionAgent({
      toolRegistry: mockToolRegistry,
      contextService,
      projectId,
      rootPath,
    });

    const iterator = agent.processTaskStreaming('hello');
    for await (const _evt of iterator) {
      // Drain iterator
    }

    const orchestratorRunCall = mockState.orchestratorInstance.run.mock.calls[0];
    const messages = orchestratorRunCall[0];
    const systemPrompt = messages[0].content;

    // Expect the skill summaries (names) to be present.
    expect(systemPrompt).toContain('skill-creator');
    expect(systemPrompt).toContain('Planning using CAP');
    expect(systemPrompt).toContain('RED');
  });

  it('should show skill summaries, not full protocol bodies', async () => {
    const projectId = 'P1';
    const rootPath = process.cwd();
    const contextService = createContextServiceBackedBySkillLoader();

    const agent = new OrionAgent({
      toolRegistry: mockToolRegistry,
      contextService,
      projectId,
      rootPath,
    });

    const iterator = agent.processTaskStreaming('hello');
    for await (const _evt of iterator) {
      // Drain iterator
    }

    const orchestratorRunCall = mockState.orchestratorInstance.run.mock.calls[0];
    const messages = orchestratorRunCall[0];
    const systemPrompt = messages[0].content;

    // Ensure the skills section exists...
    expect(systemPrompt).toContain('Available Skills');

    // ...but does not include full step-by-step bodies.
    expect(systemPrompt).not.toContain('The 7-Step CAP Protocol');
    expect(systemPrompt).not.toContain('Step 1:');
  });

  it('should handle empty skills directory gracefully', async () => {
    // Create an empty temporary skills directory.
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'cm2-empty-skills-'));
    const emptySkillLoader = new SkillLoaderService(tmpBase);

    const projectId = 'P1';
    const rootPath = process.cwd();
    const contextService = createContextServiceBackedBySkillLoader({
      skillLoader: emptySkillLoader,
    });

    const agent = new OrionAgent({
      toolRegistry: mockToolRegistry,
      contextService,
      projectId,
      rootPath,
    });

    const iterator = agent.processTaskStreaming('hello');
    for await (const _evt of iterator) {
      // Drain iterator
    }

    // Still expect OrionAgent to request skills injection when using ContextService.
    expect(contextService.buildContext).toHaveBeenCalledWith(
      projectId,
      rootPath,
      expect.objectContaining({ includeSkills: true })
    );

    const orchestratorRunCall = mockState.orchestratorInstance.run.mock.calls[0];
    const messages = orchestratorRunCall[0];
    const systemPrompt = messages[0].content;

    // Should not break prompt build; skills section should be absent/empty.
    expect(systemPrompt).toContain('Dynamic system prompt.');
    expect(systemPrompt).not.toContain('Available Skills');
  });
});

