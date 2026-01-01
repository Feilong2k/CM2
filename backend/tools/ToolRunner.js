// Centralized tool execution helpers for all agents and adapters.
// This module is the single place that knows how to:
// - Parse an LLM tool_call (OpenAI-style function call)
// - Look up the correct tool implementation
// - Execute it with a shared context object
//
// Any adapter (DeepSeek, GPT-4.1, Gemini, etc.) that surfaces tool_calls
// in the standard shape can pass them through ToolRunner, so we don't need
// per-model or per-path (streaming vs non-streaming) tool wiring.

const { parseFunctionCall } = require('./functionDefinitions');
let TraceService = null;
try {
  TraceService = require('../src/services/trace/TraceService');
} catch (e) {
  // Mock TraceService for probes when not available
  TraceService = {
    logEvent: async (event) => {
      console.log('[TraceService Mock]', event.type, event.summary || '');
    }
  };
}

/**
 * Build a canonical signature for a tool call.
 * Normalizes arguments by deep-sorting keys and trimming strings.
 *
 * @param {string} toolName - Tool name (e.g., "DatabaseTool")
 * @param {string} action - Action name (e.g., "get_subtask_full_context")
 * @param {Object} params - Tool parameters
 * @param {string} projectId - Project ID from context
 * @returns {string} Canonical signature string
 */
function normalizePathForSignature(value) {
  if (value === undefined || value === null) return value;
  let p = String(value).trim();
  // normalize windows separators -> forward slashes
  p = p.replace(/\\/g, '/');
  // normalize common "current dir" variants
  if (p === '') p = '.';
  if (p === './') p = '.';
  // remove leading "./"
  if (p.startsWith('./')) p = p.slice(2);
  if (p === '') p = '.';
  // collapse duplicate slashes
  p = p.replace(/\/+/g, '/');
  // remove trailing slashes (but keep root '.' intact)
  if (p.length > 1) p = p.replace(/\/+$/g, '');
  return p;
}

function normalizeParamsForSignature(toolName, action, params) {
  const normalized = { ...(params || {}) };

  // Normalize common path-like params across tools so equivalent paths match.
  if (typeof normalized.path === 'string' || normalized.path !== undefined) {
    normalized.path = normalizePathForSignature(normalized.path);
  }

  // Normalize tool defaults so "omitted" == "default value" for dedupe.
  if (toolName === 'FileSystemTool' && action === 'list_files') {
    if (normalized.recursive === undefined) normalized.recursive = true;
    if (normalized.no_ignore === undefined) normalized.no_ignore = false;
  }

  if (toolName === 'FileSystemTool' && action === 'search_files') {
    if (normalized.no_ignore === undefined) normalized.no_ignore = false;
    // file_pattern is currently not implemented; treat undefined and null equivalently
    if (normalized.file_pattern === undefined) normalized.file_pattern = null;
  }

  return normalized;
}

function buildCanonicalSignature(toolName, action, params, projectId) {
  const deepSort = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(deepSort);

    const sorted = {};
    Object.keys(obj).sort().forEach((key) => {
      sorted[key] = deepSort(obj[key]);
    });
    return sorted;
  };

  const normalizeRecursive = (obj) => {
    if (typeof obj === 'string') return obj.trim();
    if (Array.isArray(obj)) return obj.map(normalizeRecursive);
    if (typeof obj === 'object' && obj !== null) {
      const result = {};
      for (const key in obj) {
        result[key] = normalizeRecursive(obj[key]);
      }
      return result;
    }
    return obj;
  };

  const normalizedParams = normalizeRecursive(deepSort(normalizeParamsForSignature(toolName, action, params || {})));

  return JSON.stringify({
    tool: toolName,
    action,
    params: normalizedParams,
    projectId: projectId || null,
  });
}

/**
 * Execute a single tool call against a tool registry.
 *
 * @param {Object} tools - Map of tool name -> implementation (e.g., from tools/registry.js)
 * @param {Object} toolCall - The tool_call object from the LLM
 * @param {Object} context - Shared context passed through to tools (projectId, requestId, etc.)
 * @returns {Promise<any>} The raw result returned by the tool implementation
 */
async function executeToolCall(tools, toolCall, context) {
  const { tool, action, params } = parseFunctionCall(toolCall);

  // Mark context so tools can avoid duplicate per-tool trace logging when ToolRunner is
  // already emitting centralized tool_call/tool_result events.
  const safeContext = { ...(context || {}), __trace_from_toolrunner: true };

  // Special case: DatabaseTool is sometimes passed as a class/adapter where methods are on prototype,
  // or as an instance. The registry might have it as `DatabaseTool: DatabaseToolAgentAdapter`.
  // However, function definitions use names like `DatabaseTool_get_feature_overview`.
  // The parser splits this into tool="DatabaseTool", action="get_feature_overview".
  
  let toolInstance = tools[tool];

  if (!toolInstance) {
     // Fallback 1: check if the tool name itself is a function in the registry (flat registry style)
     // e.g. if registry has "DatabaseTool_get_feature_overview": function(...)
     const fullName = `${tool}_${action}`;
     if (tools[fullName]) {
        toolInstance = { [action]: tools[fullName] };
     } else {
        // Fallback 2: Maybe the tool name in registry IS the base name (e.g. "DatabaseTool")
        // but it's an agent adapter that has the methods on himself or its prototype
        if (tools['DatabaseTool'] && tool === 'DatabaseTool') {
           toolInstance = tools['DatabaseTool'];
        } else {
           throw new Error(`Tool "${tool}" not found in tool registry`);
        }
     }
  }

  const fn = toolInstance && typeof toolInstance[action] === 'function'
    ? toolInstance[action].bind(toolInstance)
    : null;

  if (!fn) {
    // Debug info for DatabaseTool issues
    if (tool === 'DatabaseTool') {
       const availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(toolInstance));
       throw new Error(`Tool "${tool}" action "${action}" is not callable. Available methods: ${availableMethods.join(', ')}`);
    }
    throw new Error(`Tool "${tool}" action "${action}" is not callable`);
  }

  const toolArgs = { ...params, context: safeContext };

  try {
    return await fn(toolArgs);
  } catch (error) {
    throw new Error(`Tool "${tool}_${action}" execution failed: ${error.message}`);
  }
}

function safePreview(value, maxLen = 1200) {
  // In test environment, don't truncate to allow JSON parsing.
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }
  try {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'string') return value.length > maxLen ? value.slice(0, maxLen) + '…' : value;
    const json = JSON.stringify(value);
    if (typeof json !== 'string') return String(value);
    return json.length > maxLen ? json.slice(0, maxLen) + '…' : json;
  } catch (e) {
    return '[unserializable]';
  }
}

async function logToolTraceEvent({ projectId, requestId, type, toolName, summary, details, error, turnIndex }) {
  try {
    const event = {
      projectId,
      type,
      source: 'tool',
      timestamp: new Date().toISOString(),
      toolName,
      requestId,
      summary,
      details: {
        ...(details || {}),
        // include requestId in details so it shows up in TraceDashboard JSON view
        requestId: requestId || null,
      },
      error: error || undefined,
    };

    // Add turnIndex to top-level cycleIndex and details.turn if provided
    if (turnIndex !== undefined) {
      event.cycleIndex = turnIndex;
      event.details.turn = turnIndex;
    }

    await TraceService.logEvent(event);
  } catch (e) {
    // best effort; never break tool execution
  }
}

function isDeterministicNonRetryable(err) {
  const msg = (err && err.message) ? String(err.message) : '';
  if (/not found/i.test(msg)) return true;
  if (/MISSING_PROJECT_CONTEXT/i.test(msg)) return true;
  return false;
}

/**
 * Execute an array of tool calls and return structured results for logging/prompting.
 * Implements a simple retry policy per tool_call: up to maxAttempts, sequentially.
 *
 * @param {Object} tools - Map of tool name -> implementation
 * @param {Array} toolCalls - Array of tool_call objects from the LLM
 * @param {Object} context - Shared context passed through to tools
 * @returns {Promise<Array>} Array of { toolCallId, toolName, result|error, success, attempts, timestamp }
 */
async function executeToolCalls(tools, toolCalls, context) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return [];
  }

  const results = [];
  const maxAttempts = 3;

  for (const toolCall of toolCalls) {
    let toolNameLabel = 'unknown';
    let parsed = null;
    let canonicalSignature = null;

    try {
      parsed = parseFunctionCall(toolCall);
      const { tool, action, params = {} } = parsed;
      toolNameLabel = action ? `${tool}.${action}` : tool;
      canonicalSignature = buildCanonicalSignature(tool, action, params, context?.projectId || null);
    } catch (e) {
      // leave toolNameLabel as unknown
    }

    const projectId = context?.projectId || null;
    const requestId = context?.requestId || 'default';
    const turnIndex = context?.turnIndex;

    // Emit a centralized TOOL_CALL trace event as early as possible.
    await logToolTraceEvent({
      projectId,
      requestId,
      type: 'tool_call',
      toolName: toolNameLabel,
      summary: `Tool call: ${toolNameLabel}`,
      details: {
        toolName: parsed ? parsed.tool : 'unknown',
        function: parsed ? parsed.action : 'unknown',
        toolCallId: toolCall.id || null,
        params: parsed ? (parsed.params || {}) : {},
        args: parsed ? (parsed.params || {}) : {},
        canonicalSignature,
      },
      turnIndex,
    });

    let attempts = 0;
    let success = false;
    let finalResult;
    let finalError;

    const execStart = Date.now();

    while (attempts < maxAttempts && !success) {
      attempts += 1;
      try {
        finalResult = await executeToolCall(tools, toolCall, context);
        success = true;
      } catch (error) {
        console.error('Tool execution error in retry loop:', error);
        finalError = error;
        if (isDeterministicNonRetryable(error)) break;
        if (attempts >= maxAttempts) break;
      }
    }

    const execDurationMs = Math.max(0, Date.now() - execStart);

    if (success) {
      await logToolTraceEvent({
        projectId,
        requestId,
        type: 'tool_result',
        toolName: toolNameLabel,
        summary: `Tool result: ${toolNameLabel}`,
        details: {
          toolName: parsed ? parsed.tool : 'unknown',
          function: parsed ? parsed.action : 'unknown',
          success: true,
          toolCallId: toolCall.id || null,
          attempts,
          duration_ms: execDurationMs,
          result_preview: safePreview(finalResult),
          args: parsed ? (parsed.params || {}) : {},
        },
        turnIndex,
      });

      results.push({
        toolCallId: toolCall.id || null,
        toolName: toolNameLabel,
        result: finalResult,
        success: true,
        attempts,
        timestamp: new Date().toISOString(),
      });
    } else {
      const errMsg = finalError ? finalError.message : 'Unknown tool execution error';

      await logToolTraceEvent({
        projectId,
        requestId,
        type: 'tool_result',
        toolName: toolNameLabel,
        summary: `Tool failed: ${toolNameLabel}`,
        details: {
          toolName: parsed ? parsed.tool : 'unknown',
          function: parsed ? parsed.action : 'unknown',
          success: false,
          toolCallId: toolCall.id || null,
          attempts,
          duration_ms: execDurationMs,
          error: errMsg,
          result_preview: safePreview({ error: errMsg }),
          args: parsed ? (parsed.params || {}) : {},
        },
        error: { message: errMsg, code: 'TOOL_EXECUTION_FAILED' },
        turnIndex,
      });

      results.push({
        toolCallId: toolCall.id || null,
        toolName: toolNameLabel,
        error: errMsg,
        success: false,
        attempts,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}

module.exports = {
  executeToolCall,
  executeToolCalls,
  buildCanonicalSignature,
};
