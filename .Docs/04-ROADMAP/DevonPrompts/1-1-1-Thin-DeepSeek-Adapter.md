# Devon (Developer) — Task 1.1 Step 2: Implement Thin DeepSeek Adapter

## Overview
Implement the `DS_ReasonerAdapter` class. This class acts as a thin wrapper around the DeepSeek API, handling:
1.  API Key management (from `process.env`).
2.  Request formatting (messages, tools, streaming).
3.  Response parsing (SSE stream to AsyncIterator).

## File: `backend/src/adapters/DS_ReasonerAdapter.js`

## Requirements

### 1. Constructor
-   Read `DEEPSEEK_API_KEY` from `process.env`.
-   Throw or warn if missing (warn is better for dev, throw for prod).
-   Set `this.apiUrl` to `https://api.deepseek.com/chat/completions`.

### 2. Method: `callStreaming(messages, tools, options)`
-   **Inputs:**
    -   `messages`: Array of OpenAI-format messages.
    -   `tools`: Array of tool definitions (optional).
    -   `options`: Object (temperature, max_tokens, etc.).
-   **Behavior:**
    -   Construct the fetch request body.
    -   Force `stream: true`.
    -   Use `fetch` (Node 18+ native) to POST to the API.
    -   Handle non-200 responses (throw Error with status/text).
    -   Return an `AsyncIterator` (generator) that yields parsed chunks.

### 3. Stream Parsing (`_parseStreamingResponse`)
-   Read from `response.body` (ReadableStream).
-   Use `TextDecoder` to handle binary chunks.
-   Split by `\n\n` or `\n` to handle SSE events (`data: ...`).
-   Filter out `data: [DONE]`.
-   Parse JSON from `data: {...}` lines.
-   Yield standard objects:
    ```js
    {
      content: delta.content || "",
      reasoning_content: delta.reasoning_content || "",
      tool_calls: delta.tool_calls || []
    }
    ```
-   **Robustness:** Handle split chunks (where a JSON line is split across two network packets) by buffering.

## Verification
-   Run the probe created by Tara:
    ```bash
    node backend/scripts/probes/probe_ds_adapter.js
    ```
-   It should print the chunks received from DeepSeek (e.g., "Hello", "Thinking...").

## Constraints
-   No external dependencies other than `dotenv` (if needed for env) and native `fetch`.
-   Keep it stateless.
