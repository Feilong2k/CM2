// probe_orion_agent.js
// Standalone script to test OrionAgent with FileSystemTool

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

try {
  // Import required modules
  const OrionAgent = require('../../src/agents/OrionAgent.js');
  const FileSystemTool = require('../../tools/FileSystemTool.js');

  // Create tool registry
  const toolRegistry = { FileSystemTool };

  // Instantiate agent
  const agent = new OrionAgent({ toolRegistry });

  // Main async function
  async function main() {
    console.log('--- TEST 1: Greeting (Should NOT use tools) ---');
    await runTurn('Say hello and tell me what tools you have.');

    console.log('\n--- TEST 2: Simple Task (Should use tools) ---');
    await runTurn('List files in the current directory.');

    console.log('\n--- TEST 3: Multi-step Task (Should use multiple tools) ---');
    await runTurn('Create a file named "multi_step_test.txt" with content "Step 1 complete", read it back to confirm, and then delete it.');
  }

  async function runTurn(message) {
    console.log(`\nUser: "${message}"`);
    const stream = agent.processTaskStreaming(message);

    for await (const event of stream) {
      switch (event.type) {
        case 'chunk':
          process.stdout.write(event.content || '');
          break;
        case 'tool_call':
          console.log('\n[TOOL_CALL]:', event.tool, event.action);
          break;
        case 'tool_result':
          console.log('\n[TOOL_RESULT]:', event.success ? 'SUCCESS' : 'FAILURE');
          break;
        case 'final':
          console.log('\n[FINAL]:', event.content);
          break;
      }
    }
    console.log('\n-----------------------------------');
  }

  main().catch((err) => {
    console.error('Error in main:', err);
  });
} catch (err) {
  console.error('Failed to load required modules:', err);
}
