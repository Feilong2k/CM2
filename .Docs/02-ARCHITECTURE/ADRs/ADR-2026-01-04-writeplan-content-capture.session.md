# ADR-2026-01-04: WritePlanTool Large-Content Workflow via CLI “Write Session Controller” (DONE + Timer Fallback)

## Status
Proposed / Draft

## Context
We introduced `WritePlanTool` to avoid fragile direct file-write tools (`write_to_file`, `replace_in_file`) and to centralize validation.

However, we still see failures when Orion tries to write **large content** (e.g., a 200+ line markdown doc) through OpenAI-style function calling.

### Observed failures
1. **Tool-call argument JSON truncation / invalid JSON**
   - DeepSeek streams tool calls and `function.arguments` as a JSON string.
   - When the payload is large (because it includes the full file content), the arguments often become truncated or malformed.
   - Result: `safeParseArgs()` fails, the tool receives `{}`, and the write fails before WritePlanTool can run.

2. **Trace persistence JSONB errors**
   - When tool execution fails, trace persistence can fail with Postgres JSON errors if payloads are not strictly JSON-serializable.

### Why WritePlanTool alone is insufficient
WritePlanTool makes the *write operation* safe and validated **once invoked**.
But the current architecture still transports large content via `function.arguments` JSON, which is fragile for large payloads.

## Decision
We will implement a **CLI-based Write Session Controller** to reliably collect large content outside of JSON tool-call arguments.

### Key idea
- Keep the questionnaire/tool-call payload small (intent + target file + operation).
- Collect the large content in normal assistant text streamed through the CLI.
- Use a hybrid “DONE preferred, timer fallback” protocol to finalize.

### Protocol (hybrid)
1. Orion starts a write session via a small tool call:
   - `WritePlanTool_begin({ intent, target_file, operation })`
2. Orion then outputs the file content as normal assistant text.
3. Orion should end with a line containing exactly:
   - `DONE`
   If `DONE` is detected, the CLI immediately finalizes.
4. If Orion finishes a message **without** `DONE`, the CLI starts an idle timer.
   - After `WRITE_SESSION_IDLE_MS` (default: **2000ms**), the CLI prompts Orion:
     - “If you’re finished, reply with DONE on its own line; otherwise continue.”

## Non-Goals
- We are **not** requiring XML tags.
- We are **not** trying to make tools long-running listeners inside the tool runtime.
- We are **not** changing the LLM provider protocol.

## Design Details

### Why CLI controller (not tool listener)
Tools are synchronous calls; they do not subscribe to future messages.
The CLI/controller is the natural place to implement a “short-term listener” behavior by:
- buffering assistant content
- detecting completion
- invoking finalize deterministically

### State machine
- `idle`
- `session_active.awaiting_content`
- `session_active.awaiting_done_or_more_content`
- `session_active.finalizing`
- `session_active.needs_corrections` (validation loop)
- `done`

### Validation + repair loop (existing 2-3-10 behavior)
Finalize calls into the existing validation/repair flow:
1. Chunk content internally
2. Validate UTF-8
3. If invalid symbols:
   - collect invalid positions + context
   - ask Orion for corrections (batched)
4. Retry up to 3 times
5. If still invalid: safe replacement
6. Write final content once

### Configuration
- `WRITE_SESSION_IDLE_MS` default **2000ms**
  - rationale: 500ms is too short and causes false positives; 2s provides a natural “pause” feel.

## Consequences

### Positive
- Avoids large JSON tool-call payloads entirely.
- Eliminates the primary cause of tool-call JSON parse failures.
- Matches the intended questionnaire UX (“tool chats with Orion on user’s behalf”) via the CLI controller.
- UI-compatible: a future UI can reuse the same controller pattern.

### Negative
- Requires CLI/controller changes (not purely a tool implementation).
- Adds a small protocol requirement (`DONE`), though timer fallback reduces user/agent burden.

## Should we add XML tags anyway?
XML tags are optional.

### Argument for NOT requiring XML
- Orion should not deal with formatting requirements.
- The CLI controller can capture content without tags.
- The hybrid DONE+timer flow already provides a reliable end condition.

### Argument for OPTIONAL XML (fallback)
- XML tags can make parsing unambiguous if multiple sessions or mixed content happen.
- Tags can be used as a **debug/escape hatch**:
  - if `DONE` is unreliable, tags provide an explicit boundary.

### Decision
Do **not require** XML.
Optionally allow XML/sentinel boundaries as a future enhancement, but keep the primary UX tagless.

## Implementation Plan (high-level)
1. Add `WritePlanTool_begin` and `WritePlanTool_finalize` APIs.
2. Implement CLI write-session controller in `bin/orion-cli.js`:
   - buffer assistant content while session active
   - detect DONE
   - start idle timer if DONE not present
   - trigger finalize
3. Ensure trace persistence always stores JSONB-safe data.
4. Add tests covering:
   - large content write without JSON tool-call args
   - DONE detection
   - timer fallback prompt
   - validation/repair loop

__“Session state persistence”__

- Decision: store session state in memory in CLI for MVP
- Optional enhancement: also mirror to `logs/write_sessions/<session_id>.json` for crash recovery and debugging



note: “XML/sentinel boundaries MAY be added later as an optional ‘strict mode’ for ambiguous cases.”

* Comparison to Cline: we adopted the same idea (plain-text channel), but moved boundary detection to the controller.”

To implement the ADR (“CLI write session controller” with `DONE` + timer fallback), you need changes in **three places**: tool API, CLI controller, and tests/guards.

## 1) Add new tool API endpoints (backend/tools/WritePlanTool.js)
Right now `WritePlanTool_execute` expects `{ plan: { operations: [{content: ...}] } }` which is where the large JSON payload breaks.

We need new actions that keep tool-call JSON small:

### A. `WritePlanTool_begin`
**Purpose:** Start a session with the questionnaire answers (intent, target_file, operation).

Input (small):
```json
{ "intent": "...", "target_file": "...", "operation": "create" }
```
Output:
```json
{ "session_id": "uuid", "stage": "awaiting_content", "target_file": "...", "operation": "create" }
```

Implementation:
- Generate session_id
- Persist session state (recommended: disk file under `logs/write_sessions/`)
- Return instructions like: “Now output content and end with DONE”

### B. `WritePlanTool_finalize`
**Purpose:** Accept raw content and run the 2-3-10 validation loop + write.

Input:
```json
{ "session_id": "uuid", "raw_content": "..." }
```
Output:
- structured report + error codes
- if invalid UTF-8 and needs Orion corrections, return:
  - stage: `needs_corrections`
  - invalid contexts
  - prompt text

Implementation:
- Load session state
- Build a Phase-1 plan internally: `{ operations:[{ type: operation, target_file, content: raw_content }] }`
- Run ContentValidationHelper loop (already exists)
- Write file once

### C. Wire into function definitions
Update `backend/tools/functionDefinitions.js` to include the new function definitions:
- `WritePlanTool_begin`
- `WritePlanTool_finalize`

Update `backend/tools/WritePlanTool.js` class wrapper to expose methods `begin()` and `finalize()`.

---

## 2) Implement CLI “write session controller” (bin/orion-cli.js)
This is the heart of the ADR.

### A. Add session state in the CLI
In interactive mode:
- Track `activeWriteSession`:
  - `sessionId`
  - `buffer` (string)
  - `idleTimer`
  - maybe `target_file` for prompts

### B. Detect session begin
When Orion triggers a `WritePlanTool_begin` tool call:
- CLI sees the tool_result response (contains session_id)
- set `activeWriteSession`
- tell the user/Orion: “Ok, now output content. End with DONE.”

### C. Capture content
While `activeWriteSession` is set:
- Append streamed assistant text to `buffer`

### D. DONE detection
After each assistant message completes:
- If buffer ends with a standalone `DONE` line (`/(\r?\n)DONE\s*$/`), then:
  - strip DONE
  - clear idle timer
  - call finalize (next step)

### E. Timer fallback
If the assistant message ended and no DONE:
- Start/reset timer: `WRITE_SESSION_IDLE_MS` default 2000ms
- When timer fires:
  - send a follow-up user prompt into Orion:
    “If you’re finished, reply DONE on its own line. Otherwise continue writing.”

### F. Finalize
When DONE confirmed:
- CLI issues the tool call `WritePlanTool_finalize` (small JSON) with:
  - `session_id`
  - `raw_content` from the buffer

If `finalize` returns `needs_corrections`:
- CLI asks Orion for corrections (as user message)
- then re-call finalize (attempt++), up to 3
- then fallback safe replacement

---

## 3) Fix trace JSONB persistence (recommended, since it’s still failing)
Even after fixing large content flow, trace inserts can still fail.

Update `backend/src/services/TraceStoreService.js` to ensure:
- `details`, `error`, `metadata` are JSON-serializable (e.g., `JSON.parse(JSON.stringify(...))`)
- optionally cast parameters to `::jsonb` in SQL

---

## 4) Tests
1) Unit tests for WritePlanTool begin/finalize
2) Integration test: CLI write session with large content
3) Regression test: existing `WritePlanTool.tracing.spec.js` still passes

---

## Minimal “first milestone”
If you want a fast first win:
1) Add `begin` + `finalize`
2) Implement CLI buffer + DONE detection (skip timer at first)
3) Then add timer + correction loop

If you want, I can now turn this into a Devon checklist with file-by-file diffs to implement.

Here’s a concise architectural summary of how Cline-style tooling addresses write-tool fragility around JSON arguments, and how that relates to what we’re doing.

## 1. The core problem

When you send **full file content inside `function.arguments` JSON**:
- Large strings get **truncated or malformed** by the model/transport.
- Hosts then see **invalid JSON**, so `safeParseArgs()` fails before the tool even runs.
- Even if parsing succeeds, persisting those huge JSON blobs (e.g., into traces) can cause **JSON/JSONB errors** or performance issues.

Your ADR is explicitly targeting this failure mode.

---

## 2. Cline’s pattern: keep JSON small, move content to plain text

Tools like Cline avoid fragility by **not sending big file content through tool-call JSON at all**.
Instead they:

1. **Use normal assistant text as the “content channel”**
   - The model prints the file content as plain text (often in a fenced code block), in the regular assistant message stream.
   - This stream is **not parsed as JSON**, so it’s much more tolerant of length and formatting.

2. **Use tools only for metadata / control, not payload**
   - Tool calls carry **small, stable JSON**: paths, operations, intent, maybe a content identifier.
   - Example shape (conceptually):
     - `{ "operation": "write", "target_file": "foo.md", "content_ref": "last_block" }`
   - The host/controller then **looks back at the assistant text** to get the actual content it should write.

3. **Let the controller be the stateful brain**
   - Cline’s `Task`/`ToolExecutor` layer:
     - Streams assistant output.
     - Recognizes when a tool call refers to recently streamed content.
     - Executes the write using the content it has just captured.
   - This keeps the tool protocol itself simple and JSON-safe, while the controller handles the messy, stateful part.

4. **Boundary detection is host-side, not model-side**
   - Cline relies on the host (VS Code extension) to decide **where the content starts/ends**, based on patterns (code fences, tool calls, etc.).
   - The model doesn’t have to construct a giant JSON string containing all content; it just prints content normally, then emits a small tool call.

Your ADR mirrors this pattern explicitly:
> “Comparison to Cline: we adopted the same idea (plain-text channel), but moved boundary detection to the controller.”

---

## 3. How this solves JSON fragility

By separating **content transport** from **tool metadata**:

- `function.arguments` stays **small and structurally simple** → far less likely to be truncated or malformed.
- Large content lives in **assistant text**, which is:
  - Already streamed, chunked, and tolerant of arbitrary length.
  - Not re-serialized as JSON by the host.
- Trace persistence only ever stores **small JSON** for tool events; it doesn’t try to shove 200+ lines of markdown into JSONB columns.

So the key idea is:
> **Never ask the model to embed large file contents directly inside the JSON arguments of a tool call.**
> Use plain text for content, and JSON tools only for control.

---

## 4. Mapping to your design (ADR-2026-01-04)

You’re effectively adopting the same strategy with a slightly different concrete protocol:

- **WritePlanTool_begin** (small JSON): `{ intent, target_file, operation }`
- **Content phase**: Orion streams the actual file content as assistant text via the CLI.
- **Completion signal**: `DONE` line + **idle timer fallback** in the CLI controller.
- **WritePlanTool_finalize** (small JSON): `{ session_id, raw_content }` – where `raw_content` is what the CLI already buffered from the plain-text stream.

So in short:

- **Cline’s solution**: Keep big content **out of tool-call JSON**, treat tools as control signals, and let a stateful controller harvest content from the normal text stream.
- **Your ADR**: Same pattern, but formalized as a **“write session controller”** with an explicit `begin`/`finalize` API and `DONE + timer` protocol.

This directly removes the root cause of JSON fragility for write tools.


## ⚠️ **CRITICAL ISSUES & CONCERNS:**

### **🚨 MAJOR PROBLEM: Still Sending Content in JSON!**

#### **The Fatal Flaw:**
```javascript
WritePlanTool_finalize({
  session_id: "uuid",
  raw_content: "..."  // ← STILL IN JSON! WILL STILL FAIL!
})
```

**This defeats the entire purpose!** If `raw_content` contains large content, it still goes through OpenAI's JSON serialization and will fail.

#### **What Cline Actually Does:**
1. **Tool call**: `{operation: "write", target_file: "..."}` (NO content)
2. **CLI** looks at **buffered plain text** (already captured)
3. **CLI** writes file directly (no tool call with content)

#### **What We Should Do:**
1. **Tool call**: `WritePlanTool_begin({...})`
2. **Orion**: Plain text content + `DONE`
3. **CLI**: Writes file directly (no `finalize` tool call with content)

---

### **🔧 ARCHITECTURAL MISMATCH:**

#### **Current ADR Design:**
```
Orion → begin(tool) → content(text) → DONE → finalize(tool with content) → Backend
```

#### **What Actually Works:**
```
Orion → begin(tool) → content(text) → DONE → CLI writes directly
```

**The `finalize` tool call with content is unnecessary and problematic.**

---

### **🔄 STATE MANAGEMENT COMPLEXITY:**

#### **Unnecessary Complexity:**
- **Session state persistence** (disk files, logs/write_sessions/)
- **Two-phase tool calls** (begin + finalize)
- **CLI-to-backend communication** for content

#### **Simpler Alternative:**
- **CLI buffers** content in memory
- **CLI writes** directly when `DONE` detected
- **Single tool call** (`begin`) for metadata only

---

## 💡 **PROPOSED SIMPLIFICATIONS:**

### **Option 1: CLI-Direct (Cleanest)**
```javascript
// Tool definition (ONLY metadata)
WritePlanTool_begin({
  intent: string,
  target_file: string,
  operation: "create" | "overwrite" | "append"
})

// No WritePlanTool_finalize needed!
```

**Workflow:**
1. Orion: `WritePlanTool_begin({...})`
2. Orion: Plain text content + `DONE`
3. CLI: Buffers, validates, writes directly
4. CLI: Shows success to user

### **Option 2: Confirmation-Only Finalize**
```javascript
WritePlanTool_finalize({
  session_id: "uuid"  // NO raw_content parameter!
})
```

**Workflow:**
1. Orion: `WritePlanTool_begin({...})`
2. Orion: Plain text content + `DONE`
3. CLI: Calls `finalize({session_id})` (content already buffered)
4. Backend: Retrieves content from CLI/disk, writes

---

## 🎯 **SPECIFIC CRITICISMS:**

### **1. Content Still in JSON (Critical)**
- **ADR says**: "Avoids large JSON tool-call payloads entirely"
- **Reality**: `finalize({raw_content: "..."})` IS a large JSON payload
- **Fix**: Remove `raw_content` from `finalize`

### **2. Over-Engineering**
- **Session persistence** to disk is unnecessary for MVP
- **Two-phase protocol** adds complexity
- **CLI-to-backend content transfer** adds failure points

### **3. Missing the Simplicity of Cline**
- **Cline**: Tool (metadata) → Content (text) → CLI writes
- **Our ADR**: Tool → Content → Tool (with content) → Backend → CLI
- **Extra hop** that doesn't add value

### **4. Trace Persistence Fix is Band-Aid**
- Fixing JSONB errors is good, but doesn't solve root cause
- Still trying to persist large content in traces
- Better to avoid large content in traces entirely

---

## 🚀 **RECOMMENDED CHANGES:**

### **Immediate (Before Implementation):**
1. **Remove `raw_content`** from `WritePlanTool_finalize` parameters
2. **Clarify** that CLI buffers content and passes it directly to backend
3. **Simplify** session state to in-memory only (no disk persistence)

### **Architectural Clarification:**
```javascript
// Current ADR (problematic):
WritePlanTool_finalize({
  session_id: "uuid",
  raw_content: "..."  // ← WILL FAIL
})

// Fixed ADR:
WritePlanTool_finalize({
  session_id: "uuid"  // ← CLI already has content
})
// OR: No finalize tool at all
```

### **Protocol Simplification:**
```
1. begin({metadata})           // Small JSON
2. content stream              // Plain text (no JSON)
3. DONE detection              // CLI boundary
4. CLI → Backend (direct)      // Content already buffered
5. Write file                  // Validation loop
```

---

## 📊 **RISK ASSESSMENT:**

### **If We Implement Current ADR:**
- **High risk**: `finalize({raw_content: "..."})` will still fail with large content
- **Medium risk**: Unnecessary complexity (session persistence, two-phase)
- **Low risk**: Timer fallback, validation loop (these are good)

### **If We Simplify:**
- **Low risk**: Matches Cline's proven approach
- **Low risk**: Fewer moving parts
- **High reward**: Actually solves the problem

---

## 7. Recommended corrections before implementation

If you agree, here’s how I’d update the design:

1. __Change the finalize API design__

   - Remove `raw_content` from any function-callable tool schema.

   - Either:

     - (a) drop `WritePlanTool_finalize` as a tool entirely and do CLI-direct writes, or
     - (b) keep `WritePlanTool_finalize({ session_id })` but make it an __internal Node API__, not exposed as an LLM tool.

2. __Clarify the data-flow in the ADR__

   - Explicitly document that:

     - Large content __only ever flows__ through: LLM ↔ CLI assistant text.
     - The LLM __never__ emits the content inside a tool call.
     - Any finalize/write step runs on the CLI/backend side using the CLI’s buffer, not provider JSON.

3. __Adjust the implementation plan__

   - Phase 1: still define session metadata APIs (small JSON).

   - Phase 3: adapt the CLI controller so that:

     - it directly invokes Node code to run the validation loop and write files,
     - or calls a backend endpoint that accepts content outside the LLM tooling channel.
