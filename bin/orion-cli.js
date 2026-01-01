#!/usr/bin/env node
// Interactive CLI for Orion Agent
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');
const OrionAgent = require('../backend/src/agents/OrionAgent');
const fileSystemTool = require('../backend/tools/FileSystemTool');
const DatabaseToolAgentAdapter = require('../backend/tools/DatabaseToolAgentAdapter');
const HistoryLoaderService = require('../backend/src/services/HistoryLoaderService');
const MessageStoreService = require('../backend/src/services/MessageStoreService');
const TraceStoreService = require('../backend/src/services/TraceStoreService');

class Interface {
  constructor(inputStream = process.stdin, outputStream = process.stdout, options = {}) {
    this.inputStream = inputStream;
    this.outputStream = outputStream;
    this.agent = null;
    this.readlineInterface = null;
    this.projectId = options.projectId || null;
    this.historyService = options.historyService || new HistoryLoaderService();
    this.messageStoreService = options.messageStoreService || new MessageStoreService();
    this.traceStoreService = options.traceStoreService || new TraceStoreService();
  }

  async init() {
    // Load environment variables from backend/.env
    dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

    // Instantiate OrionAgent with both FileSystemTool and DatabaseTool
    this.agent = new OrionAgent({
      toolRegistry: { 
        FileSystemTool: fileSystemTool,
        DatabaseTool: DatabaseToolAgentAdapter
      },
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
      this.outputStream.write(`Project ID: ${this.projectId} (history loaded)\n`);
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

          // Build messages array with history if projectId is set
          const messages = await this._buildMessages(input);
          let finalContent = '';
          for await (const event of this.agent.processMessagesStreaming(messages)) {
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
              // Fail loud: exit the CLI
              this.outputStream.write(`\n[ERROR] ${event.error}\n`);
              process.exit(1);
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
          process.exit(1);
        }
        this.readlineInterface.prompt();
      }
    });

    this.readlineInterface.on('close', () => {
      this.outputStream.write('CLI session ended.\n');
    });
  }

  /**
   * Build messages array with history if projectId is set
   * @param {string} userMessage - Current user message
   * @returns {Promise<Array>} Messages array for the agent
   */
  async _buildMessages(userMessage) {
    const messages = [];
    
    // Add system prompt (from agent)
    messages.push({ role: 'system', content: this.agent.systemPrompt });
    
    // Load history if projectId is provided
    if (this.projectId) {
      try {
        const history = await this.historyService.loadRecentChatHistory({
          projectId: this.projectId,
          limit: 20
        });
        
        // Map history rows to message objects
        history.forEach(row => {
          // Skip tool messages (sender 'tool' or 'system'?) - only 'user' and 'orion'?
          // The spec says no tool messages loaded into history.
          // We'll load only 'user' and 'orion' (assistant) messages.
          // The sender column contains 'user', 'orion', 'system'
          // We'll map 'orion' to 'assistant' role.
          const role = row.sender === 'orion' ? 'assistant' : row.sender;
          messages.push({ role, content: row.content });
        });
      } catch (error) {
        // Fail-loud: rethrow the error
        throw error;
      }
    }
    
    // Add current user message
    messages.push({ role: 'user', content: userMessage });
    
    return messages;
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
  const historyService = new HistoryLoaderService();
  const messageStoreService = new MessageStoreService();
  const traceStoreService = new TraceStoreService();

  // Instantiate OrionAgent with both FileSystemTool and DatabaseTool
  const agent = new OrionAgent({
    toolRegistry: { 
      FileSystemTool: fileSystemTool,
      DatabaseTool: DatabaseToolAgentAdapter
    },
    orchestratorOptions: {
      traceEmitter: (event) => {
        const summary = event.summary || '';
        process.stderr.write(`[TRACE] ${event.type} ${summary}\n`);
      },
      projectId,
      traceStoreService,
    }
  });

  // Load history
  const messages = [];
  
  // Add system prompt
  messages.push({ role: 'system', content: agent.systemPrompt });
  
  try {
    const history = await historyService.loadRecentChatHistory({
      projectId,
      limit: 20
    });
    
    history.forEach(row => {
      const role = row.sender === 'orion' ? 'assistant' : row.sender;
      messages.push({ role, content: row.content });
    });
  } catch (error) {
    // Fail-loud: propagate error
    process.stderr.write(`[ERROR] Failed to load history: ${error.message}\n`);
    process.exit(1);
    return; // Prevent further execution in test environment when exit is mocked
  }
  
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

  // Add current user message to messages
  messages.push({ role: 'user', content: command });

  // Process the messages
  let finalContent = '';
  try {
    for await (const event of agent.processMessagesStreaming(messages)) {
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
