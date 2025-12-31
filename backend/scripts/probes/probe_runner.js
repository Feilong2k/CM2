const path = require('path');
const dotenv = require('dotenv');

// Load .env from the backend directory (one level up from this file's directory)
const envPath = path.resolve(__dirname, '../../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

const ToolRunner = require('../../tools/ToolRunner');
const FileSystemTool = require('../../tools/FileSystemTool');
const DatabaseToolAgentAdapter = require('../../tools/DatabaseToolAgentAdapter');

// Build a minimal tool registry for FileSystemTool
const toolRegistry = {
  FileSystemTool: FileSystemTool.tools,
  DatabaseTool: DatabaseToolAgentAdapter
};

/**
 * Run a DeepSeek Capability Probe using direct API call.
 * @param {string} probeName - Name of the probe
 * @param {string} systemPrompt - System instruction
 * @param {Array} tools - List of tool definition objects (from functionDefinitions)
 * @param {string} userMessage - Initial user message
 * @param {Object} [options] - Additional options
 * @param {number} [options.maxTurns=5] - Maximum number of turns
 * @param {Object} [options.toolRegistry] - Custom tool registry (optional)
 */
async function runProbe(probeName, systemPrompt, tools, userMessage, options = {}) {
  console.log(`\n\n=== START PROBE: ${probeName} ===\n`);
  
  // Debug: log environment variables and .env loading
  console.log('Current working directory:', process.cwd());
  console.log('DEEPSEEK_API_KEY exists?', 'DEEPSEEK_API_KEY' in process.env);
  console.log('DEEPSEEK_API_KEY value:', process.env.DEEPSEEK_API_KEY ? '***' + process.env.DEEPSEEK_API_KEY.slice(-4) : 'undefined');
  
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('Error: DEEPSEEK_API_KEY not found in .env');
    return;
  }

  const maxTurns = options.maxTurns || 10;
  const useToolRegistry = options.toolRegistry || toolRegistry;
  
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  console.log(`[System Prompt]: ${systemPrompt.substring(0, 100)}...`);
  console.log(`[User Message]: ${userMessage}\n`);

  let turn = 0;
  while (turn < maxTurns) {
    turn++;
    console.log(`--- Turn ${turn} ---`);

    try {
      // Direct DeepSeek API call
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-reasoner',
          messages: messages,
          tools: tools.length > 0 ? tools : undefined,
          temperature: 0.0,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const choice = data.choices[0];
      const { content, tool_calls, reasoning_content } = choice.message;

      // Log Reasoning (Think Block)
      if (reasoning_content) {
        console.log(`[DeepSeek Reasoning]:\n${reasoning_content}\n`);
      }

      // Log AI response
      if (content) {
        console.log(`[DeepSeek Content]:\n${content}\n`);
      }

      // Construct assistant message
      const assistantMsg = { role: 'assistant' };
      if (content) assistantMsg.content = content;
      if (tool_calls && tool_calls.length > 0) assistantMsg.tool_calls = tool_calls;
      if (reasoning_content) assistantMsg.reasoning_content = reasoning_content;
      
      messages.push(assistantMsg);

      // Handle tool calls
      if (tool_calls && tool_calls.length > 0) {
        console.log(`[DeepSeek Tool Calls]: ${tool_calls.length} calls`);

        for (const call of tool_calls) {
          console.log(`  > Calling ${call.function.name}(${call.function.arguments})`);
          
          try {
            // Execute tool
            const results = await ToolRunner.executeToolCalls(
              useToolRegistry, 
              [call], 
              { projectId: 'PROBE', requestId: `probe-${Date.now()}` }
            );

            const result = results[0];
            const output = result.success ? result.result : JSON.stringify(result.error);
            
            console.log(`  < Result: ${typeof output === 'string' ? output.substring(0, 100) + (output.length > 100 ? '...' : '') : JSON.stringify(output)}`);

            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              name: call.function.name,
              content: typeof output === 'string' ? output : JSON.stringify(output)
            });

          } catch (err) {
            console.error(`  ! Tool Execution Error: ${err.message}`);
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              name: call.function.name,
              content: `Error: ${err.message}`
            });
          }
        }
      } else {
        // No tool calls - assume completion
        console.log('--- No tool calls, assuming sequence complete ---');
        break;
      }

    } catch (err) {
      console.error('API Error:', err);
      break;
    }
  }

  console.log(`\n=== END PROBE: ${probeName} ===\n`);
}

module.exports = { runProbe };
