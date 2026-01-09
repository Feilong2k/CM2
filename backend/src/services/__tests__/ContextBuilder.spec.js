// ContextBuilder.spec.js — Redefined for 2-2-2 Contract

const ContextBuilder = require('../ContextBuilder');

describe('ContextBuilder (2-2-2 contract)', () => {
  let builder;
  let mockDatabaseTool;
  let mockFileSystemTool;
  let mockTraceStore;

  const buildStep = (overrides = {}) => ({
    id: 123,
    file_path: 'src/test.js',
    instructions: 'Write a test for function X',
    assigned_to: 'TaraAider',
    context_files: ['src/impl.js'],
    ...overrides,
  });

  beforeEach(() => {
    mockDatabaseTool = { get_step: jest.fn() };
    mockFileSystemTool = { file_exists: jest.fn() };
    mockTraceStore = { emit: jest.fn() };
    builder = new ContextBuilder({
      databaseTool: mockDatabaseTool,
      fileSystemTool: mockFileSystemTool,
      traceStore: mockTraceStore,
    });
  });

  describe('Success — TaraAider step', () => {
    it('returns correct structure and emits trace events', async () => {
      const step = buildStep();
      const stepId = 123;
      mockDatabaseTool.get_step.mockResolvedValue(step);
      mockFileSystemTool.file_exists.mockResolvedValue(true);

      const result = await builder.buildContext(stepId);

      expect(result).toEqual({
        targetFile: 'src/test.js',
        contextFiles: ['src/impl.js', 'backend/prompts/TaraPrompts.md'],
        instructions: 'Write a test for function X',
        agentType: 'TaraAider',
      });

      expect(mockTraceStore.emit).toHaveBeenCalledWith('context_build_started', { stepId });
      expect(mockTraceStore.emit).toHaveBeenCalledWith('context_build_completed', {
        stepId,
        targetFile: 'src/test.js',
        contextFileCount: 2,
        agentType: 'TaraAider',
      });
    });
  });

  describe('Success — DevonAider step', () => {
    it('returns correct structure and emits trace events', async () => {
      const step = buildStep({
        assigned_to: 'DevonAider',
        context_files: ['src/impl.js'],
      });
      const stepId = 456;
      mockDatabaseTool.get_step.mockResolvedValue(step);
      mockFileSystemTool.file_exists.mockResolvedValue(true);

      const result = await builder.buildContext(stepId);

      expect(result).toEqual({
        targetFile: 'src/test.js',
        contextFiles: ['src/impl.js', 'backend/prompts/DevonPrompts.md'],
        instructions: 'Write a test for function X',
        agentType: 'DevonAider',
      });

      expect(mockTraceStore.emit).toHaveBeenCalledWith('context_build_started', { stepId });
      expect(mockTraceStore.emit).toHaveBeenCalledWith('context_build_completed', {
        stepId,
        targetFile: 'src/test.js',
        contextFileCount: 2,
        agentType: 'DevonAider',
      });
    });
  });

  describe('Missing Step', () => {
    it('throws if step not found and does not emit started', async () => {
      const stepId = 999;
      mockDatabaseTool.get_step.mockResolvedValue(null);

      await expect(builder.buildContext(stepId))
        .rejects.toThrow('Step not found: 999');
      expect(mockTraceStore.emit).not.toHaveBeenCalledWith('context_build_started', expect.anything());
    });
  });

  describe('Missing Required Field(s)', () => {
    it('throws if file_path missing', async () => {
      const step = buildStep({ file_path: null });
      mockDatabaseTool.get_step.mockResolvedValue(step);
      await expect(builder.buildContext(step.id))
        .rejects.toThrow('Step missing required field: file_path');
    });
    it('throws if instructions missing', async () => {
      const step = buildStep({ instructions: null });
      mockDatabaseTool.get_step.mockResolvedValue(step);
      await expect(builder.buildContext(step.id))
        .rejects.toThrow('Step missing required field: instructions');
    });
    it('throws if assigned_to missing', async () => {
      const step = buildStep({ assigned_to: null });
      mockDatabaseTool.get_step.mockResolvedValue(step);
      await expect(builder.buildContext(step.id))
        .rejects.toThrow('Step missing required field: assigned_to');
    });
    it('throws if context_files missing', async () => {
      const step = buildStep({ context_files: null });
      mockDatabaseTool.get_step.mockResolvedValue(step);
      await expect(builder.buildContext(step.id))
        .rejects.toThrow('Step missing required field: context_files');
    });
  });

  describe('Invalid assigned_to value', () => {
    it('throws if assigned_to is not TaraAider or DevonAider', async () => {
      const step = buildStep({ assigned_to: 'Unknown' });
      mockDatabaseTool.get_step.mockResolvedValue(step);
      await expect(builder.buildContext(step.id))
        .rejects.toThrow('Invalid assigned_to value: Unknown. Must be TaraAider or DevonAider');
    });
  });

  describe('Missing file — must throw', () => {
    it('throws if any file does not exist and does not emit completed', async () => {
      const step = buildStep();
      mockDatabaseTool.get_step.mockResolvedValue(step);
      mockFileSystemTool.file_exists
        .mockResolvedValueOnce(true)  // target file
        .mockResolvedValueOnce(false); // context file

      await expect(builder.buildContext(step.id))
        .rejects.toThrow('Missing context file: src/impl.js');
      expect(mockTraceStore.emit).not.toHaveBeenCalledWith('context_build_completed', expect.anything());
    });
  });

  describe('Empty context_files array', () => {
    it('returns only agent prompt file in contextFiles', async () => {
      const step = buildStep({ context_files: [] });
      mockDatabaseTool.get_step.mockResolvedValue(step);
      mockFileSystemTool.file_exists.mockResolvedValue(true);

      const result = await builder.buildContext(step.id);

      expect(result.contextFiles).toEqual(['backend/prompts/TaraPrompts.md']);
      expect(mockFileSystemTool.file_exists).toHaveBeenCalledTimes(2); // target + agent prompt
    });
  });

  describe('File system error propagation', () => {
    it('propagates file system errors', async () => {
      const step = buildStep();
      const fsError = new Error('Permission denied');
      mockDatabaseTool.get_step.mockResolvedValue(step);
      mockFileSystemTool.file_exists.mockRejectedValue(fsError);

      await expect(builder.buildContext(step.id))
        .rejects.toThrow('Permission denied');
    });
  });
});