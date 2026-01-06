const fs = require('fs').promises;
const path = require('path');
const TraceStoreService = require('../src/services/TraceStoreService');
const WritePlanTraceLogger = require('../src/services/WritePlanTraceLogger');
const ContentValidationHelper = require('../src/utils/ContentValidationHelper');

// In‑memory session store (static across instances)
const sessions = new Map();

const trace = async (event) => {
  // 1) File-based trace
  if (WritePlanTraceLogger && typeof WritePlanTraceLogger.log === 'function') {
    await WritePlanTraceLogger.log(event);
  }
  // 2) Tara’s tests: static TraceStoreService.insertTraceEvent is mocked there
  if (TraceStoreService && typeof TraceStoreService.insertTraceEvent === 'function') {
    await TraceStoreService.insertTraceEvent(event);
  }
};

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

  // Trace: write_plan_received
  await trace({
    kind: 'write_plan_received',
    intent: plan.intent || null,
    operation_count: plan.operations.length,
    target_files: plan.operations.map(op => op.target_file || op.path)
  });

  const results = [];
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < plan.operations.length; i++) {
    const op = plan.operations[i];

    // Validate operation
    if (!op.type || !['create', 'append', 'overwrite'].includes(op.type)) {
      const errorObj = {
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        error: { code: 'INVALID_OPERATION', message: `Invalid operation type: ${op.type}` }
      };
      results.push(errorObj);
      errorCount++;
      errors.push({ operation_index: i, code: 'INVALID_OPERATION', message: `Invalid operation type: ${op.type}` });
      await trace({
        kind: 'write_plan_op',
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        validation: {},
        error: { code: 'INVALID_OPERATION', message: `Invalid operation type: ${op.type}` }
      });
      break;
    }
    if (!op.target_file || typeof op.target_file !== 'string') {
      const errorObj = {
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        error: { code: 'INVALID_TARGET', message: 'target_file must be a non-empty string' }
      };
      results.push(errorObj);
      errorCount++;
      errors.push({ operation_index: i, code: 'INVALID_TARGET', message: 'target_file must be a non-empty string' });
      await trace({
        kind: 'write_plan_op',
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        validation: {},
        error: { code: 'INVALID_TARGET', message: 'target_file must be a non-empty string' }
      });
      break;
    }
    if (typeof op.content !== 'string') {
      const errorObj = {
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        error: { code: 'INVALID_CONTENT', message: 'content must be a string' }
      };
      results.push(errorObj);
      errorCount++;
      errors.push({ operation_index: i, code: 'INVALID_CONTENT', message: 'content must be a string' });
      await trace({
        kind: 'write_plan_op',
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        validation: {},
        error: { code: 'INVALID_CONTENT', message: 'content must be a string' }
      });
      break;
    }

    const targetPath = path.resolve(process.cwd(), op.target_file);

    // Ensure parent directory exists
    try {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
    } catch (mkdirErr) {
      const errorObj = {
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        error: { code: 'DIR_CREATE_FAILED', message: `Failed to create parent directory: ${mkdirErr.message}` }
      };
      results.push(errorObj);
      errorCount++;
      errors.push({ operation_index: i, code: 'DIR_CREATE_FAILED', message: `Failed to create parent directory: ${mkdirErr.message}` });
      await trace({
        kind: 'write_plan_op',
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        validation: {},
        error: { code: 'DIR_CREATE_FAILED', message: `Failed to create parent directory: ${mkdirErr.message}` }
      });
      break;
    }

    // Content validation/repair
    let validatedContent = op.content;
    let validationMeta = { attempts: 1, usedSafeReplacement: false, original_length: op.content.length, final_length: op.content.length };
    try {
      const repairResult = await ContentValidationHelper.executeRepairLoop(op.content, op.target_file);
      validatedContent = repairResult.finalContent;
      validationMeta = {
        attempts: repairResult.attempts || 1,
        usedSafeReplacement: repairResult.usedSafeReplacement || false,
        original_length: op.content.length,
        final_length: validatedContent.length
      };
    } catch (e) {
      // If validation fails, fallback to original content and log
      validationMeta = { attempts: 1, usedSafeReplacement: false, original_length: op.content.length, final_length: op.content.length };
    }

    try {
      // Check file existence for validation
      const fileExists = await fs.access(targetPath).then(() => true).catch(() => false);

      if (op.type === 'create') {
        if (fileExists) {
          throw new Error(`File already exists: ${op.target_file}. Use operation "overwrite" to replace existing file, or delete it first.`);
        }
        await fs.writeFile(targetPath, validatedContent, 'utf8');
      } else if (op.type === 'append') {
        if (!fileExists) {
          throw new Error(`File does not exist: ${op.target_file}. Use operation "create" to create a new file first.`);
        }
        await fs.appendFile(targetPath, validatedContent, 'utf8');
      } else if (op.type === 'overwrite') {
        if (!fileExists) {
          // Auto-fallback: treat overwrite of non-existent file as create
          console.log(`[WritePlanTool] File not found for overwrite, creating: ${op.target_file}`);
          await fs.writeFile(targetPath, validatedContent, 'utf8');
        } else {
          await fs.writeFile(targetPath, validatedContent, 'utf8');
        }
      }

      results.push({
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'success',
        error: null
      });
      successCount++;
      await trace({
        kind: 'write_plan_op',
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'success',
        validation: validationMeta
      });
    } catch (error) {
      results.push({
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        error: { code: 'EXECUTION_FAILED', message: error.message }
      });
      errorCount++;
      errors.push({ operation_index: i, code: 'EXECUTION_FAILED', message: error.message });
      await trace({
        kind: 'write_plan_op',
        operation_index: i,
        type: op.type,
        target_file: op.target_file,
        status: 'error',
        validation: validationMeta,
        error: { code: 'EXECUTION_FAILED', message: error.message }
      });
      break;
    }
  }

  // Trace: write_plan_summary
  await trace({
    kind: 'write_plan_summary',
    intent: plan.intent || null,
    operation_count: plan.operations.length,
    success_count: successCount,
    error_count: errorCount,
    errors
  });

  return {
    intent: plan.intent || null,
    results
  };
}

/**
 * Execute a single file operation or a full plan (compatibility with existing tests and agent calls).
 * @param {Object} params - Either a single operation object or a plan object.
 * @param {string} [params.operation] - 'create', 'append', or 'overwrite' (single operation).
 * @param {string} [params.path] - Path to the file (single operation).
 * @param {string} [params.content] - Content to write (single operation).
 * @param {Object} [params.plan] - The write plan object (agent call).
 * @param {string} [params.plan.intent] - Optional intent description.
 * @param {Array} params.plan.operations - List of file operations.
 * @returns {Promise<Object>} Result object.
 * @throws {Error} If operation fails (single operation) or plan validation fails.
 */
async function execute(params) {
  let plan;
  // Determine if this is a single operation or a plan
  if (params.plan) {
    plan = params.plan;
  } else if (params.operation && params.path && params.content !== undefined) {
    // Single operation (backward compatibility for tests)
    plan = {
      operations: [{
        type: params.operation,
        target_file: params.path,
        content: params.content
      }]
    };
  } else {
    throw new Error('WritePlanTool: Invalid parameters. Expected either a plan or a single operation.');
  }

  const result = await executeWritePlan(plan);
  
  // For single operation calls (tests), throw on error to maintain backward compatibility
  if (params.operation) {
    const opResult = result.results[0];
    if (opResult.status === 'error') {
      throw new Error(opResult.error.message);
    }
  }
  
  return result;
}

// Thin class wrapper for Tara's tests
class WritePlanTool {
  async executeWritePlan(plan) {
    return executeWritePlan(plan);
  }
  async execute(operation) {
    return execute(operation);
  }

  // Session management for HTTP API
  async begin({ intent, target_file, operation }) {
    if (!target_file) {
      throw new Error('target_file is required');
    }
    if (!['create', 'overwrite', 'append'].includes(operation)) {
      throw new Error('Invalid operation type');
    }

    // Conflict check: only one active session allowed for MVP
    if (sessions.size > 0) {
      console.warn('[WritePlanTool] Session conflict: another session is already active');
      throw new Error('Another write session is already active. Please wait for it to complete.');
    }

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    sessions.set(sessionId, {
      session_id: sessionId,
      intent,
      target_file,
      operation,
      stage: 'awaiting_content',
      created_at: now,
      last_activity: now,
    });

    console.log(`[WritePlanTool] Session created: ${sessionId} | target: ${target_file} | operation: ${operation}`);

    return {
      session_id: sessionId,
      stage: 'awaiting_content',
      instruction: 'Start streaming your file content now. No explanation needed - write the content directly. When finished, write DONE on its own line.',
    };
  }

  async finalizeViaAPI(session_id, content) {
    // MVP stub: This method returns a synthetic success result without calling executeWritePlan.
    // In a later phase, we will:
    //   - Construct a write plan from the session + content
    //   - Call executeWritePlan(plan)
    //   - Keep the same outward-facing behavior (intent + results + error messages)
    const session = sessions.get(session_id);
    if (!session) {
      console.warn(`[WritePlanTool] Finalize failed: session not found (${session_id})`);
      throw new Error('Session not found or expired. Please start a new write session.');
    }

    // Check expiration (5 minutes)
    const now = new Date();
    const created = new Date(session.created_at);
    const fiveMinutes = 5 * 60 * 1000;
    if (now - created > fiveMinutes) {
      console.warn(`[WritePlanTool] Session expired: ${session_id} (created: ${session.created_at})`);
      sessions.delete(session_id);
      throw new Error('Session has expired (5 minutes). Please start a new write session.');
    }

    // Basic validation: content must not be empty after trimming
    if (typeof content !== 'string' || content.trim() === '') {
      console.warn(`[WritePlanTool] Finalize rejected: empty content for session ${session_id}`);
      throw new Error('Validation failed: content cannot be empty');
    }

    // Update last activity
    session.last_activity = now.toISOString();

    console.log(`[WritePlanTool] Finalizing session: ${session_id} | target: ${session.target_file} | content length: ${content.length}`);

    // Build plan from session + content
    const plan = {
      intent: session.intent,
      operations: [{
        type: session.operation,
        target_file: session.target_file,
        content,
      }],
    };

    // Execute real write via executeWritePlan
    const result = await executeWritePlan(plan);

    // Check for write errors and propagate them
    if (result.results && result.results[0] && result.results[0].status === 'error') {
      const error = result.results[0].error;
      console.error(`[WritePlanTool] Write failed for session ${session_id}: ${error.message}`);
      throw new Error(error.message || 'Write operation failed');
    }

    // Remove session after successful finalization (one‑time use)
    sessions.delete(session_id);
    console.log(`[WritePlanTool] Session finalized and removed: ${session_id}`);

    return result;
  }

  async getStatus(session_id) {
    const session = sessions.get(session_id);
    if (!session) {
      throw new Error('Session not found or expired. Please start a new write session.');
    }

    // Check expiration
    const now = new Date();
    const created = new Date(session.created_at);
    const fiveMinutes = 5 * 60 * 1000;
    if (now - created > fiveMinutes) {
      console.warn(`[WritePlanTool] Session expired during status check: ${session_id}`);
      sessions.delete(session_id);
      throw new Error('Session not found or expired. Please start a new write session.');
    }

    // Update last activity
    session.last_activity = now.toISOString();

    return {
      session_id: session.session_id,
      stage: session.stage,
      created_at: session.created_at,
      last_activity: session.last_activity,
    };
  }

  async deleteSession(session_id) {
    if (!sessions.has(session_id)) {
      console.warn(`[WritePlanTool] Delete failed: session not found (${session_id})`);
      throw new Error('Session not found or expired. Please start a new write session.');
    }
    sessions.delete(session_id);
    console.log(`[WritePlanTool] Session deleted: ${session_id}`);
  }

  static clearAllSessions() {
    const count = sessions.size;
    sessions.clear();
    if (count > 0) {
      console.log(`[WritePlanTool] Cleared ${count} session(s)`);
    }
  }
}

module.exports = WritePlanTool;
module.exports.WritePlanTool = WritePlanTool;
module.exports.executeWritePlan = executeWritePlan;
module.exports.execute = execute;
