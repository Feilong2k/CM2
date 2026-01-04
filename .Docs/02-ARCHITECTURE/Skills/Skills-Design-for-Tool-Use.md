# Skills Design for Tool Use & Error Recovery

## Overview

This document extends ADR‑2025‑12‑29 (Modular Architecture with Agent Skills) by detailing the design of **tool‑use skills**—specifically skills that improve Orion’s ability to call tools correctly and recover from errors. The primary goal is to address the observed problem where DeepSeek Reasoner omits required parameters in tool calls, causing tool‑execution failures.

The design introduces:

1. A **Skill Loader** that discovers and loads skills on‑demand.
2. **Skill activation triggers** based on runtime events (e.g., tool‑call error, task description).
3. **Injection of skill content** (instructions, few‑shot examples) into the conversation to guide the model.
4. **Enhanced error feedback** in `ToolOrchestrator` that leverages skills to produce actionable error messages.

## Skill Directory Structure (Recap)

Each skill is a directory under `backend/skills/` with the following structure:

```
skill_name/
├── SKILL.md          # YAML frontmatter + detailed instructions
├── scripts/          # Optional executable helpers (JS/Python)
├── references/       # Static assets, templates, example files
└── (any other supporting files)
```

### SKILL.md Format

The `SKILL.md` file has two parts:

**Frontmatter (YAML):**
```yaml
---
name: tool_call_error_recovery
description: Provides guidance and few‑shot examples for recovering from tool‑call errors.
version: 1.0.0
author: Adam (Architect)
created: 2025-12-30
last_updated: 2025-12-30
dependencies: []
triggers:
  - tool_call_error
  - missing_parameter
  - invalid_tool_call
tags:
  - error-handling
  - tool-call
  - filesystem
  - recovery
---
```

**Body (Markdown):**
- Detailed operating instructions for Orion.
- Few‑shot examples of correct tool calls.
- Error‑feedback templates.
- Any other guidance the model needs to execute the skill.

## Skill Loader Service

### Responsibilities

1. **Scan the skills directory** at startup and index each skill’s metadata (name, description, triggers, tags).
2. **Provide a lookup method** `findSkills(trigger, context)` that returns matching skills for a given trigger and context.
3. **Load a skill’s full content** when requested, reading `SKILL.md` and any referenced scripts.
4. **Cache skill content** to avoid repeated file I/O.

### Interface

```javascript
class SkillLoader {
  constructor(skillsDir = 'backend/skills') { … }

  // Index all skills (call at startup)
  async indexSkills() { … }

  // Find skills by trigger (e.g., 'tool_call_error')
  async findSkills(trigger, context = {}) { … }

  // Load full skill content (including body and scripts)
  async loadSkill(skillName) { … }

  // Get all skill metadata (for UI/CLI)
  getAllSkillMetadata() { … }
}
```

## SkillLoader: How It Works & When It Activates

### Initialization (Startup)

When Orion starts (e.g., the CLI is invoked or the server boots), the `SkillLoader` performs a one‑time scan of the `backend/skills/` directory.

- **Step 1 – Discover skill directories**: Each subdirectory (e.g., `tool_call_error_recovery`) is considered a skill.
- **Step 2 – Parse frontmatter**: For each skill, read the `SKILL.md` file and extract the YAML frontmatter (name, description, triggers, tags, etc.).
- **Step 3 – Build an in‑memory index**: Store the metadata in a map keyed by trigger, so that later lookups are fast.
- **Step 4 – Cache**: Optionally cache the full content of frequently used skills to avoid repeated disk reads.

**Example index after startup:**
```javascript
{
  "tool_call_error": [
    { name: "tool_call_error_recovery", description: "...", tags: ["error-handling", "filesystem"] }
  ],
  "task_match": [
    { name: "file_scaffolding", description: "...", tags: ["vue", "component"] },
    { name: "database_query", description: "...", tags: ["sql", "query"] }
  ]
}
```

**Note:** The startup index is **backend‑only** and **not** sent to the LLM as part of the conversation context. Only when a skill is **activated** does its content get injected into the messages.

### Runtime Activation (When It Works)

The `SkillLoader` is invoked **whenever a trigger event occurs** during Orion’s execution. There are four primary triggers (defined in each skill’s frontmatter):

| Trigger | When It’s Invoked | Who Invokes It |
|---------|-------------------|----------------|
| `tool_call_error` | A tool execution fails (e.g., missing parameter, invalid argument). | `ToolOrchestrator` catches the error and calls `SkillLoader.findSkills('tool_call_error', context)`. |
| `task_match` | OrionAgent receives a new task and wants to see if any skills are relevant. | `OrionAgent` calls `SkillLoader.findSkills('task_match', { taskDescription: "..." })`. |
| `explicit_command` | The user explicitly says “use the file‑scaffolding skill.” | `OrionAgent` parses the command and calls `SkillLoader.findSkills('explicit_command', { command: "file_scaffolding" })`. |
| `turn_start` | At the beginning of each turn, for skills that need to inject context every turn (e.g., a “remember the project structure” skill). | `ToolOrchestrator` or `OrionAgent` calls `SkillLoader.findSkills('turn_start', { turnIndex: 0 })`. |

### Finding and Loading a Skill

When a trigger is fired, the caller passes a **context object** with additional information (e.g., `{ toolName: "FileSystemTool_list_files", error: "path is required" }`). The `SkillLoader` uses this context to filter and rank matching skills.

**`SkillLoader.findSkills(trigger, context)`**:
1. Look up the trigger in the index.
2. For each skill with that trigger, compute a relevance score (e.g., based on tags matching context fields).
3. Return the sorted list of skill metadata (most relevant first).

If the caller decides to use a skill, it calls **`SkillLoader.loadSkill(skillName)`**:
1. Check the in‑memory cache; if the skill’s full content is already cached, return it.
2. Otherwise, read the `SKILL.md` file, parse the frontmatter and body, and optionally load any referenced scripts.
3. Cache the result and return a structured object:
   ```javascript
   {
     name: "tool_call_error_recovery",
     metadata: { ... },  // frontmatter
     body: "## Purpose\n\nThis skill helps Orion recover...",  // markdown content after frontmatter
     scripts: { ... }    // loaded helper scripts (if any)
   }
   ```

### Integration with OrionAgent & ToolOrchestrator

#### OrionAgent
- At the start of `processTask()`, it can call `findSkills('task_match', ...)` to see if the user’s task matches any skill. If so, it loads the skill and injects the skill’s body (or a subset) as a system message.
- If the user explicitly requests a skill, OrionAgent loads it and injects it similarly.
- **Pre‑loading for known workflows**: OrionAgent can expose a `preloadSkills(skillNames)` method that loads the full skill content and holds it in memory before a step begins. This is useful for workflows that require specific skills upfront (e.g., “scaffold a Vue component” needs `file_scaffolding`).

#### ToolOrchestrator
- When a tool call fails, the orchestrator:
  1. Catches the error from `ToolRunner`.
  2. Calls `SkillLoader.findSkills('tool_call_error', { toolName, error, toolCall, turnIndex })`.
  3. If a matching skill is found, loads it and extracts the relevant example(s).
  4. Formats a **structured error message** using the skill’s guidance (instead of a generic “Error: …”).
  5. Injects that message as a tool‑result, allowing the model to retry in the same turn.

### Concrete Example: Missing Parameter Error

1. **Tool call fails** – `FileSystemTool_list_files` is called without a `path` parameter.
2. **ToolOrchestrator** catches the error (`"path is required"`).
3. **SkillLoader.findSkills** is called with trigger `'tool_call_error'` and context `{ toolName: 'FileSystemTool_list_files', error: 'path is required' }`.
4. The index returns the `tool_call_error_recovery` skill (because its triggers include `tool_call_error` and its tags include `filesystem`).
5. **ToolOrchestrator** loads the skill and extracts the example for `FileSystemTool_list_files`.
6. The orchestrator formats a detailed error message (as shown in the design) and injects it as a tool‑result.
7. The model receives the error, understands the missing parameter, and retries with `{ "path": "." }`.
8. **ToolRunner** executes successfully, and the loop continues.

### Timing Summary
- **Startup**: SkillLoader indexes all skills once.
- **Per task**: OrionAgent may invoke SkillLoader for `task_match` or `explicit_command`.
- **Per tool error**: ToolOrchestrator invokes SkillLoader for `tool_call_error`.
- **Per turn** (optional): Could invoke for `turn_start` if needed.

### Caching & Performance
- Indexing is cheap (only frontmatter is read).
- Full skill content is loaded lazily and cached, so repeated errors for the same tool do not cause repeated disk I/O.
- The cache can be cleared if skills are updated (e.g., in development, a file‑watcher could trigger a reload).

### Extensibility
Adding a new skill is as simple as creating a new directory with a `SKILL.md` file. No code changes are required—the SkillLoader will automatically discover it at next startup (or via a manual refresh).

## Design Details: Tracing, Pre‑loading, and Skill Granularity

### 1. Tracing Skill Loading
We can (and should) add a new trace event type, e.g., `skill_activated` or `skill_loaded`, that includes:
- `skillName`
- `trigger` (e.g., `tool_call_error`, `task_match`)
- `context` (the context that triggered it)
- `timestamp`

These trace events would be emitted by the `SkillLoader` (or the component that calls it) and would appear in the CLI output and be stored in the database alongside `llm_call`, `tool_call`, etc. This provides full observability into which skills are being used and why.

**Example trace event:**
```javascript
{
  type: 'skill_activated',
  timestamp: '2025‑12‑30T22:15:00.000Z',
  data: {
    skillName: 'tool_call_error_recovery',
    trigger: 'tool_call_error',
    context: { toolName: 'FileSystemTool_list_files', error: 'path is required' }
  }
}
```

### 2. Pre‑loading Skills for Known Workflows
When we have a workflow that requires specific skills (e.g., “scaffold a Vue component” needs the `file_scaffolding` skill), we can **pre‑load** those skills before the relevant step.

**Implementation approach:**
- Add a `preloadSkills(skillNames)` method to `OrionAgent` that loads the full skill content and holds it in memory.
- The workflow definition (e.g., a step in a task breakdown) can specify `requiredSkills: ['file_scaffolding', 'vue_component_pattern']`.
- Before executing that step, OrionAgent calls `preloadSkills` and then injects the skill content into the system prompt (or as a separate message) at the start of the step.
- This ensures Orion has the necessary guidance **before** it makes a mistake, reducing error‑recovery loops.

**Benefit:** Pre‑loading turns skills from a reactive fallback into a proactive guidance system, aligning with the “skill‑based orchestration” vision.

### 3. Skill Granularity: Tool‑Specific vs. General
**Professional recommendation:** **Start general, then specialize as needed.**

- **General error‑recovery skill** (already created): Covers missing/invalid parameters for **all** tools. It can be structured to include a **per‑tool example section** (like the current `tool_call_error_recovery` skill). This avoids creating a separate skill for each tool, which would lead to proliferation.
- **Task‑focused skills**: Create skills for **common user intentions**, not for individual tool errors. For example:
  - `file_search` – knows how to use `FileSystemTool_search_files` with appropriate regex patterns, how to navigate directories, etc.
  - `file_scaffolding` – knows how to create a new Vue component with proper imports, template, script, and style.
  - `database_query` – knows how to construct SQL‑like queries using `DatabaseTool` methods.
- **Rationale**: Skills should encapsulate **procedural knowledge** (how to accomplish a task) rather than just fixing tool‑call syntax. The model is more likely to follow a clear, task‑oriented example than a generic “remember to include the path parameter” reminder.

**Evolution strategy:**
1. Start with `tool_call_error_recovery` to address the immediate missing‑parameter issue.
2. As we observe recurring task patterns (e.g., users often ask “find all TODOs”), create a `file_search` skill that includes examples of searching with regex, filtering results, etc.
3. If a particular tool continues to cause errors even with the general skill, we can add a **tool‑specific sub‑section** within the general skill, not a separate skill.

## Skill Activation Triggers

Skills are activated based on **triggers** defined in the frontmatter. Triggers can be:

| Trigger | When Activated | Context Passed |
|---------|----------------|----------------|
| `tool_call_error` | A tool execution fails (e.g., missing parameter, invalid argument). | `{ toolName, error, toolCall, turnIndex }` |
| `task_match` | The user’s task description matches a skill’s description (via keyword/tag matching). | `{ taskDescription, projectId }` |
| `explicit_command` | The user explicitly requests a skill (e.g., “use the file‑scaffolding skill”). | `{ command, arguments }` |
| `turn_start` | At the beginning of each turn (for skills that need to inject context every turn). | `{ turnIndex, messages }` |

The `SkillLoader.findSkills` method uses the trigger and context to select the most relevant skill(s). If multiple skills match, they can be ordered by relevance or version.

## Integration Points

### 1. OrionAgent Integration

`OrionAgent` will be extended with:

- A `skillLoader` instance (injected via constructor).
- A method `activateSkills(trigger, context)` that:
  - Calls `skillLoader.findSkills()`.
  - Loads the skill content (if not already loaded).
  - Injects the skill’s instructions/examples into the system prompt **for the current turn only** (or appends a separate “skill” message).

**Example flow:**
```javascript
// Inside OrionAgent.processTask()
const skills = await this.skillLoader.findSkills('task_match', { taskDescription: userMessage });
if (skills.length > 0) {
  const skillContent = await this.skillLoader.loadSkill(skills[0].name);
  // Inject skill content into messages (e.g., as a system message)
  messages.push({ role: 'system', content: skillContent.body });
}
```

### 2. ToolOrchestrator Integration (Error Feedback)

`ToolOrchestrator` will be modified to:

- Catch tool‑execution errors.
- Emit a `tool_error` trace event.
- Call `OrionAgent.activateSkills('tool_call_error', { toolName, error, … })` to get error‑recovery guidance.
- **Inject a tool‑result message** that includes the error and the skill’s guidance (instead of a generic “Error: …”).
- Allow the model to retry the tool call in the same turn (if the error is recoverable).

**Example enhancement in `ToolOrchestrator._formatToolMessage`:**
```javascript
_formatToolMessage(toolCall, toolResult, skillGuidance = null) {
  if (!toolResult.success) {
    // If we have skill guidance, include it in the error message
    const errorMsg = skillGuidance 
      ? `Tool call failed: ${toolResult.error}\n\n${skillGuidance}`
      : `Error: ${toolResult.error}`;
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
      content: errorMsg
    };
  }
  // … success case unchanged
}
```

## Error Feedback Enhancement (Detailed)

### Current Problem

The `ToolOrchestrator` currently formats tool errors as `"Error: path is required"`. This is not actionable enough for the model to self‑correct.

### Proposed Solution

1. **Tool‑Error Interceptor**  
   In `ToolOrchestrator.run`, when `toolResults[i].success === false`, intercept the error and:
   - Extract the missing/invalid parameter from the error message (or by comparing the tool call with the tool definition).
   - Request error‑recovery skill(s) from the skill loader.
   - Format a **structured error message** that includes:
     - What went wrong.
     - Which parameters are required.
     - An example of a correct tool call (from the skill).
     - A suggestion to retry.

2. **Structured Error Format**  
   The error message should be a clear, natural‑language string that the model can parse, e.g.:

   ```
   Tool call to FileSystemTool_list_files failed because the 'path' parameter is missing.

   Required parameters for FileSystemTool_list_files:
   - path (string): the directory path to list, relative to project root.

   Example of a correct tool call:
   ```json
   {
     "tool_name": "FileSystemTool_list_files",
     "arguments": {
       "path": "."
     }
   }
   ```

   Please call the tool again with the 'path' parameter.
   ```

3. **Same‑Turn Retry**  
   The orchestrator can decide whether to allow a retry within the same turn. For missing‑parameter errors, it’s safe to let the model retry immediately. For other errors (e.g., file not found), the model may need to adjust its approach.

## Example Flow: Missing Parameter Error

1. **User asks:** “List files in current directory.”
2. **OrionAgent** builds initial messages and calls `ToolOrchestrator.run`.
3. **DeepSeek Reasoner** returns a tool call `FileSystemTool_list_files` with empty arguments (no `path`).
4. **ToolRunner** executes the tool and fails with error `"path is required"`.
5. **ToolOrchestrator** catches the error, calls `skillLoader.findSkills('tool_call_error', { toolName: 'FileSystemTool_list_files', error: 'path is required' })`.
6. **SkillLoader** returns the `tool_call_error_recovery` skill (which includes examples for `FileSystemTool_list_files`).
7. **ToolOrchestrator** formats a detailed error message using the skill’s example and injects it as a tool‑result message.
8. **Model receives** the detailed error, understands the missing parameter, and retries the tool call with `{ "path": "." }`.
9. **ToolRunner** executes successfully, and the loop continues.

## Next Steps

1. **Implement SkillLoader** – A lightweight service that reads skill directories and provides the above interface.
2. **Extend OrionAgent** – Add skill‑loading and injection logic.
3. **Enhance ToolOrchestrator** – Integrate error‑interception and skill‑based error formatting.
4. **Create a Probe** – `probe_error_feedback.js` that validates the error‑recovery flow.
5. **Define More Skills** – Start with `tool_call_error_recovery`, then add skills for common task patterns (e.g., `file_scaffolding`, `database_query`).

## Dependencies

- ADR‑2025‑12‑29 (Modular Architecture with Agent Skills) must be approved and followed.
- The existing tool registry and function definitions must be accessible to the skill loader (for validating required parameters).

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Skill loading adds latency | Cache skill content in memory; load only when triggered. |
| Skill injection bloats context window | Inject only the relevant parts of the skill (e.g., one example, not the entire SKILL.md). |
| Model ignores skill guidance | Design error messages to be concise and imperative; test with multiple prompts. |
| Skill proliferation | Enforce a skill‑review process; use tags and triggers to keep skills organized. |

## Conclusion

This design provides a structured way to encapsulate tool‑use knowledge and error‑recovery patterns as skills. By integrating skills into the tool‑calling loop, Orion can become more robust to model inconsistencies and provide a better user experience. The first skill (`tool_call_error_recovery`) will directly address the missing‑parameter issue observed in the CLI probe.

Once approved, this design will be broken down into implementation tasks for Devon (implementation) and Tara (testing).

---

*Design created by Adam (Architect) on 2025‑12‑30.*
