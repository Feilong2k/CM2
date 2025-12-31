# Tara (Test Engineer) — Task 1.1 Step 1: Probe for DeepSeek Reasoner Adapter

## Overview
We need to create a **Probe** that verifies the behavior of the `DS_ReasonerAdapter` **before** it is implemented. This ensures we have a "Red" test (failing or ready-to-run) that defines the contract the adapter must satisfy.

The Probe is a standalone script that:
1. Instantiates `DS_ReasonerAdapter`.
2. Calls `callStreaming` with a dummy message.
3. Consumes the returned async iterator.
4. Logs the chunks to prove streaming works.

Since the adapter doesn't exist yet, running this probe initially will fail (module not found), which is the correct "Red" state.

## Step 1: Create the Probe File

**File:** `backend/scripts/probes/probe_ds_adapter.js`

**Instructions:**
Create a standalone script that:
1. Imports `DS_ReasonerAdapter` from `../../src/adapters/DS_ReasonerAdapter.js`.
2. Checks for `DEEPSEEK_API_KEY` in `process.env` (loading .env if needed).
3. Defines a main async function that:
   - Instantiates the adapter.
   - Calls `adapter.callStreaming([{ role: 'user', content: 'Say hello in one word.' }])`.
   - Iterates over the result (`for await (const chunk of stream)`).
   - Logs each chunk type (content, reasoning, tool_call).
4. Catches errors and logs them clearly.

**Constraints:**
- Do NOT use any test framework (Jest/Mocha). Use plain Node.js.
- Do NOT implement the adapter yet. Just the probe.
- Use `require` (CommonJS).

**Expected Outcome:**
- A file `backend/scripts/probes/probe_ds_adapter.js` exists.
- Running it (`node backend/scripts/probes/probe_ds_adapter.js`) should fail with `Cannot find module ... DS_ReasonerAdapter` (proving the test exists and target is missing).
