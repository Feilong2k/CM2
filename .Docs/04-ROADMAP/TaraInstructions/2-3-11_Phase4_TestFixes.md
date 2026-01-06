# Tara Instructions: Phase 4 Test Fixes for WritePlanTool MVP

**Created:** 2026-01-04  
**Created By:** Devon  
**Priority:** High (blocking Phase 4 completion)

---

## Summary

Two test files are failing due to **outdated test expectations** that conflict with the approved MVP design. The implementation is correct; the tests need updates.

---

## Failing Tests

### 1. `backend/tools/__tests__/WritePlanTool.session.spec.js`

**Failures:** 3 tests failing

| Test | Error | Root Cause |
|------|-------|------------|
| `finalizes a session and returns success summary` | `Another write session is already active` | Sessions not cleared between tests |
| `throws an error for unknown session_id` | `writePlanTool.finalize is not a function` | Test uses old method name `finalize()` |
| `delegates to executeWritePlan internally` | `Another write session is already active` | Sessions not cleared between tests |

**Required Fixes:**

1. **Add session cleanup in `beforeEach`:**
   ```javascript
   const WritePlanTool = require('../WritePlanTool');
   
   beforeEach(() => {
     WritePlanTool.clearAllSessions(); // Clear sessions between tests
   });
   ```

2. **Rename method calls from `finalize()` to `finalizeViaAPI()`:**
   ```javascript
   // OLD (line 72):
   await writePlanTool.finalize({ session_id: '...', raw_content: '...' });
   
   // NEW:
   await writePlanTool.finalizeViaAPI(session_id, content);
   ```
   
   Note: The signature changed from `{ session_id, raw_content }` to `(session_id, content)`.

---

### 2. `backend/tools/__tests__/functionDefinitions.WritePlanTool.spec.js`

**Failures:** 1 test failing

| Test | Error | Root Cause |
|------|-------|------------|
| `registers WritePlanTool_finalizeViaAPI with correct schema` | `expect(def).toBeDefined()` - Received: undefined | Test expects `finalizeViaAPI` to be exposed as a tool |

**Required Fix:**

This test **contradicts the MVP design**. Per ADR-2026-01-04-v3 and the MVP Implementation doc:

> **Critical Design Principle:** No content in tool calls. Large content never passes through tool-call JSON serialization.

The `WritePlanTool_finalizeViaAPI` was **intentionally removed** from `functionDefinitions.js` (see line 624-626 comment).

**Option A (Recommended):** Delete the test entirely:
```javascript
// DELETE this entire describe block:
describe('WritePlanTool_finalizeViaAPI registration', () => {
  it('registers WritePlanTool_finalizeViaAPI with correct schema', () => {
    // ... this test should not exist
  });
});
```

**Option B:** Change the test to verify it is NOT exposed:
```javascript
describe('WritePlanTool_finalizeViaAPI NOT exposed', () => {
  it('does NOT register WritePlanTool_finalizeViaAPI (internal only)', () => {
    const def = functionDefinitions.find(
      (d) => d.function?.name === 'WritePlanTool_finalizeViaAPI'
    );
    expect(def).toBeUndefined(); // Intentionally not exposed
  });
});
```

---

## Verification

After making these changes, run:

```bash
cd backend
npx jest tools/__tests__/WritePlanTool.session.spec.js tools/__tests__/functionDefinitions.WritePlanTool.spec.js --verbose
```

**Expected Result:** All tests pass.

---

## Context

### Why `finalizeViaAPI` is NOT a Tool

The whole point of the WritePlanTool session protocol is to **avoid sending large content through tool-call JSON arguments**. If we exposed `finalizeViaAPI` as a tool:

1. The LLM could call it directly with `content` in the arguments
2. Large content would go through JSON serialization
3. We'd hit the same truncation/parse errors we're trying to solve

Instead, the flow is:
1. LLM calls `WritePlanTool_begin` (small JSON, metadata only)
2. LLM outputs content as **plain assistant text** (not JSON)
3. CLI buffers content and calls HTTP API `POST /api/write-session/finalize`

The HTTP API is the only way to finalize - this is by design.

---

## Files to Modify

1. `backend/tools/__tests__/WritePlanTool.session.spec.js`
2. `backend/tools/__tests__/functionDefinitions.WritePlanTool.spec.js`

---

**End of Instructions**


