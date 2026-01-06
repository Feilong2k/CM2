# Implementation Requirements: WritePlanTool Session Protocol (CLI Controller) - Version 3

**Goal:** Implement ADR-2026-01-04-v3 to allow reliable large-content writes via a CLI-based session controller with disk persistence. This replaces large JSON tool arguments with a streaming content flow (assistant text) + `DONE` signal + idle timer fallback, using an internal Node API for finalization and disk-based crash recovery.

**Status:** Ready for Implementation (Final Design with Disk Persistence)
**Role Owners:** 
- **Tara:** Write tests first (TDD)
- **Devon:** Implement behavior to pass tests

---

## 1. Overview & Constraints (Final)

### Core Objective
Enable Orion to write 200+ line files without triggering JSON parse errors or truncation in `function.arguments`. Content flows through normal assistant text; metadata flows through a single small tool call, with disk persistence for crash recovery.

### Critical Design Principles
- **No content in tool calls**: Large content never passes through tool-call JSON serialization
- **Hybrid buffering**: In-memory for performance + periodic disk saves for crash recovery
- **Internal Node API**: CLI calls `WritePlanTool.finalizeSession(session_id, disk_file_path)` directly
- **Single tool call**: Only `WritePlanTool_begin` is exposed for metadata
- **Professional UX**: Crash recovery, no lost work

### Architecture Alignment
- **CLI Controller:** `bin/orion-cli.js` manages the "write session" state with memory+disk buffering, timer, DONE detection, and calls internal API.
- **Tool API:** `WritePlanTool` exposes `begin()` (tool) and `finalizeSession()` (internal, reads from disk).
- **Validation:** `ContentValidationHelper` remains the single source of truth for repair/safety.
- **Disk Persistence:** Session directories under `logs/write_sessions/<session_id>/` with automatic cleanup.

### Assumptions
- **A1:** Primary entrypoint is `bin/orion-cli.js`.
- **A2:** Tools defined in `backend/tools/functionDefinitions.js` (only `WritePlanTool_begin`).
- **A3:** No changes to external LLM protocol (tools remain synchronous).
- **A4:** CLI will create session directories and save content periodically to disk.
- **A5:** CLI will call internal Node API `finalizeSession` with disk file path (not buffered content).

---

## 2. TDD Strategy (Final)

**Principle:** Tests define the contract. Devon should not write implementation code until Tara has defined the failing test or spec.

### Test Layers
1. **Unit:** `WritePlanTool` session APIs (isolated from CLI) - including internal `finalizeSession` with disk I/O.
2. **Integration:** CLI state machine with hybrid buffering (memory + disk).
3. **Regression:** JSONB safety in `TraceStoreService`.
4. **E2E:** Full flow simulation with crash recovery scenarios.
5. **Disk I/O:** Session directory management, periodic saves, cleanup.

---

## 3. Implementation Phases (Final)

### Phase 1: Backend APIs with Disk Support
**Goal:** Create small-payload tool API to start sessions and internal API to finalize from disk.

#### 1.1 [Tara] Define API Contract (Tests)
- **File:** `backend/tools/__tests__/WritePlanTool.session.spec.js` (create new)
- **Requirements:**
  - `begin({ intent, target_file, operation })` returns `{ session_id, stage: 'awaiting_content', session_dir }`.
  - `begin` validates inputs and creates session directory on disk.
  - **New:** `finalizeSession(session_id, disk_file_path)` (internal) reads content from disk, delegates to `executeWritePlan`.
  - `finalizeSession` returns success/failure summary, NOT the raw content.
  - Ensure `finalizeSession` is **not** exposed as a tool (no function definition).
  - Test disk I/O operations (create dir, write metadata, read content).
- **Output:** Failing unit tests.

#### 1.2 [Devon] Implement APIs
- **File:** `backend/tools/WritePlanTool.js`
- **Actions:**
  - Add `begin()`: generate ID, create session directory (`logs/write_sessions/<session_id>/`), save metadata to `metadata.json`.
  - Add `finalizeSession()` (internal): read content from disk file (`content.txt`), build plan, call `executeWritePlan`, clean up session directory.
  - Ensure `execute` still works for backward compatibility.
  - Do **not** expose `finalizeSession` in function definitions.
  - Add session directory utilities (create, read, cleanup).

#### 1.3 [Tara] Edge Case Tests
- **Requirements:**
  - `finalizeSession` with unknown `session_id` throws specific error.
  - `begin` with invalid operation type returns error.
  - `finalizeSession` is not callable via tool orchestrator (internal only).
  - Disk full/perm errors handled gracefully.
  - Orphaned session cleanup.

---

### Phase 2: CLI Controller with Hybrid Buffering
**Goal:** The heart of the feature - manage streaming flow with memory+disk and call internal API.

#### 2.1 [Tara] CLI State Machine Tests
- **File:** `bin/__tests__/cliSession.spec.js` (or similar)
- **Requirements:**
  - **State `session_active`:** Entered upon `WritePlanTool_begin` success, directory created.
  - **Hybrid Buffering:** Accumulates assistant text chunks in memory, saves to disk every 50 lines or 5 seconds.
  - **DONE Detection:** Regex `/^DONE\s*$/m` (multiline or standalone line) triggers finalization.
  - **Idle Timer:** If no DONE after `WRITE_SESSION_IDLE_MS` (2s), output "Reply DONE..." prompt.
  - **Finalize:** Calls `WritePlanTool.finalizeSession(session_id, disk_file_path)` (internal API), then cleans up.
  - **Crash Recovery:** On CLI start, detect orphaned sessions (<1 hour old), prompt for recovery.
  - Verify that **no tool call** is made for finalization.

#### 2.2 [Devon] Implement CLI Controller
- **File:** `bin/orion-cli.js`
- **Actions:**
  - Add `activeWriteSession` state object with memory buffer and disk tracking.
  - Hook into tool result processing to detect `begin` -> start session, create directory.
  - Hook into `process.stdout` or message handler to capture assistant output.
  - Implement periodic disk saves (setInterval or line count based).
  - Implement the timer/DONE logic.
  - When finalizing, call `WritePlanTool.finalizeSession(session_id, disk_path)` directly.
  - Handle result (success vs `needs_corrections`).
  - Add startup orphaned session detection and recovery prompt.

---

### Phase 3: Validation Integration
**Goal:** Integrate with existing validation system and ensure robustness.

#### 3.1 [Tara] Validation Tests
- **File:** `backend/tools/__tests__/WritePlanTool.session.disk.spec.js`
- **Requirements:**
  - ContentValidationHelper works with disk-read content.
  - UTF-8 validation and repair loop functions with file I/O.
  - Trace persistence handles session metadata without JSONB errors.

#### 3.2 [Devon] Harden TraceStoreService and Integration
- **File:** `backend/src/services/TraceStoreService.js`
- **Actions:**
  - Use `JSON.parse(JSON.stringify(event))` or similar sanitization before SQL insert.
  - Ensure explicit casting to `::jsonb` if using raw SQL.
  - Add session-specific trace events.

---

### Phase 4: Cleanup and Maintenance
**Goal:** Ensure system doesn't accumulate orphaned sessions.

#### 4.1 [Tara] Cleanup Tests
- **File:** `backend/tools/__tests__/WritePlanTool.cleanup.spec.js`
- **Requirements:**
  - Automatic cleanup of sessions >1 hour old.
  - CLI commands for manual session management.
  - Recovery from disk full scenarios.

#### 4.2 [Devon] Implement Cleanup
- **Actions:**
  - Add automatic cleanup cron or startup cleanup.
  - Add CLI commands: `list-sessions`, `clean-sessions`, `recover-session`.
  - Document recovery procedures.

---

### Phase 5: End-to-End Verification with Crash Recovery
**Goal:** Verify the full flow works, including crash scenarios.

#### 5.1 [Tara] E2E Integration Test with Crash Simulation
- **File:** `backend/tests/e2e/writeSession.crash.spec.js`
- **Requirements:**
  - Mock Orion + Tool + CLI loop.
  - Sequence with simulated crash:
    1. `begin` -> success, directory created.
    2. Stream 30 chunks of text, verify disk saves.
    3. Simulate CLI crash.
    4. Restart CLI, detect orphaned session.
    5. Recover session, continue streaming.
    6. Send `DONE`.
    7. Verify `finalizeSession` called with disk path.
    8. Verify file created on disk.
    9. Verify session directory cleaned up.

#### 5.2 [Devon] Final Polish
- **Actions:**
  - Run E2E tests.
  - Fix any timing/coordination bugs.
  - Ensure no large JSON logs are spammed to console.
  - Ensure CLI correctly handles disk full, permission errors.
  - Optimize disk I/O frequency.

---

## 4. Acceptance Criteria (Definition of Done) - Final

- [ ] **No JSON Truncation:** Large files (200+ lines) write successfully without JSON parse errors.
- [ ] **No `raw_content` in tool definitions:** Only `WritePlanTool_begin` exists; `WritePlanTool_finalize` not exposed.
- [ ] **Hybrid buffering works:** CLI buffers in memory and saves to disk periodically (every 50 lines/5s).
- [ ] **Crash recovery works:** CLI restart detects orphaned sessions (<1 hour), prompts for recovery.
- [ ] **Internal API used:** CLI calls `WritePlanTool.finalizeSession` with disk file path.
- [ ] **Protocol Compliance:** Orion can use `DONE` or wait for timer prompt.
- [ ] **Validation Active:** Invalid content repaired via `ContentValidationHelper`.
- [ ] **Automatic cleanup:** Old sessions (>1 hour) cleaned up automatically.
- [ ] **Trace Safety:** No "invalid input syntax for type json" errors in logs.
- [ ] **Green Tests:** All new unit, integration, and E2E tests pass.

---

## 5. Files to Modify

### Backend
1. `backend/tools/WritePlanTool.js`
   - Add `begin` method (tool-exposed) with disk session creation.
   - Add `finalizeSession` method (internal) that reads from disk.
   - Add session directory utilities.
   - Maintain `execute` and `executeWritePlan` for backward compatibility.

2. `backend/tools/functionDefinitions.js`
   - Add `WritePlanTool_begin` definition.
   - Do **not** add `WritePlanTool_finalize`.

3. `backend/src/services/TraceStoreService.js`
   - Harden JSON serialization.

### CLI
1. `bin/orion-cli.js`
   - Add session state management with memory buffer.
   - Implement periodic disk saves.
   - Add DONE detection, timer fallback.
   - Call internal `WritePlanTool.finalizeSession` with disk path.
   - Add orphaned session detection and recovery on startup.
   - Add cleanup logic.

### Utilities
1. `backend/src/utils/SessionDiskManager.js` (new)
   - Session directory creation/management.
   - Periodic save logic.
   - Orphan detection and cleanup.

### Tests
1. `backend/tools/__tests__/WritePlanTool.session.spec.js` (new)
2. `backend/tools/__tests__/WritePlanTool.session.disk.spec.js` (new)
3. `backend/tools/__tests__/WritePlanTool.cleanup.spec.js` (new)
4. `backend/tools/__tests__/functionDefinitions.WritePlanTool.spec.js` (update)
5. `bin/__tests__/cliSession.spec.js` (new)
6. `backend/tests/e2e/writeSession.crash.spec.js` (new)

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Disk I/O slows streaming | Buffer in memory, save periodically (not every char). Use async writes. |
| Disk full errors | Fall back to in-memory only with warning to user. |
| Orphaned sessions accumulate | Automatic cleanup after 1 hour; startup cleanup. |
| File permission issues | Check on startup, warn user, fallback to memory. |
| Session recovery complexity | Keep recovery simple: prompt to continue or discard. |
| Concurrent session conflicts | Single active session for MVP; can enhance later. |
| Large memory usage for big files | Stream to disk more frequently for large content. |

---

## 7. Notes for UI Compatibility

The internal API `finalizeSession` with disk persistence is designed to be called by any controller (CLI or UI). Future UI implementation will:
- Use same `WritePlanTool.begin` tool call for metadata.
- Capture assistant text via UI stream.
- Save to same session directory structure.
- Call `WritePlanTool.finalizeSession` with disk file path.
- No changes to backend required.

### Session Directory Structure
```
logs/write_sessions/
├── <session_id>/
│   ├── metadata.json    # { intent, target_file, operation, created_at }
│   ├── content.txt      # Appended content (plain text)
│   └── state.json       # { buffer_size, last_save, line_count }
```

---
**Document Version:** 3.0  
**Based on ADR:** ADR-2026-01-04-v3  
**Last Updated:** January 4, 2026
