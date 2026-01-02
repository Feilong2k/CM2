#!/usr/bin/env node
// Interactive CLI for Orion Agent
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');
const OrionAgent = require('../backend/src/agents/OrionAgent');
const fileSystemTool = require('../backend/tools/FileSystemTool');
const DatabaseToolAgentAdapter = require('../backend/tools/DatabaseToolAgentAdapter');
const MessageStoreService = require('../backend/src/services/MessageStoreService');
const TraceStoreService = require('../backend/src/services/TraceStoreService');
const ContextService = require('../backend/src/services/ContextService');

class Interface {
  constructor(inputStream = process.stdin, outputStream = process.stdout, options = {}) {
    this.inputStream = inputStream;
    this.outputStream = outputStream;
    this.agent = null;
    this.readlineInterface = null;
    this.projectId = options.projectId || null;
    this.messageStoreService = options.messageStoreService || new MessageStoreService();
    this.traceStoreService = options.traceStoreService || new TraceStoreService();
  }

  async init() {
    // Load environment variables from backend/.env
    dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

    // Create ContextService (requires projectId for history loading)
    const contextService = new ContextService();

    // Instantiate OrionAgent with both FileSystemTool and DatabaseTool, and context integration
    this.agent = new OrionAgent({
      toolRegistry: { 
        FileSystemTool: fileSystemTool,
        DatabaseTool: DatabaseToolAgentAdapter
      },
      contextService,
      projectId: this.projectId,
      rootPath: process.cwd(),
      orchestratorOptions: {
        traceEmitter: (event) => {
          const summary = event.summary || '';
          process.stderr.write(`[TRACE] ${event.type} ${summary}\n`);
        },
        projectId: this.projectId,
        traceStoreService: this.traceStoreService,
      }
    });

    // Setup readline interface
    this.readlineInterface = readline.createInterface({
      input: this.inputStream,
      output: this.outputStream,
      prompt: '> '
    });

    this.outputStream.write('Welcome to Orion CLI! Type your commands or "exit" to quit.\n');
    if (this.projectId) {
      this.outputStream.write(`Project ID: ${this.projectId} (context loaded)\n`);
    }
    this.readlineInterface.prompt();

    this.readlineInterface.on('line', async (line) => {
      const input = line.trim();
      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        this.outputStream.write('Goodbye!\n');
        this.readlineInterface.close();
        process.exit(0);
      } else {
        try {
          // Persist user message
          await this.messageStoreService.insertMessage({
            projectExternalId: this.projectId,
            sender: 'user',
            content: input,
            metadata: null
          });

          // Process the task with streaming, letting the agent handle context
          let finalContent = '';
          for await (const event of this.agent.processTaskStreaming(input)) {
            if (event.type === 'chunk') {
              // Write the chunk content directly to output
              this.outputStream.write(event.content || '');
            } else if (event.type === 'final') {
              // Write the final answer
              if (event.content) {
                this.outputStream.write(event.content);
                finalContent = event.content;
              }
              this.outputStream.write('\n');
            } else if (event.type === 'error') {
              // Error from orchestrator (e.g., trace storage failure)
              this.outputStream.write(`\n[ERROR] ${event.error}\n`);
              // Break the loop and continue to next prompt
              break;
            }
          }
          
          // Persist assistant message if we have a final content
          if (finalContent) {
            await this.messageStoreService.insertMessage({
              projectExternalId: this.projectId,
              sender: 'orion',
              content: finalContent,
              metadata: null
            });
          }
        } catch (err) {
          // Catch any other error (e.g., history loading, message insertion)
          this.outputStream.write(`\n[ERROR] ${err.message}\n`);
          // Do not exit, just break the current task and continue to next prompt.
        }
        this.readlineInterface.prompt();
      }
    });

    this.readlineInterface.on('close', () => {
      this.outputStream.write('CLI session ended.\n');
    });
  }
}

/**
 * Parse command line arguments for --project-id
 * @param {Array} args - Command line arguments (process.argv.slice(2))
 * @returns {Object} Parsed options: { projectId, command }
 */
function parseArgs(args) {
  const options = { projectId: null, command: '' };
  const remaining = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--project-id' && i + 1 < args.length) {
      options.projectId = args[i + 1];
      i++; // skip next argument
    } else {
      remaining.push(arg);
    }
  }
  
  options.command = remaining.join(' ').trim();
  
  // --project-id is now mandatory
  if (!options.projectId) {
    process.stderr.write('[ERROR] --project-id is required\n');
    process.stderr.write('Usage: node bin/orion-cli.js --project-id <project-id> [message]\n');
    process.exit(1);
  }
  
  return options;
}

/**
 * Run CLI in non-interactive mode with mandatory project ID
 * @param {string} command - User command
 * @param {string} projectId - Project ID (required)
 * @returns {Promise<void>}
 */
async function runNonInteractive(command, projectId) {
  // Load environment variables from backend/.env
  dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

  // Instantiate services
  const messageStoreService = new MessageStoreService();
  const traceStoreService = new TraceStoreService();
  const contextService = new ContextService();

  // Instantiate OrionAgent with both FileSystemTool and DatabaseTool, and context integration
  const agent = new OrionAgent({
    toolRegistry: { 
      FileSystemTool: fileSystemTool,
      DatabaseTool: DatabaseToolAgentAdapter
    },
    contextService,
    projectId,
    rootPath: process.cwd(),
    orchestratorOptions: {
      traceEmitter: (event) => {
        const summary = event.summary || '';
        process.stderr.write(`[TRACE] ${event.type} ${summary}\n`);
      },
      projectId,
      traceStoreService,
    }
  });

  // Persist user message
  try {
    await messageStoreService.insertMessage({
      projectExternalId: projectId,
      sender: 'user',
      content: command,
      metadata: null
    });
  } catch (error) {
    process.stderr.write(`[ERROR] Failed to persist user message: ${error.message}\n`);
    process.exit(1);
    return;
  }

  // Process the task with streaming, letting the agent handle context
  let finalContent = '';
  try {
    for await (const event of agent.processTaskStreaming(command)) {
      if (event.type === 'chunk') {
        process.stdout.write(event.content || '');
      } else if (event.type === 'final') {
        if (event.content) {
          process.stdout.write(event.content);
          finalContent = event.content;
        }
        process.stdout.write('\n');
      } else if (event.type === 'error') {
        process.stderr.write(`\n[ERROR] ${event.error}\n`);
      }
    }
  } catch (err) {
    process.stderr.write(`[ERROR] ${err.message}\n`);
    process.exit(1);
    return;
  }

  // Persist assistant message if we have a final content
  if (finalContent) {
    try {
      await messageStoreService.insertMessage({
        projectExternalId: projectId,
        sender: 'orion',
        content: finalContent,
        metadata: null
      });
    } catch (error) {
      process.stderr.write(`[ERROR] Failed to persist assistant message: ${error.message}\n`);
      process.exit(1);
      return;
    }
  }

  process.exit(0);
}

/**
 * Main entry point for CLI
 * @param {Array} argv - Command line arguments (default: process.argv)
 */
async function main(argv) {
  const args = argv.slice(2);
  const { projectId, command } = parseArgs(args);
  
  if (command) {
    // Non-interactive mode
    await runNonInteractive(command, projectId);
  } else {
    // Interactive mode
    const cli = new Interface(process.stdin, process.stdout, { projectId });
    await cli.init();
  }
}

if (require.main === module) {
  // Run when executed directly
  main(process.argv).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
} else {
  // Export for testing
  module.exports = {
    Interface,
    parseArgs,
    runNonInteractive,
    main
  };
}
