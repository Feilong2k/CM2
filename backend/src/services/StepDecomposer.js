const path = require('path');
const fs = require('fs');
const util = require('util');
const Ajv = require('ajv');
const stat = util.promisify(fs.stat);

const MAX_CONTEXT_FILE_SIZE = 5 * 1024 * 1024; // 5MB

class StepDecomposer {
  constructor(options = {}) {
    this.databaseTool = options.databaseTool || require('../../tools/DatabaseTool');
    this.fileSystemTool = options.fileSystemTool || require('../../tools/FileSystemTool');
    this.traceStore = options.traceStore || new (require('./TraceStoreService'))({ projectId: options.projectId });
    this.projectId = options.projectId;
    if (!this.projectId) throw new Error('StepDecomposer: projectId is required');

    // Load and compile the canonical JSON schema
    const schemaPath = path.resolve(__dirname, '../../..', '.Docs/03-ARCHITECTURE/step_decomposition_schema.json');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    this.schema = JSON.parse(schemaContent);
    this.ajv = new Ajv({ allErrors: true, strict: false });
    this.validate = this.ajv.compile(this.schema);
  }

  async decompose(subtaskId, decompositionJson) {
    try {
      // 1. Validate projectId
      if (!this.projectId) throw new Error('StepDecomposer: projectId is required');

      // 2. Validate decompositionJson against schema
      const valid = this.validate(decompositionJson);
      if (!valid) {
        const errorMsg = this.ajv.errorsText(this.validate.errors, { separator: '; ' });
        await this._logError('step_decomposition_failed', {
          subtaskId,
          error: 'Step decomposition schema validation failed: ' + errorMsg,
          stack: new Error().stack
        });
        throw new Error('Step decomposition schema validation failed: ' + errorMsg);
      }

      const steps = decompositionJson.steps;
      const stepIds = [];

      // Trace: started (no projectId in payload)
      await this.traceStore.emit('step_decomposition_started', {
        subtaskId,
        stepCount: steps.length
      });

      // Validate all files before any DB writes
      for (const step of steps) {
        // File existence: file_path
        let filePathExists;
        try {
          filePathExists = await this.fileSystemTool.file_exists(step.file_path);
        } catch (err) {
          await this._logError('step_decomposition_failed', {
            subtaskId,
            filePath: step.file_path,
            error: `File system error: ${err.message}`,
            stack: err.stack
          });
          throw new Error(`File system error for ${step.file_path}: ${err.message}`);
        }
        if (!filePathExists) {
          const err = new Error(`Missing context file: ${step.file_path}`);
          await this._logError('step_decomposition_failed', {
            subtaskId,
            filePath: step.file_path,
            error: err.message,
            stack: err.stack
          });
          throw err;
        }
        // Large file check
        try {
          const absPath = path.resolve(process.cwd(), step.file_path);
          const stats = await stat(absPath);
          if (stats.size > MAX_CONTEXT_FILE_SIZE) {
            await this.traceStore.emit('step_decomposition_warning', {
              subtaskId,
              filePath: step.file_path,
              size: stats.size,
              warning: `File exceeds ${MAX_CONTEXT_FILE_SIZE} bytes and may be truncated or skipped`
            });
            // For now, just warn; optionally, you could skip or truncate here.
          }
        } catch (err) {
          if (err.code === 'ENOENT') {
            // In test/mock mode, stat may fail even if file_exists is mocked true. Log warning, do not throw.
            await this.traceStore.emit('step_decomposition_warning', {
              subtaskId,
              filePath: step.file_path,
              warning: `File stat failed (ENOENT): ${err.message}`
            });
          } else {
            await this._logError('step_decomposition_failed', {
              subtaskId,
              filePath: step.file_path,
              error: `File stat error: ${err.message}`,
              stack: err.stack
            });
            throw new Error(`File stat error for ${step.file_path}: ${err.message}`);
          }
        }
        // File existence: context_files
        for (const ctxFile of step.context_files) {
          let ctxExists;
          try {
            ctxExists = await this.fileSystemTool.file_exists(ctxFile);
          } catch (err) {
            await this._logError('step_decomposition_failed', {
              subtaskId,
              filePath: ctxFile,
              error: `File system error: ${err.message}`,
              stack: err.stack
            });
            throw new Error(`File system error for ${ctxFile}: ${err.message}`);
          }
          if (!ctxExists) {
            const err = new Error(`Missing context file: ${ctxFile}`);
            await this._logError('step_decomposition_failed', {
              subtaskId,
              filePath: ctxFile,
              error: err.message,
              stack: err.stack
            });
            throw err;
          }
          // Large file check for context files
          try {
            const absPath = path.resolve(process.cwd(), ctxFile);
            const stats = await stat(absPath);
            if (stats.size > MAX_CONTEXT_FILE_SIZE) {
              await this.traceStore.emit('step_decomposition_warning', {
                subtaskId,
                filePath: ctxFile,
                size: stats.size,
                warning: `File exceeds ${MAX_CONTEXT_FILE_SIZE} bytes and may be truncated or skipped`
              });
            }
          } catch (err) {
            if (err.code === 'ENOENT') {
              // In test/mock mode, stat may fail even if file_exists is mocked true. Log warning, do not throw.
              await this.traceStore.emit('step_decomposition_warning', {
                subtaskId,
                filePath: ctxFile,
                warning: `File stat failed (ENOENT): ${err.message}`
              });
            } else {
              await this._logError('step_decomposition_failed', {
                subtaskId,
                filePath: ctxFile,
                error: `File stat error: ${err.message}`,
                stack: err.stack
              });
              throw new Error(`File stat error for ${ctxFile}: ${err.message}`);
            }
          }
        }
      }

      // 4. All validation passed, create steps in DB
      try {
        for (const step of steps) {
          const stepData = {
            project_id: this.projectId,
            subtask_id: subtaskId,
            step_number: step.step_number,
            step_type: step.step_type,
            file_path: step.file_path,
            instructions: step.instructions,
            assigned_to: step.assigned_to,
            context_files: step.context_files
          };
          let id = await this.databaseTool.create_step(stepData);
          // Accept both {id: 101} and 101
          if (id && typeof id === 'object' && 'id' in id) id = id.id;
          stepIds.push(id);
        }
      } catch (err) {
        await this._logError('step_decomposition_failed', {
          subtaskId,
          error: err.message,
          stack: err.stack
        });
        throw err;
      }

      // 5. Trace: completed (no projectId in payload, no stepIds in payload)
      await this.traceStore.emit('step_decomposition_completed', {
        subtaskId,
        createdCount: stepIds.length
      });

      return { success: true, stepIds };
    } catch (err) {
      // Catch-all: log any uncaught error
      await this._logError('step_decomposition_failed', {
        subtaskId,
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

module.exports = StepDecomposer;