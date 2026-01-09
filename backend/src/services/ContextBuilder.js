const DatabaseTool = require('../../tools/DatabaseTool');
const FileSystemTool = require('../../tools/FileSystemTool');
const TraceStoreService = require('./TraceStoreService');

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
    // 1) Fetch step
    const step = await this.databaseTool.get_step(stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    // 2) Emit started
    await this.traceStore.emit('context_build_started', { stepId });

    // 3) Validate required fields
    const requiredFields = ['file_path', 'instructions', 'assigned_to', 'context_files'];
    for (const field of requiredFields) {
      if (step[field] === null || step[field] === undefined) {
        throw new Error(`Step missing required field: ${field}`);
      }
    }

    // 4) Validate assigned_to
    const agentType = step.assigned_to;
    if (agentType !== 'TaraAider' && agentType !== 'DevonAider') {
      throw new Error(
        `Invalid assigned_to value: ${agentType}. Must be TaraAider or DevonAider`
      );
    }

    // 5) Determine agent prompt file
    const agentPromptFile = agentType === 'TaraAider'
      ? 'backend/prompts/TaraPrompts.md'
      : 'backend/prompts/DevonPrompts.md';

    // 6) Assemble context files
    const contextFiles = [...step.context_files, agentPromptFile];

    // 7) Missing file policy: throw on first missing required file
    const targetFile = step.file_path;
    const filesToCheck = [targetFile, ...step.context_files, agentPromptFile];

    for (const filePath of filesToCheck) {
      const exists = await this.fileSystemTool.file_exists(filePath);
      if (!exists) {
        throw new Error(`Missing context file: ${filePath}`);
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
  }
}

module.exports = ContextBuilder;
