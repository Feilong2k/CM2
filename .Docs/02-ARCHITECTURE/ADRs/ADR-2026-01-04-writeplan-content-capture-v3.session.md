# ADR-2026-01-04-v3: WritePlanTool Large-Content Workflow via CLI/UI Session Controller (with Disk Persistence)

## Status
**Approved** - Technical Design Complete

## Context (Updated)
We introduced `WritePlanTool` to avoid fragile direct file-write tools (`write_to_file`, `replace_in_file`) and to centralize validation.

However, we still see failures when Orion tries to write **large content** (e.g., a 200+ line markdown doc) through OpenAI-style function calling:

### Observed failures
1. **Tool-call argument JSON truncation / invalid JSON**
   - DeepSeek streams tool calls and `function.arguments` as a JSON string.
   - When the payload is large (because it includes the full file content), the arguments often become truncated or malformed.
   - Result: `safeParseArgs()` fails, the tool receives `{}`, and the write fails before WritePlanTool can run.

2. **Trace persistence JSONB errors**
   - When tool execution fails, trace persistence can fail with Postgres JSON errors if payloads are not strictly JSON-serializable.

### Why WritePlanTool alone is insufficient
WritePlanTool makes the *write operation* safe and validated **once invoked**. But the current architecture still transports large content via `function.arguments` JSON, which is fragile for large payloads.

## Decision (Revised with Disk Persistence)
We will implement a **Session Controller** (CLI-based now, UI-compatible later) that collects large content outside of JSON tool-call arguments using a **hybrid approach**:

1. **Small JSON tool call** (`WritePlanTool_begin`) for metadata only
2. **Plain text streaming** for content through assistant text
3. **DONE + timer fallback** protocol for boundary detection
4. **Internal Node API** for finalization (not exposed as tool call)
5. **Disk persistence** for crash recovery and robustness

### Critical Design Principles
- **No content in tool calls**: Large content never passes through tool-call JSON serialization
- **Memory-first buffering**: Active streaming uses in-memory buffer for performance
- **Disk backup**: Content periodically saved to disk for crash recovery
- **Simple cleanup**: Automatic cleanup of session files after completion or timeout

## Protocol (Revised)

### 1. Session Start (Small JSON Tool Call)
```json
WritePlanTool_begin({
  "intent": "Create documentation file",
  "target_file": ".Docs/README.md",
  "operation": "create"
})
```
**Response:**
```json
{
  "session_id": "uuid",
  "stage": "awaiting_content",
  "session_dir": "logs/write_sessions/uuid",
  "instructions": "Now output content. End with DONE on its own line."
}
```

### 2. Content Streaming with Disk Persistence
- Orion outputs file content as normal assistant text (no JSON formatting)
- CLI buffers content in memory for immediate processing
- CLI periodically saves buffered content to disk (every 50 lines or 5 seconds)
- Disk file: `logs/write_sessions/<session_id>/content.txt`

### 3. Completion Detection
- **Preferred**: `DONE` on its own line triggers immediate finalization
- **Fallback**: 2-second idle timer prompts Orion: "If you're finished, reply DONE on its own line; otherwise continue"

### 4. Finalization (Internal Node API)
CLI calls:
```javascript
WritePlanTool.finalizeSession(session_id, disk_file_path)
```
This is **NOT** a tool call exposed to Orion. It's a direct Node function call that reads content from disk.

## Architecture

### Two Interface Patterns
1. **CLI Controller** (Current): Buffers content, saves to disk, calls internal API
2. **UI Controller** (Future): Same internal API, different frontend

### Session State Management (Hybrid)
- **In-memory buffer**: Active content streaming (fast, real-time)
- **Disk persistence**: Crash recovery (`logs/write_sessions/<session_id>/`)
  - `metadata.json`: Session metadata (intent, target_file, operation, timestamps)
  - `content.txt`: Buffered content (appended as received)
  - `state.json`: Current buffer state (position, size, last save)
- **Automatic cleanup**: After successful write or timeout (1 hour)

### Internal APIs (Not Exposed as Tools)
```javascript
// backend/tools/WritePlanTool.js
class WritePlanTool {
  // Public (exposed as tool)
  begin({ intent, target_file, operation }) {
    // Generate session ID, create session directory
    // Save metadata to disk
    return { session_id, stage: 'awaiting_content', session_dir }
  }
  
  // Internal (called by CLI/UI controller)
  finalizeSession(session_id, disk_file_path) {
    // Read content from disk file
    // Validate, repair, write using existing ContentValidationHelper
    // Clean up session directory
    return { success: boolean, errors: [], validation_summary: {} }
  }
}
```

## Implementation Plan

### Phase 1: Backend APIs with Disk Support
1. Add `WritePlanTool.begin()` method (tool-exposed) with disk session creation
2. Add `WritePlanTool.finalizeSession()` method (internal) that reads from disk
3. Update `functionDefinitions.js` to expose only `WritePlanTool_begin`
4. Add session directory management utilities

### Phase 2: CLI Controller with Hybrid Buffering
1. Add session state tracking in `bin/orion-cli.js`
2. Implement in-memory buffering with periodic disk saves
3. Add DONE detection and timer fallback
4. Call `finalizeSession()` with disk file path when ready
5. Add crash recovery on CLI start (check for orphaned sessions)

### Phase 3: Validation Integration
1. Integrate with existing `ContentValidationHelper` repair loop
2. Ensure trace persistence handles JSONB safely
3. Add session-specific logging to disk

### Phase 4: Cleanup and Maintenance
1. Implement automatic cleanup of old session directories
2. Add CLI commands for session management (list, clean, recover)
3. Document recovery procedures

## Consequences

### Positive
- **Actually solves JSON fragility**: Large content never goes through tool-call JSON
- **Crash recovery**: Sessions survive CLI/network issues
- **Professional UX**: Users don't lose work
- **UI-compatible**: Same internal API works for CLI and future UI
- **Direct content transfer**: No JSON serialization of large content

### Negative
- **Increased complexity**: Need to manage disk files and cleanup
- **Disk I/O overhead**: Additional writes during streaming
- **More failure modes**: Disk full, permission issues

## Technical Details

### Content Flow with Disk Persistence
```
Orion → WritePlanTool_begin(small JSON) → CLI creates session directory
Orion → Plain text content → CLI buffers in memory
          ↓ Periodic save (every 50 lines/5s)
          → Disk file (logs/write_sessions/uuid/content.txt)
Orion → "DONE" → CLI detects → finalizeSession(disk_path) → File written
```

### Session Lifetime
- **Start**: `WritePlanTool_begin` tool call, directory created
- **Active**: Content streaming, in-memory buffer, periodic disk saves
- **Finalizing**: DONE detected, content read from disk, validation/write
- **Complete**: File written, session directory cleaned up

### Error Handling
1. **Validation errors**: Use existing repair loop (up to 3 attempts)
2. **Session timeout**: Clean up after 1 hour of inactivity
3. **CLI crash**: Session restored from disk on restart (orphan recovery)
4. **Disk full**: Fall back to in-memory only with warning

### Crash Recovery Protocol
1. On CLI start, check `logs/write_sessions/` for orphaned sessions
2. For each orphaned session:
   - If session is < 1 hour old: prompt user to recover
   - If session is > 1 hour old: auto-cleanup
3. Recovery option: "Recover previous write session? (Y/n)"

## Comparison to ADR v2

### What Changed
| ADR v2 | ADR v3 |
|--------|--------|
| In-memory only | Hybrid memory + disk |
| No crash recovery | Full crash recovery |
| Simple cleanup | Automatic cleanup with timeout |
| CLI crash loses work | CLI crash recovers work |

### Why This Is Better
1. **Professional robustness**: Matches user expectations for file operations
2. **Crash recovery**: Work isn't lost due to network issues or CLI crashes
3. **Future-proof**: Same model works for UI with longer sessions
4. **Minimal complexity added**: Disk operations are simple append/write

## Success Criteria

### Functional
- [ ] Large files (200+ lines) write successfully without JSON parse errors
- [ ] Orion can use `DONE` or wait for timer prompt
- [ ] Content validation/repair loop still works
- [ ] Crash recovery works (CLI restart recovers session)
- [ ] All existing tests pass

### Technical
- [ ] No `raw_content` parameter in any tool definition
- [ ] CLI buffers content and saves to disk periodically
- [ ] Session state managed appropriately (memory + disk)
- [ ] Automatic cleanup of old sessions
- [ ] No JSONB errors in trace persistence

### User Experience
- [ ] Orion receives clear instructions
- [ ] Timer fallback works naturally
- [ ] Crash recovery transparent or with clear prompts
- [ ] Success/failure messages clear

## Next Steps

### Immediate (Adam)
1. Update implementation requirements document with v3 changes
2. Create detailed task breakdown for Tara/Devon
3. Review with Orion

### Short-term (Tara/Devon)
1. Tara: Write tests for new session APIs with disk persistence
2. Devon: Implement backend changes with session directory management
3. Devon: Implement CLI controller with hybrid buffering

### Long-term
1. UI controller implementation (when UI exists)
2. Enhanced session management CLI commands
3. Multi-session support (concurrent writes)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Disk I/O slows streaming | Buffer in memory, save periodically (not on every char) |
| Disk full errors | Fall back to in-memory with warning to user |
| Orphaned sessions accumulate | Automatic cleanup after 1 hour |
| File permission issues | Check on startup, warn user |
| Session recovery complexity | Keep recovery simple: prompt to continue or discard |

## Approved By
- **Adam (Architect)**: Technical design approved
- **Orion (Orchestrator)**: Protocol compatibility confirmed

---
**Version**: 3.0  
**Date**: January 4, 2026  
**Supersedes**: ADR-2026-01-04-v2.session.md


### **🔴 MVP REQUIRED FIXES:**

#### **1. HTTP API Communication Protocol** (MVP REQUIRED)
- **Issue:** How CLI talks to backend is unspecified
- **MVP Fix:** Design and implement HTTP REST API
- **Details:** `POST /api/write-session/finalize` endpoint
- **Priority:** **CRITICAL** - Blocks all implementation

#### **2. Size Limit with Clear Errors** (MVP REQUIRED)
- **Issue:** No limits on content size
- **MVP Fix:** Implement 10MB limit with descriptive error
- **Details:** Reject >10MB with "Content exceeds 10MB limit"
- **Priority:** **HIGH** - Safety requirement

#### **3. Basic Error Recovery** (MVP REQUIRED)
- **Issue:** No retry/fallback for validation failures
- **MVP Fix:** 2-attempt retry with user-friendly messages
- **Details:** Show validation errors, allow correction
- **Priority:** **HIGH** - UX requirement

#### **4. Session ID Management** (MVP REQUIRED)
- **Issue:** Session ID generation/tracking undefined
- **MVP Fix:** UUID v4 generation, basic session registry
- **Details:** Backend generates session_id, tracks active sessions
- **Priority:** **MEDIUM** - Core functionality

#### **5. Single Session Enforcement** (MVP REQUIRED)
- **Issue:** Concurrent writes not addressed
- **MVP Fix:** Allow only one active write session at a time
- **Details:** Reject new session if one is active
- **Priority:** **MEDIUM** - Simplifies MVP

---

### **🟡 DEFERRED TO WHEN UI IS ADDED:**

#### **1. CORS for UI Development** (DEFERRED)
- **Issue:** UI needs CORS to call backend
- **When to add:** When frontend UI development starts
- **Reason:** CLI doesn't need CORS

#### **2. Authentication for UI** (DEFERRED)
- **Issue:** No auth for UI
- **When to add:** When UI goes to production
- **Reason:** CLI uses localhost, no auth needed

---

### **🟢 FUTURE ENHANCEMENTS (NOT MVP):**

#### **1. Chunking for Large Files** (NOT MVP)
- **Issue:** Content >10MB not supported
- **Future Fix:** Implement streaming/chunking
- **Why Not MVP:** 10MB covers MVP use cases

#### **2. Disk Persistence for Crash Recovery** (NOT MVP)
- **Issue:** CLI crash loses content
- **Future Fix:** Save interim files to disk
- **Why Not MVP:** Acceptable risk for MVP

#### **3. Concurrent Session Support** (NOT MVP)
- **Issue:** Multiple simultaneous writes
- **Future Fix:** Support 5+ concurrent sessions
- **Why Not MVP:** MVP is single-session

#### **4. Rate Limiting** (NOT MVP)
- **Issue:** No rate limiting
- **Future Fix:** Implement request throttling
- **Why Not MVP:** Internal tool, low risk

#### **5. Advanced Telemetry & Logging** (NOT MVP)
- **Issue:** No detailed session logging
- **Future Fix:** Add comprehensive logging
- **Why Not MVP:** Basic console logging sufficient

#### **6. Exponential Backoff Retry** (NOT MVP)
- **Issue:** Simple retry vs sophisticated backoff
- **Future Fix:** Implement exponential backoff
- **Why Not MVP:** Fixed delay retry works

#### **7. Configuration System** (NOT MVP)
- **Issue:** Hardcoded values
- **Future Fix:** Config file support
- **Why Not MVP:** Hardcoded values fine for MVP

#### **8. Content Format Validation** (NOT MVP)
- **Issue:** No formatting guidelines
- **Future Fix:** Advanced content validation
- **Why Not MVP:** Basic validation sufficient

#### **9. Memory Monitoring** (NOT MVP)
- **Issue:** No memory usage tracking
- **Future Fix:** Implement memory monitoring
- **Why Not MVP:** Size limit provides protection

---

## 🎯 **MVP IMPLEMENTATION CHECKLIST (SIMPLIFIED):**

### **HTTP API Design (MVP):**
1. [ ] `POST /api/write-session/begin` - Start session, returns session_id
2. [ ] `POST /api/write-session/finalize` - Submit content, returns validation result
3. [ ] `GET /api/write-session/status/:session_id` - Check session status
4. [ ] `DELETE /api/write-session/:session_id` - Cancel session
5. [ ] **NO CORS** - CLI only for MVP

### **Size Limits (MVP):**
1. [ ] 10MB maximum content size validation
2. [ ] Clear error message: "Content exceeds 10MB limit"
3. [ ] Request body size limit in Express

### **Error Recovery (MVP):**
1. [ ] 2 retry attempts for validation failures
2. [ ] User-friendly error messages
3. [ ] Validation error details in response

### **Session Management (MVP):**
1. [ ] UUID v4 session_id generation
2. [ ] In-memory session registry
3. [ ] Single active session enforcement
4. [ ] 5-minute session timeout

### **CLI Integration (MVP):**
1. [ ] CLI buffers content in memory
2. [ ] CLI detects DONE marker
3. [ ] CLI calls HTTP API with buffered content
4. [ ] CLI displays API responses

### **Backend Validation (MVP):**
1. [ ] Preserve existing 2-3-10 repair loop
2. [ ] Run validation on submitted content
3. [ ] Return validation summary

---

## 📊 **MVP ARCHITECTURE (SIMPLIFIED):**

```
┌─────────┐    begin()    ┌─────────┐    HTTP POST    ┌──────────┐
│  Orion  │──────────────▶│   CLI   │────────────────▶│ Backend  │
│         │               │         │    (localhost)  │          │
│         │  plain text   │         │                 │          │
│         │──────────────▶│         │                 │          │
│         │               │         │                 │          │
│         │     DONE      │         │    finalize()   │          │
│         │──────────────▶│         │────────────────▶│          │
└─────────┘               └─────────┘                 └──────────┘
```

**No CORS needed** - CLI calls localhost directly

---

## 🔧 **TECHNICAL SPECIFICATIONS FOR ADAM (SIMPLIFIED):**

### **API Endpoints:**
```javascript
// 1. Begin Session
POST /api/write-session/begin
Body: { intent: string, target_file: string, operation: "create"|"overwrite"|"append" }
Response: { session_id: string, status: "active" }

// 2. Finalize Session
POST /api/write-session/finalize
Body: { session_id: string, content: string }
Response: {
  success: boolean,
  errors: string[],
  validation_summary: object,
  written_path: string
}

// 3. Session Status
GET /api/write-session/status/:session_id
Response: { session_id: string, status: "active"|"completed"|"failed", created_at: timestamp }

// 4. Cancel Session
DELETE /api/write-session/:session_id
Response: { success: boolean }
```

### **Constraints (MVP):**
1. **10MB limit** - Reject larger content immediately
2. **Single session** - Only one active write session allowed
3. **5-minute timeout** - Auto-cleanup inactive sessions
4. **NO CORS** - CLI-only for MVP

### **Error Messages:**
1. `"Content exceeds 10MB limit"`
2. `"Another write session is already active"`
3. `"Session not found or expired"`
4. `"Validation failed: [details]"`

---

## 🚀 **READY FOR ADAM:**

### **MVP Scope Summary:**
1. **HTTP API** for CLI communication
2. **10MB size limit** with clear errors
3. **Single session** at a time
4. **Basic error recovery** (2 retries)
5. **No CORS** (CLI-only for now)
6. **No authentication** (localhost only)
7. **In-memory sessions** (no persistence)

### **Deferred to UI Phase:**
1. CORS configuration
2. Authentication
3. UI-specific optimizations

### **Future Enhancements:**
1. Large file chunking (>10MB)
2. Disk persistence for crash recovery
3. Concurrent sessions
4. Advanced monitoring