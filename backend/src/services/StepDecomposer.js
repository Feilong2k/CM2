const path = require('path');
const fs = require('fs');
const Ajv = require('ajv');

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
    // 1. Validate projectId
    if (!this.projectId) throw new Error('StepDecomposer: projectId is required');

    // 2. Validate decompositionJson against schema
    const valid = this.validate(decompositionJson);
    if (!valid) {
      const errorMsg = this.ajv.errorsText(this.validate.errors, { separator: '; ' });
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
      const filePathExists = await this.fileSystemTool.file_exists(step.file_path);
      if (!filePathExists) {
        await this.traceStore.emit('step_decomposition_failed', {
          projectId: this.projectId,
          subtaskId,
          error: `Missing context file: ${step.file_path}`
        });
        throw new Error(`Missing context file: ${step.file_path}`);
      }
      // File existence: context_files
      for (const ctxFile of step.context_files) {
        const ctxExists = await this.fileSystemTool.file_exists(ctxFile);
        if (!ctxExists) {
          await this.traceStore.emit('step_decomposition_failed', {
            projectId: this.projectId,
            subtaskId,
            error: `Missing context file: ${ctxFile}`
          });
          throw new Error(`Missing context file: ${ctxFile}`);
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
      await this.traceStore.emit('step_decomposition_failed', {
        projectId: this.projectId,
        subtaskId,
        error: err.message
      });
      throw err;
    }

    // 5. Trace: completed (no projectId in payload, no stepIds in payload)
    await this.traceStore.emit('step_decomposition_completed', {
      subtaskId,
      createdCount: stepIds.length
    });

    return { success: true, stepIds };
  }
}

module.exports = StepDecomposer;
