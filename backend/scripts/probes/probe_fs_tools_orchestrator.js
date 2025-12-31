// probe_fs_tools_orchestrator.js
// Standalone script to test ToolOrchestrator with file system tools.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

try {
  // Import required modules
  const { DS_ReasonerAdapter } = require('../../src/adapters/DS_ReasonerAdapter.js');
  const ToolOrchestrator = require('../../src/orchestration/ToolOrchestrator.js');
  const FileSystemTool = require('../../tools/FileSystemTool.js');
  const functionDefinitions = require('../../tools/functionDefinitions.js');

  // Check for API key
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn('Warning: DEEPSEEK_API_KEY is not set.');
  }

  async function main() {
    // Instantiate adapter
    const adapter = new DS_ReasonerAdapter();

    // Filter tools to only include FileSystemTool_* functions
    const tools = functionDefinitions.filter(def => 
      def.function.name.startsWith('FileSystemTool_')
    );

    // Create tool registry mapping
    const toolRegistry = {
      FileSystemTool: FileSystemTool
    };

    // Instantiate orchestrator
    const orchestrator = new ToolOrchestrator(adapter, toolRegistry, { maxTurns: 5 });

    // Define messages
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: "Create a file named 'orchestrator_test.txt' with content 'Hello Orchestrator', then read it back." }
    ];

    // Run the orchestrator
    const stream = orchestrator.run(messages, tools);

    // Iterate over events
    for await (const event of stream) {
      switch (event.type) {
        case 'tool_call':
          console.log(`TOOL_CALL: ${event.tool} - ${event.action}`, event.params);
          break;
        case 'tool_result':
          console.log(`TOOL_RESULT: ${event.success ? 'SUCCESS' : 'FAILURE'}`, event.result);
          break;
        case 'final':
          console.log('FINAL ANSWER:', event.content);
          break;
        default:
          console.log('EVENT:', event);
      }
    }
  }

  main().catch((err) => {
    console.error('Error in main:', err);
  });
} catch (err) {
  console.error('Failed to load required modules:', err);
}
