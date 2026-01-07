/**
 * Function Definitions for LLM Function Calling
 *
 * This file defines all available tools as OpenAI-compatible function definitions.
 * The LLM will use these to select and call the appropriate tool.
 *
 * Format: https://platform.openai.com/docs/guides/function-calling
 */

const functionDefinitions = [
  // ==================== DatabaseTool (Semantic + Safe-SQL) ====================
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_get_subtask_full_context',
      description: 'Get full workflow context for a subtask (basic_info, instruction, pcc, tests, implementations, review, activity_log).',
      parameters: {
        type: 'object',
        properties: {
          subtask_id: {
            type: 'string',
            description: 'Subtask ID: numeric id, full external_id (P1-F2-T0-S7), or shorthand (2-0-7).'
          },
          project_id: {
            type: 'string',
            description: 'Project external id (e.g., P1). Optional when subtask_id is already full.'
          }
        },
        required: ['subtask_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_list_subtasks_for_task',
      description: 'List subtasks under a given task, optionally filtered by status and including full details.',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'Task ID: numeric id, full external_id (P1-F2-T0), or shorthand (2-0).'
          },
          status: {
            type: 'string',
            description: 'Optional status filter (pending, in_progress, completed, blocked).'
          },
          include_details: {
            type: 'boolean',
            description: 'When true, include full JSONB sections for each subtask.'
          },
          project_id: {
            type: 'string',
            description: 'Project external id (e.g., P1). Optional when task_id is already full.'
          }
        },
        required: ['task_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_get_feature_overview',
      description: 'Get a high-level overview of a feature, including its tasks and each task’s subtasks.',
      parameters: {
        type: 'object',
        properties: {
          feature_id: {
            type: 'string',
            description: 'Feature ID: numeric id, full external_id (P1-F2), or shorthand (2).'
          },
          project_id: {
            type: 'string',
            description: 'Project external id (e.g., P1). Optional when feature_id is already full.'
          }
        },
        required: ['feature_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_list_subtasks_by_status',
      description: 'List subtasks filtered by status across the project.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: "Status to filter by (e.g., 'pending', 'in_progress', 'completed', 'blocked')."
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (optional, default: 50).'
          },
          project_id: {
            type: 'string',
            description: 'Project external id (e.g., P1). Optional; defaults to P1.'
          }
        },
        required: ['status']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_search_subtasks_by_keyword',
      description: "Search subtasks by keyword in title or basic_info. Useful when you don't remember the exact subtask ID but know what it's about.",
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: "Keyword to search for (e.g., 'database', 'postgres', 'tools')."
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (optional, default: 20).'
          },
          project_id: {
            type: 'string',
            description: 'Project external id (e.g., P1). Optional; defaults to P1.'
          }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_update_subtask_sections',
      description: 'Atomically update multiple sections of a subtask (status, workflow_stage, basic_info, instruction, pcc, tests, implementations, review) with logging.',
      parameters: {
        type: 'object',
        properties: {
          subtask_id: {
            type: 'string',
            description: 'Subtask ID: numeric id, full external_id, or shorthand (2-0-6).'
          },
          changes: {
            type: 'object',
            description: 'Object of sections to update (keys: workflow_stage, status, basic_info, instruction, pcc, tests, implementation, review).',
            additionalProperties: true
          },
          reason: {
            type: 'string',
            description: 'Reason for the change for activity logging.'
          }
        },
        required: ['subtask_id', 'changes']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_update_feature_sections',
      description: 'Atomically update sections of a feature (status, basic_info, pcc, pvp_analysis, fap_analysis) with logging.',
      parameters: {
        type: 'object',
        properties: {
          feature_id: {
            type: 'string',
            description: 'Feature ID: numeric id, full external_id, or shorthand (2).'
          },
          changes: {
            type: 'object',
            description: 'Object of sections to update (keys: status, basic_info, pcc, pvp_analysis, fap_analysis, activity_log).',
            additionalProperties: true
          },
          reason: {
            type: 'string',
            description: 'Reason for the change for activity logging.'
          }
        },
        required: ['feature_id', 'changes']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_update_task_sections',
      description: 'Atomically update sections of a task (status, basic_info, pcc, pvp_analysis) with logging.',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'Task ID: numeric id, full external_id, or shorthand (2-0).'
          },
          changes: {
            type: 'object',
            description: 'Object of sections to update (keys: status, basic_info, pcc, pvp_analysis, activity_log).',
            additionalProperties: true
          },
          reason: {
            type: 'string',
            description: 'Reason for the change for activity logging.'
          }
        },
        required: ['task_id', 'changes']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_create_feature',
      description: 'Create a new feature under a project, with optional explicit external_id.',
      parameters: {
        type: 'object',
        properties: {
          project_id: {
            type: 'string',
            description: 'Project external id (e.g., P1).'
          },
          external_id: {
            type: 'string',
            description: 'Optional explicit external_id; if omitted, one is auto-generated.'
          },
          title: {
            type: 'string',
            description: 'Feature title.'
          },
          status: {
            type: 'string',
            description: 'Initial status (default: pending).'
          },
          basic_info: {
            type: 'object',
            description: 'Basic info JSONB payload.'
          },
          pcc: {
            type: 'object',
            description: 'PCC JSONB payload.'
          },
          cap: {
            type: 'object',
            description: 'CAP (pvp_analysis) JSONB payload.'
          },
          red: {
            type: 'object',
            description: 'RED (fap_analysis) JSONB payload.'
          },
          reason: {
            type: 'string',
            description: 'Reason for creation (for logging).'
          }
        },
        required: ['project_id', 'title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_create_task',
      description: 'Create a new task under a feature, with optional explicit external_id.',
      parameters: {
        type: 'object',
        properties: {
          feature_id: {
            type: 'string',
            description: 'Feature ID: numeric id, full external_id, or shorthand (2).'
          },
          external_id: {
            type: 'string',
            description: 'Optional explicit external_id; if omitted, one is auto-generated.'
          },
          title: {
            type: 'string',
            description: 'Task title.'
          },
          status: {
            type: 'string',
            description: 'Initial status (default: pending).'
          },
          basic_info: {
            type: 'object',
            description: 'Basic info JSONB payload.'
          },
          pcc: {
            type: 'object',
            description: 'PCC JSONB payload.'
          },
          cap: {
            type: 'object',
            description: 'CAP (pvp_analysis) JSONB payload.'
          },
          reason: {
            type: 'string',
            description: 'Reason for creation (for logging).'
          }
        },
        required: ['feature_id', 'title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_create_subtask',
      description: 'Create a new subtask under a task, with optional explicit external_id.',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'Task ID: numeric id, full external_id, or shorthand (2-0).'
          },
          external_id: {
            type: 'string',
            description: 'Optional explicit external_id; if omitted, one is auto-generated.'
          },
          title: {
            type: 'string',
            description: 'Subtask title.'
          },
          status: {
            type: 'string',
            description: 'Initial status (default: pending).'
          },
          workflow_stage: {
            type: 'string',
            description: 'Workflow stage (default: orion_planning).'
          },
          basic_info: {
            type: 'object',
            description: 'Basic info JSONB payload.'
          },
          instruction: {
            type: 'object',
            description: 'Instruction JSONB payload.'
          },
          pcc: {
            type: 'object',
            description: 'PCC JSONB payload.'
          },
          tests: {
            type: 'object',
            description: 'Tests JSONB payload.'
          },
          implementation: {
            type: 'object',
            description: 'Implementation JSONB payload.'
          },
          review: {
            type: 'object',
            description: 'Review JSONB payload.'
          },
          reason: {
            type: 'string',
            description: 'Reason for creation (for logging).'
          }
        },
        required: ['task_id', 'title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_delete_subtask',
      description: 'Delete a subtask by ID. Use with caution.',
      parameters: {
        type: 'object',
        properties: {
          subtask_id: {
            type: 'string',
            description: 'Subtask ID: numeric id, full external_id, or shorthand.'
          },
          reason: {
            type: 'string',
            description: 'Reason for deletion (for logging).'
          }
        },
        required: ['subtask_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_delete_task',
      description: 'Delete a task by ID. This will cascade to subtasks. Use with caution.',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'Task ID: numeric id, full external_id, or shorthand.'
          },
          reason: {
            type: 'string',
            description: 'Reason for deletion (for logging).'
          }
        },
        required: ['task_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_delete_feature',
      description: 'Delete a feature by ID. This will cascade to tasks and subtasks. Use with caution.',
      parameters: {
        type: 'object',
        properties: {
          feature_id: {
            type: 'string',
            description: 'Feature ID: numeric id, full external_id, or shorthand.'
          },
          reason: {
            type: 'string',
            description: 'Reason for deletion (for logging).'
          }
        },
        required: ['feature_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_safe_query',
      description: 'Execute a safe SQL query (subject to safety checks). Backed by DatabaseTool.query().',
      parameters: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description: 'The SQL query to execute. Must pass safety checks (no DROP/TRUNCATE, etc.).'
          },
          params: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional stringified query parameters.'
          }
        },
        required: ['sql']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_create_step',
      description: 'Create a new step record in the steps table for workflow tracking.',
      parameters: {
        type: 'object',
        properties: {
          project_id: {
            type: ['string', 'number'],
            description: 'Project ID: internal numeric ID or external ID (e.g., P1).'
          },
          subtask_id: {
            type: ['string', 'number'],
            description: 'Subtask ID: internal numeric ID or external ID (full or shorthand).'
          },
          step_number: {
            type: ['number', 'null'],
            description: 'Step number (integer). If null/undefined, will auto-increment for the subtask.'
          },
          step_type: {
            type: 'string',
            description: 'Step type: "implementation" or "test".'
          },
          assigned_to: {
            type: 'string',
            description: 'Assigned to: "TaraAider" or "DevonAider".'
          },
          file_path: {
            type: ['string', 'null'],
            description: 'Path to the file associated with the step (optional).'
          },
          instructions: {
            type: 'string',
            description: 'Step instructions/description.'
          },
          context_files: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of file paths for context (optional, default empty array).'
          },
          parent_step_id: {
            type: ['number', 'null'],
            description: 'Optional parent step internal ID (null if none).'
          },
          reason: {
            type: 'string',
            description: 'Reason for creation (used in activity log, optional).'
          }
        },
        required: ['project_id', 'subtask_id', 'step_type', 'assigned_to', 'instructions']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_update_step',
      description: 'Update an existing step record.',
      parameters: {
        type: 'object',
        properties: {
          step_id: {
            type: 'number',
            description: 'Internal step ID (numeric).'
          },
          updates: {
            type: 'object',
            description: 'Fields to update: instructions, status, context_files, attempt_count, last_error, file_path, step_type, assigned_to, parent_step_id.',
            additionalProperties: true
          },
          reason: {
            type: 'string',
            description: 'Reason for update (used in activity log, optional).'
          }
        },
        required: ['step_id', 'updates']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_get_step',
      description: 'Retrieve a single step by its internal ID.',
      parameters: {
        type: 'object',
        properties: {
          step_id: {
            type: 'number',
            description: 'Internal step ID (numeric).'
          }
        },
        required: ['step_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_list_steps_by_subtask',
      description: 'List all steps for a given subtask, ordered by step_number ascending.',
      parameters: {
        type: 'object',
        properties: {
          subtask_id: {
            type: ['string', 'number'],
            description: 'Subtask ID: internal numeric ID or external ID (full or shorthand).'
          },
          limit: {
            type: ['number', 'null'],
            description: 'Maximum number of steps to return (optional).'
          },
          offset: {
            type: ['number', 'null'],
            description: 'Number of steps to skip for pagination (optional).'
          }
        },
        required: ['subtask_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_get_steps_by_status',
      description: 'Filter steps by status, optionally filtered by project.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Status: "pending", "in_progress", "completed", or "failed".'
          },
          project_id: {
            type: ['string', 'null'],
            description: 'Project external ID (e.g., P1) or internal ID (optional).'
          },
          limit: {
            type: ['number', 'null'],
            description: 'Maximum number of steps to return (optional).'
          },
          offset: {
            type: ['number', 'null'],
            description: 'Number of steps to skip for pagination (optional).'
          }
        },
        required: ['status']
      }
    }
  },

  // ==================== FileSystemTool ====================
  {
    type: 'function',
    function: {
      name: 'FileSystemTool_read_file',
      description: 'Read the contents of a file within the project workspace (text only).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to read, relative to project root.'
          }
        },
        required: ['path']
      }
    }
  },
  // NOTE: FileSystemTool_write_to_file is removed to unhook it from Orion.
  {
    type: 'function',
    function: {
      name: 'FileSystemTool_list_files',
      description: 'List contents of a directory (optionally recursive). Respects .gitignore by default.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the directory to list, relative to project root.'
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to list recursively (default: true). Set false for a single directory level.'
          },
          no_ignore: {
            type: 'boolean',
            description: 'When true, do NOT apply .gitignore/default ignore rules (debug use only).'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'FileSystemTool_search_files',
      description: 'Search for a regex pattern across files in a directory tree. Respects .gitignore by default.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Root directory to search in, relative to project root.'
          },
          regex: {
            type: 'string',
            description: 'JavaScript RegExp pattern (string) to search for. The server compiles this with new RegExp(regex, "i").'
          },
          file_pattern: {
            type: 'string',
            description: 'Optional glob (e.g., *.js) to limit searched files. (May be ignored if not implemented server-side yet.)'
          },
          no_ignore: {
            type: 'boolean',
            description: 'When true, do NOT apply .gitignore/default ignore rules (debug use only).'
          }
        },
        required: ['path', 'regex']
      }
    }
  },

  // ==================== SkillTool ====================
  {
    type: 'function',
    function: {
      name: 'SkillTool_execute',
      description: 'Loads a SKILL.md by name and returns its frontmatter, body, and parameters.',
      parameters: {
        type: 'object',
        properties: {
          skill_name: {
            type: 'string',
            description: 'Name of the skill to execute (from SKILL.md frontmatter.name)',
          },
          parameters: {
            type: 'object',
            description: 'Optional parameters to pass to the skill (echoed back in result).',
            additionalProperties: true,
          },
        },
        required: ['skill_name'],
      },
    },
  },

  // ==================== WritePlanTool ====================
  // NOTE: WritePlanTool_execute removed - use WritePlanTool_begin for ALL file writes.
  // This ensures content is streamed outside JSON to avoid truncation issues.
  {
    type: 'function',
    function: {
      name: 'WritePlanTool_begin',
      description: 'Begin a new write session for safe multi-step file operations.',
      parameters: {
        type: 'object',
        properties: {
          target_file: {
            type: 'string',
            description: 'Target file path relative to project root.',
          },
          operation: {
            type: 'string',
            enum: ['create', 'append', 'overwrite'],
            description: 'Type of operation.',
          },
          intent: {
            type: 'string',
            description: 'Description of what this write session aims to achieve.',
          },
        },
        required: ['target_file', 'operation'],
      },
    },
  },
  // NOTE: WritePlanTool_finalizeViaAPI is intentionally NOT exposed as a tool.
  // Large content must flow through CLI buffering -> HTTP API, not through tool calls.
  // See ADR-2026-01-04-v3 and 2-3-11_WritePlanTool_MVP_Implementation.md
];

/**
 * Safely parse JSON arguments, attempting to repair common malformations
 * from DeepSeek Reasoner output.
 * @param {string} str - Raw arguments string
 * @returns {Object} Parsed arguments object
 */
function safeParseArgs(str) {
  if (typeof str !== 'string') {
    return str;
  }

  // Trim whitespace
  const trimmed = str.trim();
  if (trimmed === '') {
    return {};
  }

  // Helper function to escape control characters inside JSON string literals
  function escapeControlCharsInJsonStrings(jsonStr) {
    let result = '';
    let inString = false;
    let prevChar = '';
    for (let i = 0; i < jsonStr.length; i++) {
      const c = jsonStr[i];
      if (!inString) {
        result += c;
        if (c === '"' && prevChar !== '\\') {
          inString = true;
        }
      } else {
        // We are inside a string
        if (c === '\n' && prevChar !== '\\') {
          result += '\\n';
        } else if (c === '\r' && prevChar !== '\\') {
          result += '\\r';
        } else if (c === '\t' && prevChar !== '\\') {
          result += '\\t';
        } else if (c === '"' && prevChar === '\\') {
          // This is an escaped quote, keep it as is
          result += c;
        } else if (c === '\\' && prevChar === '\\') {
          // Double backslash, reset prevChar so we don't think the next char is escaped
          result += c;
          prevChar = ''; // Reset to avoid triple backslash issues
          continue;
        } else {
          result += c;
        }
        // Check for end of string
        if (c === '"' && prevChar !== '\\') {
          inString = false;
        }
      }
      prevChar = c;
    }
    return result;
  }

  // Attempt 1: Try normal JSON.parse
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Continue to repair attempts
  }

  // Attempt 2: Try escaping control characters in string literals
  try {
    const escaped = escapeControlCharsInJsonStrings(trimmed);
    return JSON.parse(escaped);
  } catch (e) {
    // Continue to other repair attempts
  }

  // Attempt 3: Missing braces, e.g., "path":"probe_plan_target.txt"
  // Try to wrap in braces if it looks like a JSON object but without braces
  if (trimmed.startsWith('"') && trimmed.includes(':') && !trimmed.startsWith('{')) {
    try {
      return JSON.parse(`{${trimmed}}`);
    } catch (e) {}
  }

  // Attempt 4: Single-quoted strings, e.g., {'path':'probe_plan_target.txt'}
  // Replace single quotes with double quotes
  const singleToDouble = trimmed.replace(/'/g, '"');
  try {
    return JSON.parse(singleToDouble);
  } catch (e) {}

  // Attempt 5: Unquoted keys, e.g., {path:"probe_plan_target.txt"}
  // This is not valid JSON but might be fixed by quoting keys
  const quotedKeys = trimmed.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
  try {
    return JSON.parse(quotedKeys);
  } catch (e) {}

  // Attempt 6: Missing quotes around value, e.g., {"path":probe_plan_target.txt}
  // Try to quote unquoted string values (but not numbers, booleans, null)
  // This regex attempts to find : followed by an unquoted string (letters, digits, underscores, dots, hyphens)
  // that is not a number, true, false, or null.
  const fixUnquotedValues = quotedKeys.replace(/:"([^"]*)"/g, (match, inner) => {
    // If the inner value looks like a number, boolean, or null, leave it quoted
    if (/^-?\d+(\.\d+)?$/.test(inner) || inner === 'true' || inner === 'false' || inner === 'null') {
      return match;
    }
    // Otherwise, ensure it's quoted (it already is in this match, so return as is)
    return match;
  });
  
  // Additional pass: find colon followed by unquoted value and quote it
  const finalAttempt = fixUnquotedValues.replace(/:([a-zA-Z_][a-zA-Z0-9_.-]*)(?=\s*[,}])/g, ':"$1"');
  try {
    return JSON.parse(finalAttempt);
  } catch (e) {}

  // If all else fails, log and return empty object
  console.error('Failed to parse tool arguments after repair attempts:', str.substring(0, 200));
  return {};
}

/**
 * Parse a function call response into tool/action/params
 * @param {Object} toolCall - The tool_call object from LLM response
 * @returns {Object} { tool, action, params }
 */
function parseFunctionCall(toolCall) {
  const functionName = toolCall.function?.name || toolCall.name;
  const rawArgs = toolCall.function?.arguments ?? toolCall.arguments ?? '{}';
  const args = typeof rawArgs === 'string' ? safeParseArgs(rawArgs) : rawArgs;

  if (!functionName) {
    throw new Error('Missing function name in tool call');
  }

  const parts = functionName.split('_');
  const tool = parts[0];
  const action = parts.slice(1).join('_');

  return {
    tool,
    action,
    params: args,
  };
}

module.exports = functionDefinitions;
module.exports.parseFunctionCall = parseFunctionCall;
module.exports.safeParseArgs = safeParseArgs;
