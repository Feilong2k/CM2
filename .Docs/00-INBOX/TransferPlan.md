Given everything you’ve seen and the current behavior, starting fresh is a reasonable call. The important thing is: don’t throw away the parts we’ve already proven; use them as the core of the new system and drop the fragile layers.

Here’s how I’d structure the restart and what to port.

---
## 1. What to keep (proven, worth porting)

These are the “known-good” building blocks you should carry into the new codebase (or a clean sub-project inside this repo):

### 1.1 DeepSeek + tools probes
- [] `backend/scripts/deepseek_tool_probe.js`  
  - Direct DeepSeek API call + tools; we know this path works.
- []`backend/scripts/probes/probe_db_tools.js`
- [x]`backend/scripts/probes/probe_fs_tools.js`
- [x]`backend/scripts/probes/probe_runner.js` (for orchestration patterns if useful).

### 1.2 Database layer
- DB config + migrations:
  - `backend/config/db.js`
  - `backend/migrations/` (at least those that define projects/features/tasks/subtasks, chat_messages, trace_events).
- Tools:
  - `backend/tools/DatabaseTool.js`
  - `backend/tools/ActivityLogTool.js`
  - `backend/tools/DatabaseToolAgentAdapter.js`

### 1.3 Filesystem & search tools
- [x]`backend/tools/FileSystemTool.js`
- [x]`backend/tools/list_files.js`
- [x]`backend/tools/search_files.js`
- [x]`backend/tools/ignore_utils.js`

These are already rooted at the repo root and behaving correctly.

### 1.4 Tool orchestration
- [x]`backend/tools/functionDefinitions.js`
- [x]`backend/tools/ToolRunner.js`
- (Optionally) `backend/tools/registry.js` if you want a central place to map mode→tools.

These give you a clean, reusable bridge from DeepSeek’s `tool_calls` JSON to real JS methods.

### 1.5 DeepSeek adapter
- `backend/src/adapters/DS_ReasonerAdapter.js`
  - Already proven to parse `tool_calls`, handle `reasoning_content`, and stream.

### 1.6 Trace model
- `backend/migrations/007_trace_events.sql`
- `backend/src/services/trace/TraceService.js`
- `backend/src/services/trace/TraceConfig.js`

You’ll want trace events in the new system as well; these pieces are now in good shape.

### 1.7 Prompts & docs (design, not code)
- `docs/00-INBOX/Orion_Tool_Status_Analysis.md`
- `docs/10-TOOLS/Orion_Tool_Execution_Guide.md`
- Agent prompts:
  - `docs/01-AGENTS/01-Orion/...`
  - `docs/01-AGENTS/02-Adam/...`
  - `docs/01-AGENTS/03-Tara/...`
  - `docs/01-AGENTS/04-Devon/...`

These should guide the new design, but you don’t have to reuse the existing runtime patterns.

---
## 2. What to deliberately **not** carry over (or only use as reference)

These are the pieces that have caused the most complexity/drift and are safe to treat as **reference only** in the new start:

- `backend/src/agents/OrionAgentV2.js`
- `backend/src/agents/protocols/StandardProtocol.js`
- `backend/src/agents/protocols/TwoStageProtocol.js`
- `backend/src/services/context/ContextService.js`
- All the older archive orchestrators under `backend/archive/agents` and `backend/archive/services/two-stage`.

You can read them for ideas, but don’t port them as-is. The new system should start with a much thinner agent loop on top of DS_ReasonerAdapter + ToolRunner.

---
## 3. How to rebuild, step-by-step

If you’re ready to start fresh, I’d do it in this order:

1. **Create a clean “core” backend folder** (or a new repo) that only contains:
   - DB config + migrations.
   - Tools (DB + FS + ToolRunner + functionDefinitions).
   - DS_ReasonerAdapter.
   - A single `app_probe.js` script that:
     - Accepts a text prompt.
     - Calls DeepSeek with tools.
     - Executes tool_calls via ToolRunner.
     - Prints final content + tool traces.

2. **Get probes green first** in the new setup:
   - Use `deepseek_tool_probe.js` as the template.
   - Extend it to include FileSystemTool and DatabaseTool.

3. **Add a very thin agent loop**:
   - No StandardProtocol / OrionAgentV2.
   - Just a simple `while (turn < N)` around `DS_ReasonerAdapter.sendMessagesStreaming` + ToolRunner.
   - Keep it in one file until the behavior feels right.

4. **Only then add routes/UI**:
   - A minimal `/plan` endpoint that:
     - Calls the thin agent loop.
     - Streams back chunks and a final answer.

From there, we can grow a new “Orion” around this simpler, proven core instead of fighting the existing layers.

If you’d like, the next concrete thing I can do is: draft a minimal architecture outline for this new core (files, responsibilities) so Devon can spin it up in a small subfolder without touching the existing backend until you’re happy with the replacement.
