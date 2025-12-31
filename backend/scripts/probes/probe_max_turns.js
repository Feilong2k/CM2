// probe_max_turns.js
// Probe to verify max-turns prompt injection and final-answer generation in ToolOrchestrator

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

try {
  const { DS_ReasonerAdapter } = require('../../src/adapters/DS_ReasonerAdapter.js');
  const ToolOrchestrator = require('../../src/orchestration/ToolOrchestrator.js');
  const FileSystemTool = require('../../tools/FileSystemTool.js');
  const functionDefinitions = require('../../tools/functionDefinitions.js');

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

    // Collect traces and track max-turns prompt injection
    const traces = [];
    let maxTurnsPromptInjected = false;
    const traceEmitter = (event) => {
      traces.push(event);
      console.log('[Trace]', event.type, event.summary || '');
      if (event.type === 'max_turns_prompt_injected') {
        maxTurnsPromptInjected = true;
      }
    };

    // Instantiate orchestrator with maxTurns = 2
    const orchestrator = new ToolOrchestrator(adapter, toolRegistry, { maxTurns: 2, traceEmitter });

    // Define a multi-step file system task
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: "Create a file named 'multi_step_test.txt' with content 'Step 1', then read it back, then delete it." }
    ];

    // Run the orchestrator
    const stream = orchestrator.run(messages, tools);

    let finalEvent = null;
    let toolCallsAfterPrompt = false;

    for await (const event of stream) {
      if (event.type === 'final') {
        finalEvent = event;
        console.log('[FINAL ANSWER]', event.content);
      }
      if (maxTurnsPromptInjected && event.type === 'tool_call') {
        toolCallsAfterPrompt = true;
        console.log('[WARNING] Tool call after max-turns prompt:', event);
      }
      // Print all events for manual inspection
      console.log('[EVENT]', event);
    }

    // Check trace for max-turns reached
    const hasMaxTurnsReached = traces.some(t => t.type === 'max_turns_reached');
    const hasPromptInjected = traces.some(t => t.type === 'max_turns_prompt_injected');

    if (hasMaxTurnsReached && hasPromptInjected && finalEvent && !toolCallsAfterPrompt) {
      console.log('✅ Max-turns probe PASSED: Prompt injected, final answer generated, no tool calls after prompt.');
    } else {
      console.error('❌ Max-turns probe FAILED: Check trace above for details.');
      console.log('  hasMaxTurnsReached:', hasMaxTurnsReached);
      console.log('  hasPromptInjected:', hasPromptInjected);
      console.log('  finalEvent:', !!finalEvent);
      console.log('  toolCallsAfterPrompt:', toolCallsAfterPrompt);
      process.exit(1);
    }
  }

  main().catch((err) => {
    console.error('Error in main:', err);
    process.exit(1);
  });
} catch (err) {
  console.error('Failed to load required modules:', err);
  process.exit(1);
}
