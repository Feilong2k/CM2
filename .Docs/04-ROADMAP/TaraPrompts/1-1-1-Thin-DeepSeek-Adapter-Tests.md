# Tara (Test Engineer) — Task 1.1 Step 3: Formal Tests for DeepSeek Reasoner Adapter

## Overview
Now that the adapter is implemented (Step 2) and verified by the Probe (Step 1), we need formal unit tests for long-term regression safety.

These tests will use **Jest** and will **mock `fetch`** so they don't hit the real API.

## File: `backend/src/adapters/__tests__/DS_ReasonerAdapter.spec.js`

## Test Cases

### 1. Initialization
- Should instantiate without errors.
- Should warn if `DEEPSEEK_API_KEY` is missing (mock process.env).

### 2. Request Formatting
- Mock `global.fetch`.
- Call `adapter.callStreaming(...)`.
- Verify `fetch` was called with:
  - Correct URL.
  - Headers (`Authorization: Bearer ...`).
  - Body: `model: 'deepseek-reasoner'`, `stream: true`, `messages`.

### 3. Response Parsing (Streaming)
- Mock a `ReadableStream` response from `fetch`.
- Feed it SSE chunks:
  ```
  data: {"choices":[{"delta":{"content":"Hello"}}]}
  
  data: {"choices":[{"delta":{"reasoning_content":"Thinking"}}]}
  ```
- Verify the iterator yields correctly parsed objects.

### 4. Error Handling
- Mock `fetch` returning 401/500.
- Verify `callStreaming` throws an error with the status text.

## Constraints
- Use `jest`.
- Do not make real network calls.
- Cover the buffering logic (simulate a split chunk if possible).
