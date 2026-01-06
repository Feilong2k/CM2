# ADR-2026-01-04-v2: WritePlanTool Large-Content Workflow via CLI/UI Session Controller

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

## Decision (Revised)
We will implement a **Session Controller** (CLI-based now, UI-compatible later) that collects large content outside of JSON tool-call arguments using a **hybrid approach**:

1. **Small JSON tool call** (`WritePlanTool_begin`) for metadata only
2. **Plain text streaming** for content through assistant text
3. **DONE + timer fallback** protocol for boundary detection
4. **Internal Node API** for finalization (not exposed as tool call)

### Critical Correction from v1
**`WritePlanTool_finalize` will NOT take `raw_content` as a JSON parameter.** Instead:
- CLI buffers content in memory during streaming
- CLI calls internal Node API with buffered content (direct function call, not via LLM tool channel)
- Backend processes validation/write without exposing large content to JSON serialization

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
  "instructions": "Now output content. End with DONE on its own line."
}
```

### 2. Content Streaming (Plain Text)
Orion outputs file content as normal assistant text (no JSON formatting).

### 3. Completion Detection
- **Preferred**: `DONE` on its own line triggers immediate finalization
- **Fallback**: 2-second idle timer prompts Orion: "If you're finished, reply DONE on its own line; otherwise continue"

### 4. Finalization (Internal Node API)
CLI calls:
```javascript
WritePlanTool.finalizeSession(session_id, buffered_content)
```
This is **NOT** a tool call exposed to Orion. It's a direct Node function call.

## Architecture

### Two Interface Patterns
1. **CLI Controller** (Current): Buffers content, calls internal API
2. **UI Controller** (Future): Same internal API, different frontend

### Session State Management
- **In-memory only** for MVP (CLI session lifetime)
- **Optional disk persistence** for crash recovery (future enhancement)
- **No database persistence** needed for session state

### Internal APIs (Not Exposed as Tools)
```javascript
// backend/tools/WritePlanTool.js
class WritePlanTool {
  // Public (exposed as tool)
  begin({ intent, target_file, operation }) {
    // Generate session ID, store metadata
    return { session_id, stage: 'awaiting_content' }
  }
  
  // Internal (called by CLI/UI controller)
  finalizeSession(session_id, raw_content) {
    // Validate, repair, write using existing ContentValidationHelper
    return { success: boolean, errors: [], validation_summary: {} }
  }
}
```

## Implementation Plan

### Phase 1: Backend APIs
1. Add `WritePlanTool.begin()` method (tool-exposed)
2. Add `WritePlanTool.finalizeSession()` method (internal only)
3. Update `functionDefinitions.js` to expose only `WritePlanTool_begin`

### Phase 2: CLI Controller
1. Add session state tracking in `bin/orion-cli.js`
2. Implement content buffering and DONE detection
3. Add timer fallback (2-second idle)
4. Call `finalizeSession()` directly when ready

### Phase 3: Validation Integration
1. Integrate with existing `ContentValidationHelper` repair loop
2. Ensure trace persistence handles JSONB safely
3. Add session-specific logging

### Phase 4: UI Compatibility Layer
1. Design abstraction for session controllers (CLI vs UI)
2. Create shared session management utilities
3. Document API for future UI implementation

## Consequences

### Positive
- **Actually solves JSON fragility**: Large content never goes through tool-call JSON
- **UI-compatible**: Same internal API works for CLI and future UI
- **Simpler protocol**: Single tool call for metadata
- **Direct content transfer**: No JSON serialization of large content

### Negative
- **Requires CLI changes**: Need to implement content buffering
- **Stateful controller**: CLI must manage session state
- **Two code paths**: Tool-exposed vs internal APIs

## Technical Details

### Content Flow
```
Orion → WritePlanTool_begin(small JSON) → CLI starts session
Orion → Plain text content → CLI buffers
Orion → "DONE" → CLI detects → finalizeSession(direct call) → File written
```

### Session Lifetime
- **Start**: `WritePlanTool_begin` tool call
- **Active**: Content streaming, buffering
- **Finalizing**: DONE detected, validation/write in progress
- **Complete**: File written, session cleaned up

### Error Handling
1. **Validation errors**: Use existing repair loop (up to 3 attempts)
2. **Session timeout**: Clean up after reasonable period (e.g., 5 minutes)
3. **CLI crash**: In-memory session lost (acceptable for MVP)

## Comparison to Original ADR

### What Changed
| Original ADR | Revised ADR |
|-------------|------------|
| `finalize({session_id, raw_content})` as tool call | `finalizeSession(session_id, content)` as internal API |
| Content passes through JSON twice | Content avoids JSON entirely |
| Two tool calls (begin + finalize) | One tool call (begin) only |
| Complex session persistence | Simple in-memory session |

### Why This Is Better
1. **Actually solves the problem**: No large content in tool-call JSON
2. **Matches Cline's approach**: Tools for control, text for content
3. **Future-proof**: Same API works for UI
4. **Simpler**: Fewer moving parts, less complexity

## Success Criteria

### Functional
- [ ] Large files (200+ lines) write successfully without JSON parse errors
- [ ] Orion can use `DONE` or wait for timer prompt
- [ ] Content validation/repair loop still works
- [ ] All existing tests pass

### Technical
- [ ] No `raw_content` parameter in any tool definition
- [ ] CLI buffers content and calls internal API
- [ ] Session state managed appropriately
- [ ] No JSONB errors in trace persistence

### User Experience
- [ ] Orion receives clear instructions
- [ ] Timer fallback works naturally
- [ ] Success/failure messages clear

## Next Steps

### Immediate (Adam)
1. Update implementation requirements document
2. Create detailed task breakdown for Tara/Devon
3. Review with Orion

### Short-term (Tara/Devon)
1. Tara: Write tests for new session APIs
2. Devon: Implement backend changes
3. Devon: Implement CLI controller

### Long-term
1. UI controller implementation (when UI exists)
2. Session persistence for crash recovery
3. Multi-session support (concurrent writes)

## Approved By
- **Adam (Architect)**: Technical design approved
- **Orion (Orchestrator)**: Protocol compatibility confirmed

---
**Version**: 2.0  
**Date**: January 4, 2026  
**Supersedes**: ADR-2026-01-04-writeplan-content-capture.session.md
