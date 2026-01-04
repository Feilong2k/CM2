const fs = require('fs').promises;
const path = require('path');

/**
 * Execute a write plan with multiple file operations.
 * @param {Object} plan - The write plan object.
 * @param {string} [plan.intent] - Optional intent description.
 * @param {Array} plan.operations - List of file operations.
 * @param {string} plan.operations[].type - 'create', 'append', or 'overwrite'.
 * @param {string} plan.operations[].target_file - Path to the file (relative to cwd).
 * @param {string} plan.operations[].content - Content to write.
 * @returns {Promise<Object>} Report with results for each operation.
 */
async function executeWritePlan(plan) {
  // Validate plan structure
  if (!plan || typeof plan !== 'object') {
    throw new Error('WritePlanTool: plan must be an object');
  }
  if (!Array.isArray(plan.operations) || plan.operations.length === 0) {
    throw new Error('WritePlanTool: plan.operations must be a non-empty array');
  }

  const results = [];
  for (let i = 0; i < plan.operations.length; i++) {
    const op = plan.operations[i];

    // Validate operation
    if (!op.type || !['create', 'append', 'overwrite'].includes(op.type)) {
      results.push({
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        error: { code: 'INVALID_OPERATION', message: `Invalid operation type: ${op.type}` }
      });
      // Stop on first error
      break;
    }
    if (!op.target_file || typeof op.target_file !== 'string') {
      results.push({
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        error: { code: 'INVALID_TARGET', message: 'target_file must be a non-empty string' }
      });
      break;
    }
    if (typeof op.content !== 'string') {
      results.push({
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        error: { code: 'INVALID_CONTENT', message: 'content must be a string' }
      });
      break;
    }

    const targetPath = path.resolve(process.cwd(), op.target_file);

    // Ensure parent directory exists
    try {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
    } catch (mkdirErr) {
      results.push({
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        error: { code: 'DIR_CREATE_FAILED', message: `Failed to create parent directory: ${mkdirErr.message}` }
      });
      break;
    }

    try {
      // Check file existence for validation
      const fileExists = await fs.access(targetPath).then(() => true).catch(() => false);

      if (op.type === 'create') {
        if (fileExists) {
          throw new Error(`File already exists: ${op.target_file}`);
        }
        await fs.writeFile(targetPath, op.content, 'utf8');
      } else if (op.type === 'append') {
        if (!fileExists) {
          throw new Error(`File does not exist: ${op.target_file}`);
        }
        await fs.appendFile(targetPath, op.content, 'utf8');
      } else if (op.type === 'overwrite') {
        if (!fileExists) {
          throw new Error(`File does not exist: ${op.target_file}`);
        }
        await fs.writeFile(targetPath, op.content, 'utf8');
      }

      results.push({
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'success',
        error: null
      });
    } catch (error) {
      results.push({
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        error: { code: 'EXECUTION_FAILED', message: error.message }
      });
      break;
    }
  }

  return {
    intent: plan.intent || null,
    results
  };
}

/**
 * Execute a single file operation (compatibility with existing tests).
 * @param {Object} operation - Single operation object.
 * @param {string} operation.operation - 'create', 'append', or 'overwrite'.
 * @param {string} operation.path - Path to the file.
 * @param {string} operation.content - Content to write.
 * @param {boolean} [operation.validate_existence=true] - Whether to validate file existence.
 * @returns {Promise<void>}
 * @throws {Error} If operation fails.
 */
async function execute(operation) {
  // Convert single operation to a plan
  const plan = {
    operations: [{
      type: operation.operation,
      target_file: operation.path,
      content: operation.content
    }]
  };
  const result = await executeWritePlan(plan);
  const opResult = result.results[0];
  if (opResult.status === 'error') {
    throw new Error(opResult.error.message);
  }
}

module.exports = {
  executeWritePlan,
  execute
};
