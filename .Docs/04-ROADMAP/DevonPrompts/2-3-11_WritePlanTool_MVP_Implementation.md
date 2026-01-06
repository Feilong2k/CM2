# Implementation Requirements: WritePlanTool Session Protocol - MVP Version

**Goal:** Implement the MVP scope from ADR-2026-01-04-v3 (PCC1-analyzed gaps) to allow reliable large-content writes via CLI session controller. This replaces large JSON tool arguments with streaming content flow (assistant text) + `DONE` signal + idle timer fallback, using HTTP REST API for CLI-backend communication.

**Status:** ✅ MVP COMPLETE (All Phases Done)
**Role Owners:** 
- **Tara:** Write tests first (TDD)
- **Devon:** Implement behavior to pass tests

---

## Progress Summary (Updated 2026-01-05)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: HTTP API | ✅ Complete | All endpoints implemented and tested |
| Phase 2: Backend Session | ✅ Complete | `finalizeViaAPI()` performs real writes via `executeWritePlan` |
| Phase 3: CLI Controller | ✅ Complete | Buffering, DONE detection, idle timer, HTTP API calls |
| Phase 4: Integration | ✅ Complete | E2E tests passing, logging added |
| Phase 5: Real Writes & Orion | ✅ Complete | 16 integration tests passing, real files written |

**WritePlanTool is ready for use by Orion!**

---

## 1. Overview & Constraints (MVP)

### Core Objective
Enable Orion to write 200+ line files without triggering JSON parse errors or truncation in `function.arguments`. Content flows through normal assistant text; metadata flows through a single small tool call.

### Critical Design Principles (MVP)
- **No content in tool calls**: Large content never passes through tool-call JSON serialization
- **HTTP REST API**: CLI communicates with backend via HTTP endpoints (localhost)
- **In-memory sessions**: No disk persistence for MVP (accept CLI crash risk)
- **Single session**: Only one active write session at a time
- **Size limits**: 10MB maximum content size
- **Basic error recovery**: 2 retry attempts with clear error messages

### Architecture Alignment (MVP)
- **CLI Controller:** `bin/orion-cli.js` manages in-memory buffering, DONE detection, timer fallback, and calls HTTP API.
- **Tool API:** `WritePlanTool` exposes `begin()` (tool) and new HTTP endpoints for session management.
- **Validation:** `ContentValidationHelper` remains the single source of truth for repair/safety.
- **Session Storage:** In-memory session registry (no disk persistence for MVP).

### Assumptions (MVP)
- **A1:** Primary entrypoint is `bin/orion-cli.js`.
- **A2:** Tools defined in `backend/tools/functionDefinitions.js` (only `WritePlanTool_begin`).
- **A3:** No changes to external LLM protocol (tools remain synchronous).
- **A4:** CLI communicates with backend via HTTP REST API (localhost:5000).
- **A5:** Single active session enforced globally.
- **A6:** CLI crash loses buffered content (acceptable for MVP).

---

## 2. TDD Strategy (MVP)

**Principle:** Tests define the contract. Devon should not write implementation code until Tara has defined the failing test or spec.

### Test Layers
1. **Unit:** `WritePlanTool` session APIs (isolated from CLI) - including new HTTP endpoint handlers.
2. **Integration:** CLI state machine with HTTP API calls.
3. **Regression:** JSONB safety in `TraceStoreService`.
4. **E2E:** Full flow simulation (Orion -> Tool -> CLI -> HTTP API -> File).
5. **HTTP API:** Endpoint testing with proper status codes and error messages.

---

## 3. Implementation Phases (MVP)

### Phase 1: HTTP API Design & Implementation ✅ COMPLETE
**Goal:** Create REST endpoints for session management and content submission.

#### 1.1 [Tara] Define API Contract (Tests) ✅ COMPLETE
- **File:** `backend/__tests__/writeSession.api.spec.js` (exists)
- **Requirements:**
  - `POST /api/write-session/begin` - Validates inputs, creates session, returns session_id.
  - `POST /api/write-session/finalize` - Accepts content, runs validation/write, returns result.
  - `GET /api/write-session/status/:session_id` - Returns session status.
  - `DELETE /api/write-session/:session_id` - Cancels active session.
  - All endpoints return appropriate HTTP status codes (200, 400, 404, 500).
  - Size validation: Reject >10MB with 413 status.
  - Single session enforcement: Reject new session if active with 409 status.
- **Output:** Failing API integration tests.

#### 1.2 [Devon] Implement HTTP API ✅ COMPLETE
- **File:** `backend/src/routes/writeSession.routes.js` (exists)
- **Actions:**
  - Add Express routes for all endpoints.
  - Integrate with `WritePlanTool` for business logic.
  - Add 10MB content limit middleware.
  - Implement in-memory session registry.
  - Add single session enforcement.
  - Wire into main Express app (`backend/index.js`).

#### 1.3 [Tara] Error Handling Tests ✅ COMPLETE
- **Requirements:** (all tested in writeSession.api.spec.js)
  - 413: "Content exceeds 10MB limit"
  - 409: "Another write session is already active"
  - 404: "Session not found or expired"
  - 400: Validation errors with details
  - 500: Internal server error with generic message

---

### Phase 2: Backend Session Management ✅ COMPLETE
**Goal:** Update WritePlanTool to support HTTP API and session management.

#### 2.1 [Tara] WritePlanTool Session Tests ✅ COMPLETE
- **File:** `backend/tools/__tests__/WritePlanTool.session.mvp.spec.js` (exists)
- **Requirements:**
  - `begin()` method accepts metadata, generates UUID v4 session_id.
  - `begin()` validates operation type, target_file path.
  - `finalizeViaAPI(session_id, content)` method for HTTP endpoint.
  - Session timeout: 5 minutes of inactivity (configurable).
  - Single session enforcement at WritePlanTool level.
- **Output:** All tests passing.


#### 2.2 [Devon] Update WritePlanTool ✅ COMPLETE
- **File:** `backend/tools/WritePlanTool.js`
- **Status:**
  - ✅ `begin()` method implemented (creates in-memory session)
  - ✅ `finalizeViaAPI()` performs real writes via `executeWritePlan`
  - ✅ Session registry with timeout cleanup
  - ✅ Session lifecycle logging added
  - ✅ Backward compatibility for `execute()` method maintained

#### 2.3 [Tara] Timeout & Cleanup Tests
- **Requirements:**
  - Sessions auto-cleanup after 5 minutes of inactivity.
  - Cleanup doesn't affect active sessions with recent activity.
  - Session status reflects timeout state.

---

### Phase 3: CLI Controller (Simplified) ✅ COMPLETE
**Goal:** Implement CLI state machine with HTTP API calls instead of internal Node API.

#### 3.1 [Tara] CLI State Machine Tests (MVP) ✅ COMPLETE
- **File:** `bin/__tests__/cliSession.mvp.spec.js` (exists)
- **Requirements:**
  - **State `session_active`:** Entered upon `WritePlanTool_begin` success.
  - **In-memory buffering:** Accumulates assistant text chunks in memory only.
  - **DONE Detection:** Regex `/^DONE\s*$/m` triggers HTTP API call.
  - **Idle Timer:** If no DONE after `WRITE_SESSION_IDLE_MS` (2000ms), output prompt.
  - **HTTP API Call:** CLI calls `POST /api/write-session/finalize` with buffered content.
  - **Error Handling:** CLI displays HTTP error messages to user.
  - **No crash recovery:** CLI crash loses buffered content (acceptable).
- **Output:** 7 tests passing.

#### 3.2 [Devon] Implement CLI Controller (MVP) ✅ COMPLETE
- **Files:** `bin/orion-cli-controller.js` (new) + `bin/orion-cli.js` (integrated)
- **Completed:**
  - ✅ `activeWriteSession` state object with in-memory buffer
  - ✅ Tool result processing detects `begin` -> starts session
  - ✅ Assistant output stream captured for buffering
  - ✅ 2-second idle timer for DONE detection
  - ✅ HTTP API calls with `fetch()` on DONE detection
  - ✅ Error messages displayed to user
  - ✅ Network errors with retry logic (max 2 attempts)

#### 3.3 [Tara] CLI Error Handling Tests ✅ COMPLETE
- **All Requirements Met:**
  - ✅ Network errors trigger retry (max 2 attempts)
  - ✅ Validation errors displayed with details
  - ✅ Size limit errors shown clearly
  - ✅ Session conflict errors prompt user to wait

---

### Phase 4: Integration & Validation ✅ COMPLETE
**Goal:** Ensure end-to-end flow works with existing validation system.

#### 4.1 [Tara] E2E Integration Test (MVP) ✅ COMPLETE
- **File:** `backend/tests/e2e/writeSession.mvp.spec.js` (exists)
- **All Requirements Met:**
  - ✅ Mock Orion + Tool + CLI + HTTP API loop
  - ✅ Full sequence tested: begin → stream → DONE → finalize
  - ✅ Size limit exceeded scenario
  - ✅ 2 E2E tests passing

#### 4.2 [Devon] Final Integration ✅ COMPLETE
- **Completed:**
  - ✅ HTTP API integrated with Express app
  - ✅ Session lifecycle logging added
  - ✅ `functionDefinitions.js` exposes only `WritePlanTool_begin`
  - ✅ `WritePlanTool_finalizeViaAPI` removed from function definitions (critical fix)

---

### Phase 5: Real Writes & Orion Adoption ✅ COMPLETE

__Goal:__ Turn the validated write-session pipeline into a fully usable feature for Orion, by wiring `finalizeViaAPI` into real file writes and updating Orion's behavior to use the new protocol for long-content writes.

__Status:__ ✅ Complete (16 tests passing)\
__Role Owners:__

- __Tara:__ Define additional tests for real writes & Orion usage ✅ DONE
- __Devon:__ Implement behavior to pass tests and switch Orion over ✅ DONE

---

#### 5.1 WritePlanTool Real Writes (Backend)

__Objective:__ Make `WritePlanTool.finalizeViaAPI` actually write files using the existing `executeWritePlan` logic, while preserving the current API contract and test behavior.

__Tara – Tests__

- __File:__ `backend/tools/__tests__/WritePlanTool.finalize.integration.spec.js` (new)

- __Requirements:__

  1. __Real write on finalize (create):__

     - Begin a session with `{ intent, target_file: 'test-phase5-create.txt', operation: 'create' }`.

     - Call `finalizeViaAPI(session_id, 'Hello Phase5\n')`.

     - Assert:

       - File `test-phase5-create.txt` exists and contains `"Hello Phase5\n"` (via `fs.readFile`).
       - Session is removed (`getStatus` throws not found/expired).

  2. __Overwrite and append behaviors:__

     - Pre-create a file with some content.

     - Begin session with `operation: 'overwrite'` or `operation: 'append'`.

     - After `finalizeViaAPI`, assert:

       - Overwrite: file content is exactly the new content.
       - Append: file content ends with the new content appended.

  3. __Error propagation:__
     - Use a target path that will cause `executeWritePlan` to fail (e.g., invalid directory) and assert:
       - `finalizeViaAPI` throws an error whose message is surfaced as a 500 by the HTTP layer (no silent success).

__Devon – Implementation__

- __File:__ `backend/tools/WritePlanTool.js`

- __Actions:__

  1. In `finalizeViaAPI(session_id, content)`:

     - After validation and expiration checks, build a `plan`:

       ```js
       const plan = {
         intent: session.intent,
         operations: [{
           type: session.operation,
           target_file: session.target_file,
           content,
         }],
       };
       ```

     - Call `executeWritePlan(plan)`.

     - Return the resulting `{ intent, results }` object from `executeWritePlan`.

  2. Preserve existing behavior:

     - Same error strings for:

       - Unknown/expired session,
       - Empty content,
       - Expired session (5 minutes).

     - Still delete the session after a successful finalize.

  3. Ensure Tara’s new integration tests pass, and existing session tests remain green.

---

#### 5.2 Orion Behavior Switch (Usage)

__Objective:__ Ensure Orion uses the new write-session protocol for long writes instead of any legacy write tools.

__Tara – Tests (or probes)__

- __File:__ `backend/scripts/probes/tdd/writeSession.orion.integration.spec.js` (new)

- __Requirements (high-level, can be a probe-style test):__

  1. Simulate an Orion conversation where the user asks for a long markdown file.

  2. Assert that:

     - Orion calls `WritePlanTool_begin` (not any finalize-with-content tool).
     - The CLI/HTTP path is used to finalize the file.
     - The target file is created on disk with the expected content.

  3. Assert there is __no__ use of deprecated direct-write tools (`FileSystemTool_write_to_file`, etc.) for this scenario.

__Devon – Implementation__

- __Files:__ Orion prompts / orchestration configuration (wherever Orion’s write behavior is defined)

- __Actions:__

  1. Update Orion’s system/behavior prompts so that for “write file” requests, it:

     - Calls `WritePlanTool_begin` with `{ target_file, operation, intent }`.
     - Then outputs the file content as assistant text.
     - Ends with `DONE` on its own line.

  2. Remove or strongly de-prioritize any legacy write tool usage (direct write, replace-in-file) for new long-content flows.

  3. Run Tara’s Orion-oriented test/probe and fix any gaps so that:

     - The final file is actually written through the new pipeline.
     - No JSON-tool-call with large `content` arguments is used.

---

#### 5.3 Definition of Done (Phase 5) ✅ ALL COMPLETE

By your Definition of Done, Phase 5 is complete when:

- [x] `WritePlanTool.finalizeViaAPI` uses `executeWritePlan` to perform real writes for `create`, `append`, and `overwrite`.

- [x] Tara's new integration tests for real writes pass (files created/updated as expected). **(10 tests in WritePlanTool.finalize.integration.spec.js)**

- [x] Orion, in a representative end-to-end run, can:

  - Use `WritePlanTool_begin` + streamed content + DONE,
  - Produce a real markdown/text file with long content (200+ lines),
  - Without ever sending that content through `function.arguments` JSON.

- [x] No legacy direct write tools are used for the new long-content path. **(6 tests in writeSession.orion.integration.spec.js)**


## 4. Acceptance Criteria (MVP)

- [ ] **No JSON Truncation:** Large files (200+ lines) write successfully without JSON parse errors.
- [ ] **HTTP API Works:** CLI communicates with backend via REST endpoints.
- [ ] **Size Limit Enforced:** >10MB content rejected with clear error.
- [ ] **Single Session:** Concurrent session attempts rejected.
- [ ] **DONE Detection:** CLI detects `DONE` marker (2s idle timer fallback).
- [ ] **Basic Error Recovery:** 2 retry attempts for network/validation errors.
- [ ] **Clear Error Messages:** All errors have user-friendly descriptions.
- [ ] **Session Timeout:** Inactive sessions cleaned up after 5 minutes.
- [ ] **Backward Compatibility:** Existing `WritePlanTool.execute()` still works.
- [ ] **Green Tests:** All new unit, integration, and E2E tests pass.

---

## 5. Files to Modify

### Backend
1. `backend/tools/WritePlanTool.js` ✅ COMPLETE
   - ✅ `begin()` method (tool-exposed)
   - ✅ `finalizeViaAPI()` method (real writes via `executeWritePlan`)
   - ✅ In-memory session registry with timeout
   - ✅ Session lifecycle logging
   - ✅ `execute()` backward compatibility maintained

2. `backend/tools/functionDefinitions.js` ✅ COMPLETE
   - ✅ `WritePlanTool_begin` definition added
   - ✅ `WritePlanTool_finalizeViaAPI` NOT exposed (critical fix - removed)

3. `backend/src/routes/writeSession.routes.js` ✅ COMPLETE
   - ✅ All HTTP endpoints implemented

4. `backend/index.js` ✅ COMPLETE
   - ✅ writeSession routes registered

### CLI
1. `bin/orion-cli-controller.js` ✅ NEW - COMPLETE
   - ✅ Write session state machine (encapsulated module)
   - ✅ In-memory buffering
   - ✅ DONE detection
   - ✅ Idle timer logic
   - ✅ HTTP API calls with retry logic

2. `bin/orion-cli.js` ✅ INTEGRATED
   - ✅ CLI controller integration
   - ✅ Tool result processing for session detection
   - ✅ Assistant output stream routing

### Tests
1. `backend/__tests__/writeSession.api.spec.js` ✅ EXISTS (passing)
2. `backend/tools/__tests__/WritePlanTool.session.mvp.spec.js` ✅ EXISTS (passing)
3. `bin/__tests__/cliSession.mvp.spec.js` ✅ EXISTS (7 tests passing)
4. `backend/tests/e2e/writeSession.mvp.spec.js` ✅ EXISTS (2 tests passing)
5. `backend/tools/__tests__/WritePlanTool.finalize.integration.spec.js` ✅ NEW (10 tests passing)
6. `backend/scripts/probes/tdd/writeSession.orion.integration.spec.js` ✅ NEW (6 tests passing)

---

## 6. Error Messages (MVP)

### HTTP API Errors (with status codes)
1. **413 Payload Too Large:** `"Content exceeds 10MB limit. Please reduce file size."`
2. **409 Conflict:** `"Another write session is already active. Please wait for it to complete."`
3. **404 Not Found:** `"Session not found or expired. Please start a new write session."`
4. **400 Bad Request:** 
   - `"Invalid operation type. Must be 'create', 'overwrite', or 'append'."`
   - `"Target file path is required."`
   - `"Validation failed: [specific validation errors]"`
5. **500 Internal Server Error:** `"An internal error occurred. Please try again."`

### CLI Errors
1. **Network Error:** `"Failed to connect to backend. Check if server is running. Retrying... (attempt X/2)"`
2. **Session Error:** `"Cannot start new session: [error message from API]"`
3. **Validation Error:** `"Content validation failed: [details]. Please fix and try again."`
4. **Size Limit Error:** `"Content too large (exceeds 10MB). Please split into smaller files."`
5. **Timeout Error:** `"Session timed out after 5 minutes of inactivity. Please start over."`

### Orion Instructions
1. **Begin Session:** `"Now output content. End with DONE on its own line."`
2. **Idle Timer Prompt:** `"If you're finished, reply DONE on its own line. Otherwise continue writing."`

---

## 7. Configuration Constants (MVP)

```javascript
// backend/config/writeSession.config.js
module.exports = {
  // Size limits
  MAX_CONTENT_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  
  // Timeouts
  SESSION_INACTIVITY_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  WRITE_SESSION_IDLE_MS: 2000, // 2-second idle timer for DONE detection
  
  // Retry settings
  MAX_RETRY_ATTEMPTS: 2,
  RETRY_DELAY_MS: 1000,
  
  // Session management
  MAX_CONCURRENT_SESSIONS: 1
};
```

---

## 8. Risks & Mitigations (MVP)

| Risk | Mitigation |
|------|------------|
| CLI crash loses content | Acceptable for MVP. Document limitation. Add disk persistence when UI added. |
| Network failures between CLI and backend | Retry logic (2 attempts). Clear error messages. |
| Memory usage with large files | 10MB limit protects memory. Stream to disk if needed in future. |
| Session timeout too short | 5 minutes is reasonable for MVP. Can adjust based on usage. |
| Concurrent writes blocked | Single session simplifies MVP. Clear error message guides user. |
| Backend restart loses sessions | In-memory sessions lost. Acceptable for MVP. Add persistence later. |

---

## 9. Success Metrics

### Functional Metrics
- **Success Rate:** >95% of large file writes succeed without JSON errors.
- **Error Clarity:** Users understand error messages without additional help.
- **Performance:** Write completion within 30 seconds for 10MB content.

### Technical Metrics
- **Memory Usage:** <50MB additional memory for 10MB content.
- **API Latency:** <5 seconds for validation/write operation.
- **Test Coverage:** >80% coverage for new session code.

---

## 10. Next Steps After MVP

### When UI Added
1. Add CORS configuration to HTTP API.
2. Add authentication for UI requests.
3. Enhance session persistence for longer UI sessions.

### Future Enhancements
1. **Disk persistence** for crash recovery.
2. **Concurrent sessions** support.
3. **Chunking** for files >10MB.
4. **Advanced monitoring** and logging.
5. **Configuration system** for limits and timeouts.

---
**Document Version:** MVP 1.0 ✅ COMPLETE  
**Based on ADR:** ADR-2026-01-04-v3 (PCC1 MVP selections)  
**Last Updated:** January 5, 2026  
**Completion Date:** January 5, 2026 - All 5 phases complete, 35+ tests passing
