// StepDecomposer_ContextBuilder.integration.spec.js — Integration test for 2-2-5 using mocks

const StepDecomposer = require('../StepDecomposer');
const ContextBuilder = require('../ContextBuilder');

describe('StepDecomposer + ContextBuilder integration (mocked)', () => {
  let decomposer;
  let builder;
  let mockDatabaseTool;
  let mockFileSystemTool;
  let mockTraceStore;

  // Test configuration
  const projectId = 1;
  const subtaskId = 100;
  const stepId = 42;
  const targetFile = 'src/test_impl.js';
  const contextFile = 'tests/test_impl.spec.js';

  beforeEach(() => {
    // Mock dependencies
    mockDatabaseTool = {
      create_step: jest.fn(),
      get_step: jest.fn(),
      query: jest.fn()
    };
    mockFileSystemTool = {
      file_exists: jest.fn()
    };
    mockTraceStore = {
      emit: jest.fn()
    };

    // Create instances with mocked dependencies
    decomposer = new StepDecomposer({
      databaseTool: mockDatabaseTool,
      fileSystemTool: mockFileSystemTool,
      traceStore: mockTraceStore,
      projectId,
    });

    builder = new ContextBuilder({
      databaseTool: mockDatabaseTool,
      fileSystemTool: mockFileSystemTool,
      traceStore: mockTraceStore,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('StepDecomposer + ContextBuilder work together', async () => {
    // 1. Arrange: create a simple decomposition JSON
    const decompositionJson = {
      steps: [
        {
          step_number: 1,
          step_type: 'implementation',
          file_path: targetFile,
          instructions: 'Implement the feature described in the test file',
          assigned_to: 'DevonAider',
          context_files: [contextFile],
        },
      ],
    };

    // Mock StepDecomposer dependencies
    mockFileSystemTool.file_exists.mockResolvedValue(true);
    mockDatabaseTool.create_step.mockResolvedValue({ id: stepId });

    // 2. Call StepDecomposer.decompose
    const decompositionResult = await decomposer.decompose(subtaskId, decompositionJson);
    
    expect(decompositionResult).toEqual({
      success: true,
      stepIds: [stepId],
    });

    // Verify StepDecomposer interactions
    expect(mockFileSystemTool.file_exists).toHaveBeenCalledWith(targetFile);
    expect(mockFileSystemTool.file_exists).toHaveBeenCalledWith(contextFile);
    expect(mockDatabaseTool.create_step).toHaveBeenCalledWith({
      project_id: projectId,
      subtask_id: subtaskId,
      step_number: 1,
      step_type: 'implementation',
      file_path: targetFile,
      instructions: 'Implement the feature described in the test file',
      assigned_to: 'DevonAider',
      context_files: [contextFile],
    });

    // 3. Mock ContextBuilder dependencies
    mockDatabaseTool.get_step.mockResolvedValue({
      id: stepId,
      project_id: projectId,
      subtask_id: subtaskId,
      step_number: 1,
      step_type: 'implementation',
      file_path: targetFile,
      instructions: 'Implement the feature described in the test file',
      assigned_to: 'DevonAider',
      context_files: [contextFile],
    });

    // Mock file existence for all files (targetFile, contextFile, agentPromptFile)
    mockFileSystemTool.file_exists.mockResolvedValue(true);

    // 4. Call ContextBuilder.buildContext
    const contextResult = await builder.buildContext(stepId);

    // 5. Verify ContextBuilder results
    expect(contextResult).toEqual({
      targetFile: targetFile,
      contextFiles: expect.arrayContaining([
        contextFile,
        'backend/prompts/DevonPrompts.md',
      ]),
      instructions: 'Implement the feature described in the test file',
      agentType: 'DevonAider',
    });

    // Ensure the array has exactly 2 items (context file + agent prompt)
    expect(contextResult.contextFiles.length).toBe(2);

    // Verify ContextBuilder interactions
    expect(mockDatabaseTool.get_step).toHaveBeenCalledWith(stepId);
    expect(mockFileSystemTool.file_exists).toHaveBeenCalledWith(targetFile);
    expect(mockFileSystemTool.file_exists).toHaveBeenCalledWith(contextFile);
    expect(mockFileSystemTool.file_exists).toHaveBeenCalledWith('backend/prompts/DevonPrompts.md');
  });

  it('handles missing files gracefully', async () => {
    const decompositionJson = {
      steps: [
        {
          step_number: 1,
          step_type: 'implementation',
          file_path: targetFile,
          instructions: 'Test instructions',
          assigned_to: 'DevonAider',
          context_files: [contextFile],
        },
      ],
    };

    // Mock missing file
    mockFileSystemTool.file_exists.mockResolvedValue(false);

    await expect(decomposer.decompose(subtaskId, decompositionJson))
      .rejects.toThrow(`Missing context file: ${targetFile}`);

    // Verify no database write occurred
    expect(mockDatabaseTool.create_step).not.toHaveBeenCalled();
  });

  it('handles database errors gracefully', async () => {
    const decompositionJson = {
      steps: [
        {
          step_number: 1,
          step_type: 'implementation',
          file_path: targetFile,
          instructions: 'Test instructions',
          assigned_to: 'DevonAider',
          context_files: [contextFile],
        },
      ],
    };

    mockFileSystemTool.file_exists.mockResolvedValue(true);
    mockDatabaseTool.create_step.mockRejectedValue(new Error('Database error'));

    await expect(decomposer.decompose(subtaskId, decompositionJson))
      .rejects.toThrow('Database error');

    // Verify error was logged
    expect(mockTraceStore.emit).toHaveBeenCalledWith(
      'step_decomposition_failed',
      expect.objectContaining({
        subtaskId,
        error: expect.stringContaining('Database error')
      })
    );
  });
});
