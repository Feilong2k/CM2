/**
 * REAL integration test for StepDecomposer + ContextBuilder using real DB and filesystem.
 * This test verifies that the two services work together in a live environment.
 */

const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Real tools (no mocks)
const DatabaseTool = require('../../../tools/DatabaseTool');
const FileSystemTool = require('../../../tools/FileSystemTool');
const TraceStoreService = require('../TraceStoreService');
const StepDecomposer = require('../StepDecomposer');
const ContextBuilder = require('../ContextBuilder');

// DB connection for direct queries (cleanup)
const { query, closePool } = require('../../db/connection');

describe('StepDecomposer + ContextBuilder real integration (live DB + filesystem)', () => {
  // Configuration
  const PROJECT_ID = 'P1';
  const TASK_EXTERNAL_ID = 'P1-F2-T1'; // From test data setup
  let SUBTASK_EXTERNAL_ID; // Will be set per test run
  let subtaskId; // integer id of the subtask
  let TEMP_DIR;
  let TARGET_FILE;
  let CONTEXT_FILE;

  // Service instances with real tools
  let databaseTool;
  let fileSystemTool;
  let traceStore;
  let decomposer;
  let builder;

  beforeAll(async () => {
    // Ensure test database has Feature2 data
    const { setupFeature2TestData } = require('../../../scripts/probes/tdd/setup_feature2_test_data');
    await setupFeature2TestData();

    // Create a unique subtask for this test run
    const timestamp = Date.now();
    SUBTASK_EXTERNAL_ID = `P1-F2-T1-S1-REAL-INTEGRATION-${timestamp}`;

    // Insert the subtask into the database
    const taskResult = await query(
      `SELECT id FROM tasks WHERE external_id = $1`,
      [TASK_EXTERNAL_ID]
    );
    if (taskResult.rows.length === 0) {
      throw new Error(`Task ${TASK_EXTERNAL_ID} not found. Cannot run test.`);
    }
    const taskId = taskResult.rows[0].id;

    // Insert subtask and get its integer id
    const subtaskResult = await query(
      `INSERT INTO subtasks (external_id, title, status, task_id, basic_info, instruction, order_index, workflow_stage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        SUBTASK_EXTERNAL_ID,
        'Real Integration Test Subtask',
        'pending',
        taskId,
        JSON.stringify({}),
        JSON.stringify({}),
        0,
        'planning'
      ]
    );
    subtaskId = subtaskResult.rows[0].id;
    console.log(`Created test subtask ${SUBTASK_EXTERNAL_ID} with id ${subtaskId}`);

    // Create temporary directory for test files
    TEMP_DIR = path.join(__dirname, '..', '..', '..', 'tests', 'tmp', `real-integration-${timestamp}`);
    await fs.mkdir(TEMP_DIR, { recursive: true });

    // Create a target file and a context file
    TARGET_FILE = path.join(TEMP_DIR, 'src', 'test_impl.js');
    CONTEXT_FILE = path.join(TEMP_DIR, 'tests', 'test_impl.spec.js');
    await fs.mkdir(path.dirname(TARGET_FILE), { recursive: true });
    await fs.mkdir(path.dirname(CONTEXT_FILE), { recursive: true });

    await fs.writeFile(TARGET_FILE, '// Target file content\nconsole.log("Hello");');
    await fs.writeFile(CONTEXT_FILE, '// Context file content\ndescribe("Test", () => {});');

    // Initialize real tools
    databaseTool = DatabaseTool;
    fileSystemTool = FileSystemTool;
    traceStore = new TraceStoreService({ projectId: PROJECT_ID });

    decomposer = new StepDecomposer({
      databaseTool,
      fileSystemTool,
      traceStore,
      projectId: PROJECT_ID,
    });

    builder = new ContextBuilder({
      databaseTool,
      fileSystemTool,
      traceStore,
      projectId: PROJECT_ID,
    });
  });

  afterAll(async () => {
    // Clean up database - use integer subtaskId for steps deletion
    const stepsResult = await query(
      `DELETE FROM steps WHERE subtask_id = $1 RETURNING id`,
      [subtaskId]
    );
    console.log(`Cleaned up ${stepsResult.rowCount} steps for subtask ${subtaskId}`);

    await query(
      `DELETE FROM subtasks WHERE external_id = $1`,
      [SUBTASK_EXTERNAL_ID]
    );
    console.log(`Deleted test subtask ${SUBTASK_EXTERNAL_ID}`);

    // Clean up temporary directory
    try {
      await fs.rm(TEMP_DIR, { recursive: true, force: true });
      console.log(`Cleaned up temp directory ${TEMP_DIR}`);
    } catch (err) {
      console.warn(`Failed to clean up temp directory: ${err.message}`);
    }

    // Close DB pool (optional, but good for cleanup)
    await closePool();
  });

  it('should decompose a step and then build context with real DB and filesystem', async () => {
    // 1. Prepare decomposition JSON
    const decompositionJson = {
      steps: [
        {
          step_number: 1,
          step_type: 'implementation',
          file_path: TARGET_FILE,
          instructions: 'Implement the feature described in the test file',
          assigned_to: 'DevonAider',
          context_files: [CONTEXT_FILE],
        },
      ],
    };

    // 2. Decompose using integer subtaskId
    const decompositionResult = await decomposer.decompose(subtaskId, decompositionJson);
    expect(decompositionResult).toEqual({
      success: true,
      stepIds: expect.arrayContaining([expect.any(Number)]),
    });
    const stepId = decompositionResult.stepIds[0];

    // 3. Verify step exists in database
    const stepRow = await databaseTool.get_step(stepId);
    expect(stepRow).toBeTruthy();
    expect(stepRow.file_path).toBe(TARGET_FILE);
    expect(stepRow.subtask_id).toBe(subtaskId);
    expect(stepRow.instructions).toBe('Implement the feature described in the test file');
    expect(stepRow.assigned_to).toBe('DevonAider');
    expect(stepRow.context_files).toEqual([CONTEXT_FILE]);

    // 4. Build context
    const contextResult = await builder.buildContext(stepId);
    expect(contextResult).toEqual({
      targetFile: TARGET_FILE,
      contextFiles: expect.arrayContaining([
        CONTEXT_FILE,
        'backend/prompts/DevonPrompts.md',
      ]),
      instructions: 'Implement the feature described in the test file',
      agentType: 'DevonAider',
    });
    expect(contextResult.contextFiles).toHaveLength(2);

    // 5. Verify trace events (optional, but we can check that they were emitted)
    // Since we're using real TraceStore, we can't easily assert without a mock.
    // We'll rely on the service's internal logging and assume it works.
  });

  it('should handle missing file errors in real environment', async () => {
    const decompositionJson = {
      steps: [
        {
          step_number: 1,
          step_type: 'implementation',
          file_path: path.join(TEMP_DIR, 'non_existent.js'),
          instructions: 'Some instructions',
          assigned_to: 'TaraAider',
          context_files: [],
        },
      ],
    };

    await expect(decomposer.decompose(subtaskId, decompositionJson))
      .rejects.toThrow(/Missing context file/);
  });
});
