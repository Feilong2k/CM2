const DatabaseTool = require('../../tools/DatabaseTool');
const FileSystemTool = require('../../tools/FileSystemTool');
const TraceStoreService = require('./TraceStoreService');
const fs = require('fs');
const util = require('util');
const stat = util.promisify(fs.stat);

const MAX_CONTEXT_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * ContextBuilder (2-2-2 contract)
 *
 * Produces structured inputs for Aider CLI for a single step.
 */
class ContextBuilder {
  constructor(options = {}) {
    this.databaseTool = options.databaseTool || DatabaseTool;
    this.fileSystemTool = options.fileSystemTool || FileSystemTool;
    this.projectId = options.projectId || null;
    this.traceStore = options.traceStore || new TraceStoreService({ projectId: this.projectId });
  }

  async buildContext(stepId) {
    try {
      // 1) Fetch step
      const step = await this.databaseTool.get_step(stepId);
      if (!step) {
        const err = new Error(`Step not found: ${stepId}`);
        await this._logError('context_build_failed', { stepId, error: err.message, stack: err.stack });
        throw err;
      }

      // 2) Emit started
      await this.traceStore.emit('context_build_started', { stepId });

      // 3) Validate required fields
      const requiredFields = ['file_path', 'instructions', 'assigned_to', 'context_files'];
      for (const field of requiredFields) {
        if (step[field] === null || step[field] === undefined) {
          const err = new Error(`Step missing required field: ${field}`);
          await this._logError('context_build_failed', { stepId, error: err.message, stack: err.stack });
          throw err;
        }
      }

      // 4) Validate assigned_to
      const agentType = step.assigned_to;
      if (agentType !== 'TaraAider' && agentType !== 'DevonAider') {
        const err = new Error(
          `Invalid assigned_to value: ${agentType}. Must be TaraAider or DevonAider`
        );
        await this._logError('context_build_failed', { stepId, error: err.message, stack: err.stack });
        throw err;
      }

      // 5) Determine agent prompt file
      const agentPromptFile = agentType === 'TaraAider'
        ? 'backend/prompts/TaraPrompts.md'
        : 'backend/prompts/DevonPrompts.md';

      // 6) Assemble context files
      const contextFiles = [...step.context_files, agentPromptFile];

      // 7) Missing file policy: throw on first missing required file, check size
      const targetFile = step.file_path;
      const filesToCheck = [targetFile, ...step.context_files, agentPromptFile];

      for (const filePath of filesToCheck) {
        let exists;
        try {
          exists = await this.fileSystemTool.file_exists(filePath);
        } catch (err) {
          await this._logError('context_build_failed', {
            stepId,
            filePath,
            error: `File system error: ${err.message}`,
            stack: err.stack
          });
          throw new Error(`File system error for ${filePath}: ${err.message}`);
        }
        if (!exists) {
          const err = new Error(`Missing context file: ${filePath}`);
          await this._logError('context_build_failed', { stepId, filePath, error: err.message, stack: err.stack });
          throw err;
        }
        // Large file check
        try {
          const absPath = require('path').resolve(process.cwd(), filePath);
          const stats = await stat(absPath);
          if (stats.size > MAX_CONTEXT_FILE_SIZE) {
            await this.traceStore.emit('context_build_warning', {
              stepId,
              filePath,
              size: stats.size,
              warning: `File exceeds ${MAX_CONTEXT_FILE_SIZE} bytes and may be truncated or skipped`
            });
            // For now, just warn; optionally, you could skip or truncate here.
          }
        } catch (err) {
          if (err.code === 'ENOENT') {
            // In test/mock mode, stat may fail even if file_exists is mocked true. Log warning, do not throw.
            await this.traceStore.emit('context_build_warning', {
              stepId,
              filePath,
              warning: `File stat failed (ENOENT): ${err.message}`
            });
          } else {
            await this._logError('context_build_failed', {
              stepId,
              filePath,
              error: `File stat error: ${err.message}`,
              stack: err.stack
            });
            throw new Error(`File stat error for ${filePath}: ${err.message}`);
          }
        }
      }

      // 8) Emit completed
      await this.traceStore.emit('context_build_completed', {
        stepId,
        targetFile,
        contextFileCount: contextFiles.length,
        agentType,
      });

      // 9) Return structured context
      return {
        targetFile,
        contextFiles,
        instructions: step.instructions,
        agentType,
      };
    } catch (err) {
      // Catch-all: log any uncaught error
      await this._logError('context_build_failed', {
        stepId,
        error: err.message,
        stack: err.stack
      });
      throw err;
    }
  }

  async _logError(eventType, payload) {
    try {
      await this.traceStore.emit(eventType, payload);
    } catch (e) {
      // Do not throw from error logging
    }
  }
}

module.exports = ContextBuilder;