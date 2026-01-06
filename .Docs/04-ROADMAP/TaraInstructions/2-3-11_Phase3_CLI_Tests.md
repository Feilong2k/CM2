# Tara Instructions: Phase 3 CLI Controller Tests

**Created:** 2026-01-05  
**Priority:** High (Blocking Orion write capability)  
**Phase:** 3.1 - CLI State Machine Tests

---

## Objective

Write tests that define the contract for CLI write-session handling. These tests ensure the CLI can:
1. Detect when `WritePlanTool_begin` succeeds and enter session mode
2. Buffer assistant text content in memory
3. Detect `DONE` marker and trigger HTTP finalize call
4. Handle idle timeout with user prompt
5. Display errors from HTTP API

---

## Test File Location

**Create:** `bin/__tests__/cliSession.mvp.spec.js`

---

## Existing Code Reference

There's already a controller module at `bin/orion-cli-controller.js` that Devon created for E2E tests. Your tests should validate this controller's behavior AND define new requirements for integration with `orion-cli.js`.

---

## Test Requirements (Phase 3.1)

### 3.1.1 Session State Management

```javascript
describe('CLI Write Session State Management', () => {
  
  it('enters session_active state when startWriteSession is called', () => {
    // Arrange: create controller
    // Act: call startWriteSession({ session_id: 'test-session' })
    // Assert: getCliState().activeWriteSession is not null
    // Assert: getCliState().activeWriteSession.sessionId === 'test-session'
    // Assert: getCliState().activeWriteSession.buffer === ''
  });

  it('clears previous session when starting new session', () => {
    // Arrange: start a session, add some buffer content
    // Act: start a NEW session
    // Assert: buffer is reset to ''
    // Assert: sessionId is the new one
  });

  it('remains inactive when no session started', () => {
    // Arrange: create controller (no startWriteSession call)
    // Act: call handleAssistantMessage('some text')
    // Assert: text is ignored (no state change)
  });

});
```

### 3.1.2 Content Buffering

```javascript
describe('CLI Content Buffering', () => {

  it('accumulates assistant text in buffer', () => {
    // Arrange: start session
    // Act: handleAssistantMessage('Line 1\n')
    // Act: handleAssistantMessage('Line 2\n')
    // Assert: buffer === 'Line 1\nLine 2\n'
  });

  it('preserves exact content including whitespace', () => {
    // Arrange: start session
    // Act: handleAssistantMessage('  indented\n\ttabbed\n')
    // Assert: buffer preserves all whitespace
  });

  it('handles empty messages gracefully', () => {
    // Arrange: start session with some buffer
    // Act: handleAssistantMessage('')
    // Assert: buffer unchanged
  });

});
```

### 3.1.3 DONE Detection

```javascript
describe('CLI DONE Detection', () => {

  it('detects DONE on its own line and triggers finalize', async () => {
    // Arrange: start session, mock http.post to return 200
    // Act: handleAssistantMessage('Content here\nDONE\n')
    // Assert: http.post was called with correct session_id and content
    // Assert: session is cleared after success
  });

  it('detects DONE with only newline after', async () => {
    // Arrange: start session
    // Act: handleAssistantMessage('Content\nDONE\n')
    // Assert: finalize called with 'Content\n'
  });

  it('detects DONE at end of buffer without trailing newline', async () => {
    // Arrange: start session
    // Act: handleAssistantMessage('Content\nDONE')
    // Assert: finalize called (DONE detected)
  });

  it('does NOT detect DONE in middle of line', async () => {
    // Arrange: start session
    // Act: handleAssistantMessage('We are DONE with this\n')
    // Assert: finalize NOT called (DONE not on its own line)
    // Assert: buffer contains the text
  });

  it('extracts content BEFORE DONE marker only', async () => {
    // Arrange: start session
    // Act: handleAssistantMessage('Line 1\nLine 2\nDONE\nExtra stuff')
    // Assert: finalize called with 'Line 1\nLine 2\n' (not extra stuff)
  });

  it('handles DONE split across multiple messages', async () => {
    // Arrange: start session
    // Act: handleAssistantMessage('Content\nDO')
    // Act: handleAssistantMessage('NE\n')
    // Assert: finalize called when DONE is complete
  });

});
```

### 3.1.4 Idle Timer

```javascript
describe('CLI Idle Timer', () => {

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('prompts user after 2 seconds of no DONE', async () => {
    // Arrange: start session, mock console.log
    // Act: handleAssistantMessage('Some content\n')
    // Act: advance timers by 2000ms
    // Assert: console.log called with "If you're finished, reply DONE on its own line"
  });

  it('resets idle timer on new content', async () => {
    // Arrange: start session
    // Act: handleAssistantMessage('Content 1\n')
    // Act: advance timers by 1500ms (not enough to trigger)
    // Act: handleAssistantMessage('Content 2\n')
    // Act: advance timers by 1500ms again
    // Assert: prompt NOT shown (timer was reset)
    // Act: advance timers by another 500ms (total 2000ms since last content)
    // Assert: prompt shown
  });

  it('clears idle timer when DONE detected', async () => {
    // Arrange: start session
    // Act: handleAssistantMessage('Content\n')
    // Act: handleAssistantMessage('DONE\n')
    // Act: advance timers by 5000ms
    // Assert: prompt NOT shown (timer was cleared)
  });

  it('idle timer message matches exact format', async () => {
    // This is important for Orion to recognize the prompt
    // Arrange: start session
    // Act: handleAssistantMessage('Content\n')
    // Act: advance timers by 2000ms
    // Assert: message is EXACTLY "If you're finished, reply DONE on its own line"
  });

});
```

### 3.1.5 HTTP Finalize Call

```javascript
describe('CLI HTTP Finalize', () => {

  it('calls POST /api/write-session/finalize with session_id and content', async () => {
    // Arrange: start session with session_id='sess_123', mock http.post
    // Act: handleAssistantMessage('My content\nDONE\n')
    // Assert: http.post called with:
    //   - URL: '/api/write-session/finalize'
    //   - Body: { session_id: 'sess_123', content: 'My content\n' }
  });

  it('clears session after successful finalize (200)', async () => {
    // Arrange: mock http.post to return { status: 200, data: {...} }
    // Act: trigger DONE
    // Assert: getCliState().activeWriteSession === null
  });

  it('clears session after non-retryable error', async () => {
    // Arrange: mock http.post to return { status: 400, data: { error: '...' } }
    // Act: trigger DONE
    // Assert: session is cleared (no retry for 400)
  });

});
```

### 3.1.6 Error Handling (Phase 3.3)

```javascript
describe('CLI Error Handling', () => {

  it('displays 413 error clearly', async () => {
    // Arrange: mock http.post to return { status: 413, data: { error: 'Content exceeds 10MB limit...' } }
    // Act: trigger DONE
    // Assert: console.error called with message containing "Content too large"
  });

  it('displays 400 validation error with details', async () => {
    // Arrange: mock http.post to return { status: 400, data: { error: 'Validation failed: content cannot be empty' } }
    // Act: trigger DONE
    // Assert: console.error called with message containing "Content validation failed"
  });

  it('retries once on network error', async () => {
    // Arrange: mock http.post to throw Error on first call, return 200 on second
    // Act: trigger DONE
    // Assert: http.post called twice
    // Assert: console.warn called with "retrying"
    // Assert: session cleared after success
  });

  it('stops after 2 failed network attempts', async () => {
    // Arrange: mock http.post to always throw Error
    // Act: trigger DONE
    // Assert: http.post called exactly 2 times
    // Assert: console.warn called for retry
    // Assert: session NOT cleared (content preserved for manual retry)
  });

  it('does NOT retry on 400/413/500 errors', async () => {
    // Arrange: mock http.post to return { status: 500, data: { error: '...' } }
    // Act: trigger DONE
    // Assert: http.post called exactly 1 time (no retry)
  });

});
```

---

## Test Setup Template

```javascript
/**
 * cliSession.mvp.spec.js
 *
 * Goal: Define contract for CLI write-session handling
 *
 * Requirements (Phase 3.1):
 * - [P3-1] Session state management (active/inactive)
 * - [P3-2] Content buffering in memory
 * - [P3-3] DONE detection via regex /^DONE\s*$/m
 * - [P3-4] Idle timer (2s) with user prompt
 * - [P3-5] HTTP finalize call with retry logic
 * - [P3-6] Error display for 400/413/500 responses
 *
 * Non-goals:
 * - Disk persistence (MVP accepts data loss on crash)
 * - Multiple concurrent sessions
 */

const createOrionCliController = require('../orion-cli-controller');

describe('CLI Write Session (Phase 3 MVP)', () => {
  let controller;
  let mockHttp;
  let mockConsole;

  beforeEach(() => {
    // Reset mocks
    mockHttp = {
      post: jest.fn(),
    };
    mockConsole = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create controller with mocked dependencies
    controller = createOrionCliController({
      http: mockHttp,
      console: mockConsole,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ... test suites from above ...

});
```

---

## Running the Tests

```bash
cd bin
npx jest __tests__/cliSession.mvp.spec.js --verbose
```

**Expected initial state:** All tests FAIL (RED) because they define new requirements.

---

## Integration Test (Additional)

After unit tests pass, add one integration test that validates the full flow:

```javascript
describe('CLI Integration with Real HTTP (E2E)', () => {

  it('completes full write session: begin → buffer → DONE → file created', async () => {
    // This test uses the real backend (supertest)
    // See: backend/tests/e2e/writeSession.mvp.spec.js for reference
    
    // 1. Call /api/write-session/begin
    // 2. Create controller with real HTTP adapter
    // 3. startWriteSession with returned session_id
    // 4. handleAssistantMessage with content + DONE
    // 5. Verify file exists on disk
    // 6. Verify session is cleared
  });

});
```

---

## Checklist

- [ ] Create `bin/__tests__/cliSession.mvp.spec.js`
- [ ] Implement all test suites from sections 3.1.1 - 3.1.6
- [ ] Tests should initially FAIL (RED state)
- [ ] Tests use mocked `http` and `console` dependencies
- [ ] Idle timer tests use `jest.useFakeTimers()`
- [ ] DONE detection regex is `/^DONE\s*$/m` (multiline mode)
- [ ] Error messages match exact format from MVP doc

---

## Notes for Devon

Once these tests are GREEN, Devon needs to:
1. Integrate `orion-cli-controller.js` into `orion-cli.js`
2. Hook into tool result processing to detect `WritePlanTool_begin` success
3. Hook into assistant message stream to call `handleAssistantMessage`
4. Ensure HTTP adapter uses real `fetch` or `axios`

---

**End of Instructions**


