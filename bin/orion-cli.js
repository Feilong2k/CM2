#!/usr/bin/env node
// Interactive CLI for Orion Agent
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');
const OrionAgent = require('../backend/src/agents/OrionAgent');
const fileSystemTool = require('../backend/tools/FileSystemTool');

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

    // Instantiate OrionAgent with FileSystemTool
    this.agent = new OrionAgent({
      toolRegistry: { FileSystemTool: fileSystemTool },
      // Provide a trace emitter that logs to stderr
      orchestratorOptions: {
        traceEmitter: (event) => {
          const summary = event.summary || '';
          this.outputStream.write(`[TRACE] ${event.type} ${summary}\n`);
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
              this.outputStream.write(event.content);
            } else if (event.type === 'final') {
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

if (require.main === module) {
  const cli = new Interface();
  cli.init();
} else {
  module.exports = Interface;
}
