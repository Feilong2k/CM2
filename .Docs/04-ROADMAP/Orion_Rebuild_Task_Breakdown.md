# Orion Rebuild: Task Breakdown & Implementation Requirements

## Overview
This document breaks down the Orion rebuild into atomic tasks, each with clear implementation and test requirements. The sequence is designed to build a working system incrementally, with each phase delivering observable value.

**Core Principle:** Every feature must be **visible in the UI/CLI** (via trace logs) and **tested end‑to‑end** before moving to the next phase.

---

## Phase 1: Core Loop with Filesystem Tools & CLI
**Goal:** A working Orion that can be invoked via CLI, uses DeepSeek Reasoner via a thin adapter, executes filesystem tools, and streams trace events to the console.

### **Task 1.1: Thin DeepSeek Reasoner Adapter**
- **Overview:** Refactor `DS_ReasonerAdapter.js` to be a minimal, stateless module that only handles API communication (request formatting, response parsing). It must support streaming and non‑streaming calls, and correctly handle `reasoning_content` and `tool_calls`.
- **Technical Details:**
  - Input: array of messages (with optional `tool_calls`, `reasoning_content`), tools array (OpenAI‑style function definitions), options (temperature, max_tokens, etc.)
  - Output: structured response with `content`, `tool_calls`, `reasoning_content`, and streaming chunk iterator.
  - Must use the same environment variable (`DEEPSEEK_API_KEY`) and endpoint as the probe.
  - No tool‑execution logic; only API communication.
- **Acceptance Criteria (Tara):**
  - Unit tests for request formatting (includes `reasoning_content` when present).
  - Unit tests for parsing streaming and non‑streaming responses.
  - Integration test that calls the real API (with a mock key) and returns a valid response shape.
- **Dependencies:** Existing probe code (for API URL, headers).
- **Edge Cases:** Empty tool list, malformed API response, network timeout.
- **Decisions Locked:** Adapter must be lightweight and model‑agnostic in interface.
- **Incremental Probe:** Create `probe_fs_tools_adapter.js` that sends a simple chat message (no tools) using the new adapter and prints the response. This verifies the adapter works in isolation.

### **Task 1.2: Tool Orchestrator (Conversation Manager)**
- **Overview:** Create `ToolOrchestrator.js` that manages the multi‑turn loop: call adapter, execute tool calls via `ToolRunner`, append results, repeat until completion or max turns.
- **Technical Details:**
  - Constructor takes adapter instance, tool registry, and options (maxTurns, trace emitter).
  - `run(messages, tools)` method returns final content and array of trace events.
  - Each turn: call adapter → if `tool_calls` present, execute via `ToolRunner` → append tool results to messages → repeat.
  - Emits trace events for `llm_call`, `tool_call`, `tool_result`, `reasoning_content`.
- **Acceptance Criteria (Tara):**
  - Unit tests for a single‑turn loop (no tools).
  - Unit tests for a multi‑turn loop with mock tool calls.
  - Integration test with real adapter (using a mock LLM that returns a predefined tool call) and real `ToolRunner`.
- **Dependencies:** `DS_ReasonerAdapter`, `ToolRunner`, `functionDefinitions`.
- **Edge Cases:** Max turns exceeded, empty tool call array, tool execution error.
- **Decisions Locked:** Orchestrator must be separate from the adapter; trace events must be emitted for every step.
- **Incremental Probe:** Create `probe_fs_tools_orchestrator.js` that uses the adapter (from 1.1) and the orchestrator to run a single tool call (e.g., list_files). The probe must use the same system prompt and user prompt as the original probe, but only expects one tool call. This verifies the orchestrator can call tools and return results.

### **Task 1.3: OrionAgent (Thin Coordinator)**
- **Overview:** Create `OrionAgent.js` that composes the adapter, orchestrator, and tools into a single, easy‑to‑use class.
- **Technical Details:**
  - Constructor loads adapter, tool registry, and system prompt.
  - `processTask(userMessage)` method:
    1. Builds initial messages (system prompt + user message).
    2. Passes to orchestrator with appropriate tools (FileSystemTool only for now).
    3. Returns final content and trace events.
  - Must support streaming by delegating to the adapter’s streaming mode.
- **Acceptance Criteria (Tara):**
  - Unit test that `processTask` returns expected shape.
  - Integration test that runs a full filesystem task (list files) and verifies trace events.
- **Dependencies:** `ToolOrchestrator`, `DS_ReasonerAdapter`, `ToolRunner`.
- **Edge Cases:** Missing system prompt, empty tool registry.
- **Decisions Locked:** OrionAgent is the main entry point for the CLI and future UI.
- **Incremental Probe:** Create `probe_fs_tools_agent.js` that uses the OrionAgent to run the full original probe task (list, create, read). This probe must produce the same console output (including traces) as the original probe, but using the new agent.

### **Task 1.4: CLI Interface with Live Tracing**
- **Overview:** Create a CLI script (`bin/orion-cli.js`) that accepts a task description, runs OrionAgent, and streams trace events to the console in real time.
- **Technical Details:**
  - Uses `OrionAgent.processTask` (streaming mode).
  - Prints each trace event as it arrives (formatted for readability).
  - Final answer printed at the end.
  - Supports a `--debug` flag to show raw messages.
- **Acceptance Criteria (Tara):**
  - End‑to‑end test that runs the CLI with a simple task and captures output.
  - Test that trace events appear in the console in the expected order.
- **Dependencies:** `OrionAgent`, `DS_ReasonerAdapter`, `FileSystemTool`.
- **Edge Cases:** No input, SIGINT handling.
- **Decisions Locked:** CLI must show live traces, not just final output.
- **Incremental Probe:** Create `probe_fs_tools_cli.js` that runs the CLI with the same task as the original probe and verifies that the output includes trace events and the final answer. This probe can be a shell script that runs `node bin/orion-cli.js "task"` and checks the output.

### **Task 1.5: Integration Probe for Phase 1**
- **Overview:** Update `probe_fs_tools.js` to use the new `OrionAgent` (instead of the ad‑hoc `runProbe`). Verify that the probe still passes and that traces are visible.
- **Technical Details:** Replace the inner loop of `probe_fs_tools.js` with a call to `OrionAgent.processTask`.
- **Acceptance Criteria (Tara):** The probe runs without error and produces the same console output (including traces) as before.
- **Dependencies:** All Phase 1 components.
- **Edge Cases:** None.
- **Decisions Locked:** The probe is the canonical integration test for the core loop.

### **Task 1.7: Error Feedback and Skills for Tool Calls**
- **Overview:** Enhance the `ToolOrchestrator` to provide structured error feedback when tool execution fails (e.g., missing required parameters). Additionally, design a Skills folder structure (following Anthropic’s skill format) to dynamically load few‑shot examples and error‑recovery instructions.
- **Technical Details:**
  - Modify `ToolOrchestrator.run` to catch tool‑execution errors and inject a user‑friendly error message into the conversation (as a tool‑result message) before proceeding to the next turn.
  - Create a `SkillLoader` service that loads skills from `backend/skills/`. Each skill is a directory with `SKILL.md` (YAML frontmatter + instructions), scripts, and references.
  - Design a sample skill for “Tool‑call error recovery” that provides few‑shot examples of correct tool‑call JSON.
  - Integrate skill loading into `OrionAgent` so that skills can be activated based on context (e.g., after a tool‑call error).
- **Acceptance Criteria (Tara):**
  - Unit tests that verify error‑feedback messages are injected when a tool fails.
  - Unit tests for `SkillLoader` that load a sample skill and parse its metadata.
  - Integration test that uses the sample skill to recover from a missing‑parameter error.
- **Dependencies:** `ToolOrchestrator`, `ToolRunner`, `functionDefinitions`.
- **Edge Cases:** Skill file missing or malformed, error feedback loop (infinite retries).
- **Decisions Locked:** Error feedback must be generic (not tool‑specific) and based on the tool definition’s required parameters. Skills are loaded on‑demand and can be extended without code changes.
- **Incremental Probe:** Create `probe_error_feedback.js` that triggers a missing‑parameter error and verifies that the orchestrator injects a helpful error message and the model retries correctly.

### **Task 1.8: Interactive CLI with Conversation Memory**
- **Overview:** Transform the CLI from a single‑command executor into an interactive shell that maintains conversation context across multiple user inputs. The CLI will listen for user messages, send each to Orion, stream traces and responses, then wait for the next instruction until the user exits.
- **Technical Details:**
  - Replace the current argument‑based CLI with a readline interface that prompts the user (e.g., `> `).
  - Maintain an array of conversation messages (system prompt + all previous user and assistant messages, including tool results) across turns.
  - For each user input, append it to the message array, call `OrionAgent.processTask` (or directly `ToolOrchestrator.run`) with the accumulated messages, and stream events.
  - After the final response, add the assistant’s message(s) to the conversation array and prompt for the next user input.
  - Support special commands: `exit`, `quit`, `clear` (reset conversation), `history` (show recent messages).
  - Ensure trace events are displayed in real time (as in Task 1.4) and the final answer is printed.
- **Acceptance Criteria (Tara):**
  - End‑to‑end test that starts the interactive CLI, sends a sequence of commands, and verifies that the conversation context is preserved (e.g., a follow‑up question referencing earlier tool results).
  - Unit test for the readline wrapper and message‑array management.
  - Integration test that the CLI can handle multiple turns and correctly appends messages.
- **Dependencies:** `OrionAgent`, `ToolOrchestrator`, `DS_ReasonerAdapter`, `FileSystemTool`.
- **Edge Cases:** Empty input, SIGINT handling, malformed user command, context window limits (message array growing too large).
- **Decisions Locked:** The interactive CLI must maintain full conversation state in memory (not in database) for simplicity. It must remain compatible with the existing `--debug` flag.
- **Incremental Probe:** Create `probe_interactive_cli.js` that simulates a user session (using mocked stdin/stdout) and validates that multiple commands are processed correctly and context is retained.

---

## Phase 2: Database Tools Integration
**Goal:** Extend Orion to use DatabaseTool, verify with `probe_db_tools.js`, and enable CLI tasks that require database access.

### **Task 2.1: DatabaseTool Integration into Tool Registry**
- **Overview:** Ensure `DatabaseTool` is registered in the tool registry and its function definitions are correctly exposed.
- **Technical Details:** Update `functionDefinitions.js` and the tool‑registry wiring to include DatabaseTool methods.
- **Acceptance Criteria (Tara):** Unit tests that verify each DatabaseTool function definition matches the tool’s signature.
- **Dependencies:** Existing `DatabaseTool.js`.
- **Edge Cases:** Missing database connection, SQL errors.
- **Decisions Locked:** DatabaseTool must be usable alongside FileSystemTool.

### **Task 2.2: Probe Update for Database Tools**
- **Overview:** Update `probe_db_tools.js` to use the new `OrionAgent` and verify that database queries work.
- **Technical Details:** Similar to Task 1.5, but for database tools.
- **Acceptance Criteria (Tara):** Probe runs without error, prints trace events, and shows actual database results.
- **Dependencies:** Phase 1 components, DatabaseTool.
- **Edge Cases:** Empty database, connection failure.
- **Decisions Locked:** Database probe must be part of the continuous integration suite.

### **Task 2.3: CLI Support for Database Tasks**
- **Overview:** Extend the CLI to accept a `--mode` flag (or detect automatically) that includes DatabaseTool in the tool list.
- **Technical Details:** Modify `OrionAgent` constructor to accept a tool‑set configuration; CLI passes appropriate tools based on task.
- **Acceptance Criteria (Tara):** CLI can run a task like “list all open tasks for project 1” and show database results.
- **Dependencies:** OrionAgent, DatabaseTool.
- **Edge Cases:** No database configured, permission errors.
- **Decisions Locked:** CLI must be able to switch between tool sets.

---

## Phase 3: Persistence (Store Messages and Traces)
**Goal:** Store all LLM messages, tool calls, and trace events in the database, using the now‑verified DatabaseTool.

### **Task 3.1: Message & Trace Storage Service**
- **Overview:** Create `MessageStoreService` and `TraceStoreService` that use DatabaseTool to insert records into `chat_messages` and `trace_events` tables.
- **Technical Details:**
  - Services must be injectable into `OrionAgent` and `ToolOrchestrator`.
  - Each service provides async `insert` methods that accept the event object and return the stored record.
  - Must not break existing functionality when disabled.
- **Acceptance Criteria (Tara):** Unit tests for insertion, integration tests that verify records are created in the test database.
- **Dependencies:** DatabaseTool, existing database migrations.
- **Edge Cases:** Duplicate insertion, database downtime.
- **Decisions Locked:** Storage must be optional (configurable) and not block the main loop.

### **Task 3.2: Integrate Storage into Orchestrator**
- **Overview:** Modify `ToolOrchestrator` to call the storage services after each LLM call, tool call, and tool result.
- **Technical Details:** Pass storage services as dependencies to the orchestrator; emit events then store them.
- **Acceptance Criteria (Tara):** Integration test that runs a simple task and verifies records appear in the database.
- **Dependencies:** Task 3.1.
- **Edge Cases:** Storage failure (should not break the loop; errors should be logged but not thrown).
- **Decisions Locked:** Storage is best‑effort; the loop must continue even if storage fails.

### **Task 3.3: CLI with Persistent History**
- **Overview:** Update CLI to load previous messages/traces for the same project/session, enabling multi‑step conversations.
- **Technical Details:** Add a `--project-id` flag; CLI loads history from DB and prepends it to the messages.
- **Acceptance Criteria (Tara):** End‑to‑end test that runs two CLI commands in sequence and verifies the second command references the first.
- **Dependencies:** Task 3.1, 3.2.
- **Edge Cases:** No previous history, corrupt history.
- **Decisions Locked:** History loading must be opt‑in to keep the CLI simple.

---

## Phase 4: Context & Dynamic System Prompt
**Goal:** Build a dynamic system prompt that includes file‑tree context, recent history, and project state.

### **Task 4.1: File‑Tree Context Builder**
- **Overview:** Create `FileTreeContextBuilder` that generates a concise, flattened representation of the project’s file tree (similar to what `list_files` returns).
- **Technical Details:** Use `FileSystemTool.list_files` (or the underlying `list_files.js`) to get the tree, then flatten to a string.
- **Acceptance Criteria (Tara):** Unit tests for flattening; integration test that the builder returns a non‑empty string for the current project.
- **Dependencies:** FileSystemTool.
- **Edge Cases:** Empty directory, permission denied.
- **Decisions Locked:** The tree must be truncated if too large (configurable max lines).

### **Task 4.2: System Prompt Template with Slots**
- **Overview:** Create a system‑prompt template file (`backend/prompts/orion_system.md`) with placeholders for `{file_tree}`, `{history_summary}`, `{project_state}`.
- **Technical Details:** The template is a Markdown file with YAML frontmatter for metadata.
- **Acceptance Criteria (Tara):** Test that the template can be loaded and that placeholders are replaced correctly.
- **Dependencies:** None.
- **Edge Cases:** Missing template, malformed placeholders.
- **Decisions Locked:** System prompt is a file, not hard‑coded.

### **Task 4.3: Context Service (Unified)**
- **Overview:** Create `ContextService` that composes the file‑tree builder, message history, and project state into a single object used by `OrionAgent`.
- **Technical Details:** Service has a `buildContext(projectId)` method that returns the filled‑in system prompt and any additional context objects.
- **Acceptance Criteria (Tara):** Integration test that builds context for a real project and includes file tree and history.
- **Dependencies:** Tasks 3.1, 4.1, 4.2.
- **Edge Cases:** No project ID, empty history.
- **Decisions Locked:** Context building must be fast; cache where appropriate.

### **Task 4.4: Integrate Context into OrionAgent**
- **Overview:** Modify `OrionAgent` to use `ContextService` to generate the system prompt and initial messages.
- **Technical Details:** Agent passes projectId to context service, receives system prompt, and uses it for all turns.
- **Acceptance Criteria (Tara):** End‑to‑end test that a CLI task uses the dynamic system prompt (e.g., mentions a file from the tree).
- **Dependencies:** Task 4.3.
- **Edge Cases:** Context service failure (fallback to default prompt).
- **Decisions Locked:** The agent must be able to run without context (for backward compatibility).

---

## Success Metrics
Each phase is considered **complete** when:
1. All Tara tests pass (unit, integration, end‑to‑end).
2. The CLI can execute the phase’s core use case and **show live trace events**.
3. The corresponding probe (fs or db) runs successfully using the new components.
4. No regression in previous phases.

## Next Steps After Approval
1. Move this document to `.Docs/02‑ARCHITECTURE/` as the official plan.
2. Create individual Implementation Requirement documents for each task (for Devon) and Test Requirement documents (for Tara).
3. Begin Phase 1 with TDD: Tara writes tests, Devon implements.

---

*Document created by Adam (Architect) on 2025‑12‑30.*
