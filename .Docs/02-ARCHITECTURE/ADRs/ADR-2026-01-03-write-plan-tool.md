# ADR-2026-01-03: Questionnaire-Based Write Tool ("WritePlanTool")

## Status
Proposed / Draft

## Context
The current `write_tools` (specifically `write_to_file` and `replace_in_file`) are fragile when used by LLMs.
- **Complex JSON:** Models often struggle to produce perfectly formatted JSON payloads with correct escaping, especially for large file content or complex regex replacements.
- **High Stakes:** A single malformed write can corrupt code or tests.
- **Ambiguity:** Intent is often lost in the low-level mechanics of "replace string X with Y".
- **Lack of Intermediate Validation:** The tool executes immediately upon receiving the payload; there is no "planning" step where the system can validate the intent before modifying the filesystem.

We have established a pattern (ADR-2026-01-03-skill-testing-framework and general project philosophy) of using **questionnaires** or **structured plans** for complex operations. This approach breaks down complex tasks into smaller, verifiable decisions.

## Decision
We will implement a **questionnaire-based interface** for file write operations, tentatively named `WritePlanTool` (or `FileSystemTool_plan_write`).

Instead of a single "do it" command with a massive payload, the interaction will follow a **Plan → Validate → Execute** pattern.

### 1. The "Write Plan" Schema
The LLM will not perform the write directly. Instead, it will submit a **Write Plan**.

**Structure (Conceptual):**
```json
{
  "intent": "Add a new helper function to the utils file",
  "target_file": "backend/src/utils/helpers.js",
  "operations": [
    {
      "type": "append", // or "create", "insert", "replace", "replace_all"
      "content_block": "function newHelper() { ... }",
      "location_marker": "module.exports =" // for insert operations
    }
  ],
  "safety_checks": {
    "backup_required": true,
    "must_exist": true
  }
}
```

### 2. Supported Operations (Phased Rollout)

**Phase 1 (MVP - High Reliability):**
- **Create New:** Create a file if it doesn't exist. Fail if it does.
- **Append:** Add content to the end of a file. Simple, low risk.
- **Overwrite:** Replace entire file content (safe for small config files or when full rewrite is intended).

**Phase 2 (Advanced - requiring robust logic):**
- **Insert:** Insert content *before* or *after* a specific marker (string/regex).
  - *Questionnaire aspect:* "What is the unique line or string I should look for?"
- **Replace Block:** Replace a specific block of code defined by start/end markers.
- **Replace All:** Find/replace all occurrences of a string.

### 3. The Execution Flow
1.  **Orion generates Plan:** Orion analyzes the request and produces a JSON "Write Plan" (as answers to a conceptual questionnaire).
2.  **System Validates Plan:**
    - Does the file exist? (If `must_exist` is true).
    - Is the `location_marker` unique? (If inserting).
    - Is the `content_block` valid?
3.  **System Executes (Deterministic):** A deterministic script (not the LLM) executes the plan using low-level filesystem operations.
4.  **Feedback:** The system returns a report: "Appended 15 lines to `helpers.js`. Backup saved to `helpers.js.bak`."

## Consequences

### Positive
- **Reduced Fragility:** LLMs are better at "answering questions" about what they want to do than crafting complex execution payloads.
- **Safety:** The validation step prevents common errors (writing to wrong file, inserting at ambiguous marker) *before* damage occurs.
- **Auditability:** The "Write Plan" serves as a log of intent.
- **Better Collaboration:** Supports the "Orion as Planner" workflow where Orion proposes a change (the plan) and the user (or a reviewer agent) confirms it.

### Negative
- **Latency:** Adds a step to the write process (Plan → Execute vs just Execute).
- **Complexity:** Requires building the plan parser and executor logic.

## Implementation Strategy
We will implement this as a new tool in `FileSystemTool` (e.g., `plan_and_execute_write`) or a dedicated `WritePlanTool`.

We will start with **Phase 1** (Create/Append) to immediately solve the most common "add code" use cases reliably, then iterate on the complex replacement logic.
