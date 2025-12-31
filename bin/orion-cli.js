#!/usr/bin/env node
// Interactive CLI for Orion Agent
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');
const OrionAgent = require('../backend/src/agents/OrionAgent');
const fileSystemTool = require('../backend/tools/FileSystemTool');
const DatabaseToolAgentAdapter = require('../backend/tools/DatabaseToolAgentAdapter');

class Interface {
  constructor(inputStream = process.stdin, outputStream = process.stdout) {
    this.inputStream = inputStream;
    this.outputStream = outputStream;
    this.agent = null;
    this.readlineInterface = null;
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
      // Provide a trace emitter that logs to stderr (so it doesn't interfere with user output)
      orchestratorOptions: {
        traceEmitter: (event) => {
          const summary = event.summary || '';
          process.stderr.write(`[TRACE] ${event.type} ${summary}\n`);
        }
      }
    });

    // Setup readline interface
    this.readlineInterface = readline.createInterface({
      input: this.inputStream,
      output: this.outputStream,
      prompt: '> '
    });

    this.outputStream.write('Welcome to Orion CLI! Type your commands or "exit" to quit.\n');
    this.readlineInterface.prompt();

    this.readlineInterface.on('line', async (line) => {
      const input = line.trim();
      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        this.outputStream.write('Goodbye!\n');
        this.readlineInterface.close();
        process.exit(0);
      } else {
        try {
          for await (const event of this.agent.processTaskStreaming(input)) {
            if (event.type === 'chunk') {
              // Write the chunk content directly to output
              this.outputStream.write(event.content || '');
            } else if (event.type === 'final') {
              // Write the final answer
              if (event.content) {
                this.outputStream.write(event.content);
              }
              this.outputStream.write('\n');
            } else if (event.type === 'error') {
              this.outputStream.write(`\n[ERROR] ${event.error}\n`);
            }
          }
        } catch (err) {
          this.outputStream.write(`\n[ERROR] ${err.message}\n`);
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
 * Non-interactive mode: if a command is provided as argument, run it and exit.
 */
function runNonInteractive(command) {
  // Load environment variables from backend/.env
  dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

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
      }
    }
  });

  // Process the command
  (async () => {
    try {
      for await (const event of agent.processTaskStreaming(command)) {
        if (event.type === 'chunk') {
          process.stdout.write(event.content || '');
        } else if (event.type === 'final') {
          if (event.content) {
            process.stdout.write(event.content);
          }
          process.stdout.write('\n');
        } else if (event.type === 'error') {
          process.stderr.write(`\n[ERROR] ${event.error}\n`);
        }
      }
      process.exit(0);
    } catch (err) {
      process.stderr.write(`[ERROR] ${err.message}\n`);
      process.exit(1);
    }
  })();
}

if (require.main === module) {
  // Check for command line arguments
  const args = process.argv.slice(2);
  if (args.length > 0) {
    // Join all arguments as a single command string
    const command = args.join(' ');
    runNonInteractive(command);
  } else {
    // Interactive mode
    const cli = new Interface();
    cli.init();
  }
} else {
  module.exports = Interface;
}
