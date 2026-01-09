#!/usr/bin/env node
console.error('[DEBUG] Orion CLI starting...');
// Interactive CLI for Orion Agent
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');
const OrionAgent = require('../backend/src/agents/OrionAgent');
const fileSystemTool = require('../backend/tools/FileSystemTool');
const DatabaseToolAgentAdapter = require('../backend/tools/DatabaseToolAgentAdapter');
const WritePlanTool = require('../backend/tools/WritePlanTool'); // Renamed to WriteTool below
const { executeSkill } = require('../backend/tools/SkillTool');
const createOrionCliController = require('./orion-cli-controller');
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
    this.verbose = options.verbose || false;
    this.messageStoreService = options.messageStoreService || new MessageStoreService();
    this.traceStoreService = options.traceStoreService || new TraceStoreService({ projectId: this.projectId });
  }

  async init() {
    try {
      console.error('[DEBUG] Interface.init started');

      // Load environment variables from backend/.env
      dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

      // Create WritePlanTool instance FIRST so it can be shared
      const writePlanToolInstance = new WritePlanTool();

      // Create CLI controller for write sessions
      // Use direct call to WritePlanTool.finalizeViaAPI instead of HTTP
      // This avoids the separate-process session issue
      this.cliController = createOrionCliController({
        http: {
          post: async (url, body) => {
            // Intercept write-session finalize calls and route directly to local instance
            // This bypasses HTTP and uses the same WritePlanTool instance that created the session
            if (url === '/api/write-session/finalize' && body.session_id) {
              try {
                const result = await writePlanToolInstance.finalizeViaAPI(body.session_id, body.content);
                return { status: 200, data: { ...result, success: true } };
              } catch (error) {
                return { status: 400, data: { success: false, error: error.message } };
              }
            }
            // Fallback to actual HTTP for other endpoints
            const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
            const response = await fetch(`${baseUrl}${url}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            return { status: response.status, data: await response.json() };
          },
        },
        console: {
          log: (msg) => this.outputStream.write(msg + '\n'),
          warn: (msg) => console.warn(msg),
          error: (msg) => this.outputStream.write('[ERROR] ' + msg + '\n'),
        },
      });

      // Create ContextService (requires projectId for history loading)
      const contextService = new ContextService();
      console.error('[DEBUG] ContextService created');

      // Instantiate OrionAgent with FileSystemTool (without write_to_file), DatabaseTool, and WritePlanTool
      this.agent = new OrionAgent({
        toolRegistry: { 
          FileSystemTool: fileSystemTool, // for read_file, list_files, search_files (but not write_to_file)
          DatabaseTool: DatabaseToolAgentAdapter,
          WritePlanTool: writePlanToolInstance, // Use shared instance (same as cliController)
          SkillTool: { execute: executeSkill }, // For SkillTool_execute
        },
        contextService,
        projectId: this.projectId,
        rootPath: process.cwd(),
        orchestratorOptions: {
          traceEmitter: (event) => {
            // Skip noisy trace types unless verbose mode is enabled
            if (!this.verbose && ['llm_call', 'chunk', 'turn_start', 'turn_end'].includes(event.type)) return;
            const summary = event.summary || '';
            process.stderr.write(`[TRACE] ${event.type} ${summary}\n`);
          },
          projectId: this.projectId,
          traceStoreService: this.traceStoreService,
        }
      });
      console.error('[DEBUG] OrionAgent created');

      // Setup readline interface
      this.readlineInterface = readline.createInterface({
        input: this.inputStream,
        output: this.outputStream,
        prompt: '> '
      });
      console.error('[DEBUG] readline interface created');

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
                // Route through write session controller if active
                const state = this.cliController.getCliState();
                if (state.activeWriteSession) {
                  await this.cliController.handleAssistantMessage(event.content || '');
                }
                // Always display to user
                this.outputStream.write(event.content || '');
              } else if (event.type === 'tool_result') {
                // Check for WritePlanTool_begin success
                if (event.tool === 'WritePlanTool' && event.action === 'begin' && event.success) {
                  this.cliController.startWriteSession({ session_id: event.result.session_id });
                  this.outputStream.write('\n[Write session started - end with DONE on its own line]\n');
                }
              } else if (event.type === 'final') {
                // Content was already streamed via chunks, just store for persistence
                if (event.content) {
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
        console.error('[DEBUG] readline interface closed');
        this.outputStream.write('CLI session ended.\n');
      });

      // Keep the process alive
      process.on('SIGINT', () => {
        this.readlineInterface.close();
        process.exit(0);
      });
    } catch (err) {
      console.error('[ERROR] Interface.init failed:', err);
      process.exit(1);
    }
  }
}

/**
 * Parse command line arguments.
 * @param {string[]} argv - The argv array (process.argv).
 * @returns {Object} Parsed arguments: { projectId, message, nonInteractive, verbose }
 */
function parseArgs(argv) {
  const args = argv.slice(2); // remove 'node' and script path
  let projectId = null;
  let message = null;
  let nonInteractive = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--project-id' && i + 1 < args.length) {
      projectId = args[i + 1];
      i++;
    } else if (arg === '--non-interactive') {
      nonInteractive = true;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg.startsWith('--')) {
      // ignore other flags for now
      continue;
    } else {
      // This is the message (the first non-option argument)
      message = arg;
    }
  }

  // If a message is provided, treat as non-interactive unless --non-interactive is explicitly false?
  // For simplicity, we set nonInteractive to true if a message is present.
  if (message !== null) {
    nonInteractive = true;
  }

  return { projectId, message, nonInteractive, verbose };
}

/**
 * Run Orion in non-interactive mode (single task).
 * @param {string} projectId - Project ID (required).
 * @param {string} userMessage - User message to process.
 * @param {boolean} verbose - Show all trace events including llm_call.
 */
async function runNonInteractive(projectId, userMessage, verbose = false) {
  try {
    // Load environment variables
    dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

    const contextService = new ContextService();
    const traceStoreService = new TraceStoreService({ projectId });
    const messageStoreService = new MessageStoreService();

    console.error('[DEBUG] Creating OrionAgent...');
    const agent = new OrionAgent({
      toolRegistry: { 
        FileSystemTool: fileSystemTool, // for read_file, list_files, search_files (but not write_to_file)
        DatabaseTool: DatabaseToolAgentAdapter,
        WritePlanTool: new WritePlanTool(), // Expose as WritePlanTool
        SkillTool: { execute: executeSkill }, // For SkillTool_execute
      },
      contextService,
      projectId: projectId,
      rootPath: process.cwd(),
      orchestratorOptions: {
        traceEmitter: (event) => {
          // Skip noisy trace types unless verbose mode is enabled
          if (!verbose && ['llm_call', 'chunk', 'turn_start', 'turn_end'].includes(event.type)) return;
          const summary = event.summary || '';
          process.stderr.write(`[TRACE] ${event.type} ${summary}\n`);
        },
        projectId: projectId,
        traceStoreService: traceStoreService,
      }
    });

    console.error('[DEBUG] Storing user message...');
    // Store the user message
    await messageStoreService.insertMessage({
      projectExternalId: projectId,
      sender: 'user',
      content: userMessage,
      metadata: null
    });

    let finalContent = '';
    console.error('[DEBUG] Starting streaming...');
    for await (const event of agent.processTaskStreaming(userMessage)) {
      if (event.type === 'chunk') {
        process.stdout.write(event.content || '');
      } else if (event.type === 'final') {
        // Content was already streamed via chunks, just store for persistence
        if (event.content) {
          finalContent = event.content;
        }
        process.stdout.write('\n');
      } else if (event.type === 'error') {
        process.stderr.write(`\n[ERROR] ${event.error}\n`);
      }
    }

    // Store the assistant message
    if (finalContent) {
      console.error('[DEBUG] Storing assistant message...');
      await messageStoreService.insertMessage({
        projectExternalId: projectId,
        sender: 'orion',
        content: finalContent,
        metadata: null
      });
    }
    console.error('[DEBUG] Non-interactive run completed.');
  } catch (err) {
    console.error('[ERROR] runNonInteractive failed:', err);
    process.exit(1);
  }
}

/**
 * Main entry point.
 * @param {string[]} argv - Command line arguments (process.argv).
 */
async function main(argv) {
  const { projectId, message, nonInteractive, verbose } = parseArgs(argv);
  if (!projectId) {
    process.stderr.write('Error: --project-id is required\n');
    process.exit(1);
  }

  if (nonInteractive) {
    if (!message) {
      process.stderr.write('Error: Message is required in non-interactive mode\n');
      process.exit(1);
    }
    await runNonInteractive(projectId, message, verbose);
  } else {
    // Interactive mode
    const iface = new Interface(process.stdin, process.stdout, { projectId, verbose });
    await iface.init();
  }
}

module.exports = {
  Interface,
  parseArgs,
  runNonInteractive,
  main
};

if (require.main === module) {
  main(process.argv).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
