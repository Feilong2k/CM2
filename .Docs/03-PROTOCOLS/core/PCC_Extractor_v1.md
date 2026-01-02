```md
# PCC Extractor (Action+Resource Coverage) — Spec v1

## Goal
Convert a **messy plan** (freeform text) into a **Constraint Discovery Protocol (CDP) Level 1+** artifact that is:
1) **Traceable** (every extracted item points to a source quote)
2) **Auditable for omissions** (every sentence/line is either mapped or explicitly marked “no action”) 
3) **Deterministically checkable** (non‑LLM checks can detect likely missing actions/resources)

This is specifically meant to prevent the failure mode:
> “LLM produced a clean list but silently skipped an action or resource.”

---

## Inputs
- `plan_text`: the raw plan (markdown, bullets, mixed notes)
- Optional `context_hints`:
  - system boundary (“backend only”, “db+api+ui”)
  - known resources catalog (DB, FS, external APIs)
  - known primitives registry (your Primitive_Registry)

---

## Output: CDP Extractor Artifact (YAML)

### Section 0 — Source Map (MANDATORY)
Break the plan into numbered “source units” so coverage can be audited.

**Rule:** Each bullet / sentence / numbered step becomes a `source_unit`.

```yaml
source_map:
  - id: S1
    location: "Plan.md > Section 2 > bullet 1"
    quote: "Frontend POSTs /api/chat with message"
  - id: S2
    location: "Plan.md > Section 2 > bullet 2"
    quote: "Backend validates and stores message"
```

### Section 1 — Atomic Actions (WITH CITATIONS)
Every atomic action must cite at least one `source_unit`.

```yaml
atomic_actions:
  - id: A1
    name: frontend_send_message
    description: "Frontend sends POST /api/chat"
    sources: [S1]
    confidence: high | medium | low
    assumptions:
      - "Auth is not required" # optional

  - id: A2
    name: backend_validate_payload
    description: "Validate incoming message payload"
    sources: [S2]
    confidence: medium
```

**Rules:**
- Actions must be discrete, single-responsibility.
- Use consistent verb_noun naming.
- If the extractor is unsure whether something is atomic vs composite, it must:
  - either split it, or
  - mark `confidence: low` and add an assumption.

### Section 2 — Resources Touched (ACTION-LINKED)
Every resource entry must link to the action(s) that touch it.

```yaml
resources_touched:
  - id: R1
    resource: "HTTP API: POST /api/chat"
    access: "Write"
    used_by_actions: [A1]
    sources: [S1]

  - id: R2
    resource: "PostgreSQL: chat_messages"
    access: "Write"
    used_by_actions: [A2]
    sources: [S2]
```

**Rules:**
- No “floating” resources: every resource must be used by >=1 action.
- If a resource is inferred (not explicitly mentioned), it must be marked:
  - `inferred: true`
  - plus a justification in `notes`.

### Section 3 — Coverage Ledger (THE OMISSION KILLER)
For every `source_unit`, record whether it was “covered.”

```yaml
coverage_ledger:
  - source_id: S1
    covered: true
    mapped_actions: [A1]
    mapped_resources: [R1]
    notes: "Explicit API call"

  - source_id: S99
    covered: false
    reason: "No atomic action extracted; needs review"
    suggested_action: "?"
```

**Rules:**
- The extractor MUST NOT claim completeness without a fully filled ledger.
- Anything `covered:false` becomes a mandatory follow-up.

### Section 4 — Missing Fundamentals (AUTO-GENERATED)
Anything required by design but not evidenced gets logged.

```yaml
missing_fundamentals:
  - id: M1
    type: "tool" | "access" | "config" | "knowledge" | "artifact"
    item: "DATABASE_URL_TEST"
    required_by_actions: [A2]
    evidence_sources: []
    status: "NEED_Verification" | "MISSING"
    next_probe: "Check backend/.env.example and runtime env"
```

---

## Deterministic Checks (Non‑LLM)
These checks run on the YAML output. They do not require any model.

### Check 1 — Source Coverage
- **FAIL** if any `source_unit` is `covered:false`.

### Check 2 — No orphan actions/resources
- **FAIL** if any action has `sources: []`.
- **FAIL** if any resource has `used_by_actions: []`.

### Check 3 — Action↔Resource consistency
- **WARN/FAIL** if:
  - an action’s description contains `db|postgres|sql` but no resource matches `PostgreSQL`.
  - an action contains `read_file|list_files|search_files` but no resource matches `File System`.
  - an action contains `http|endpoint|api` but no resource matches `HTTP`.

(Implementation can be simple keyword rules.)

### Check 4 — Canonical resource normalization
- Normalize resources into a controlled vocabulary:
  - `PostgreSQL`, `File System`, `HTTP API`, `External LLM API`, `Env Var`, `Git`, `CI`, `Memory/Context`
- **WARN** if a resource isn’t classifiable.

### Check 5 — Duplicate/overlap detection
- **WARN** if two actions have >0.8 similarity in name/description (likely double counting).

---

## Human-in-the-Loop Review Protocol (Fast)
If checks fail, the system should not “try harder” blindly. It should do one of:

1) Ask a focused question:
   - “Source S7 is uncovered: should it become an action? Here’s the quote.”

2) Run a probe:
   - repo search for referenced file/tool
   - DB schema inspection

3) Flag for architect review:
   - “Ambiguous ownership: who runs migrations (CI/startup/manual)?”

---

## Example (Tiny)

### Input plan
- "Frontend POSTs /api/chat"
- "Backend validates, stores message in DB"
- "Orion calls DeepSeek"

### Output (sketch)
```yaml
source_map:
  - id: S1
    location: "bullets"
    quote: "Frontend POSTs /api/chat"
  - id: S2
    location: "bullets"
    quote: "Backend validates, stores message in DB"
  - id: S3
    location: "bullets"
    quote: "Orion calls DeepSeek"

atomic_actions:
  - id: A1
    name: frontend_send_message
    description: "POST /api/chat"
    sources: [S1]
    confidence: high

  - id: A2
    name: backend_validate_request
    description: "Validate payload"
    sources: [S2]
    confidence: medium

  - id: A3
    name: database_store_message
    description: "Insert into chat_messages"
    sources: [S2]
    confidence: medium

  - id: A4
    name: llm_call_deepseek
    description: "Call DeepSeek API"
    sources: [S3]
    confidence: high

resources_touched:
  - id: R1
    resource: "HTTP API: POST /api/chat"
    access: "Write"
    used_by_actions: [A1]
    sources: [S1]

  - id: R2
    resource: "PostgreSQL: chat_messages"
    access: "Write"
    used_by_actions: [A3]
    sources: [S2]

  - id: R3
    resource: "DeepSeek API"
    access: "Write/Read"
    used_by_actions: [A4]
    sources: [S3]

coverage_ledger:
  - source_id: S1
    covered: true
    mapped_actions: [A1]
    mapped_resources: [R1]
  - source_id: S2
    covered: true
    mapped_actions: [A2, A3]
    mapped_resources: [R2]
  - source_id: S3
    covered: true
    mapped_actions: [A4]
    mapped_resources: [R3]
```

---

## Notes for integrating into CodeMaestro
- Make the LLM produce ONLY this structured artifact.
- Run deterministic checks.
- If checks fail, the orchestrator forces:
  - “Ask a question” OR “run a probe”
  - never “continue to implementation.”

This turns CDP/RED from a *prompting exercise* into an **auditable pipeline**.
```