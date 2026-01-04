# PCC (Plan Verification Protocol) Analysis
**Document:** Post‑Orion‑Rebuild‑Process.md  
**Date:** 2025‑12‑30  
**Analyst:** Adam (Architect)

## 1. LIST ACTIONS
What needs to happen after Orion Rebuild (Feature 1, Task 1) is complete?

1. **Create database extensions** – `steps` and `work_stages` tables (migrations).
2. **Build helper services** – `StepDecomposer`, `ContextBuilder`, `AiderInvoker`, `ResultProcessor`, `TestRunner`, `TestResultParser`.
3. **Define Aider prompts** – templates for TaraAider (testing) and DevonAider (implementation).
4. **Create skill directories** – `aider_orchestration` and `test_execution` with SKILL.md, scripts, references.
5. **Integrate skills into OrionAgent** – dynamic skill loading, CLI triggers.
6. **Test end‑to‑end** – run a simple feature (e.g., add a new API endpoint) through the full workflow.

## 2. FIND RESOURCES
What enables each action?

- **Database**: PostgreSQL with existing `projects`, `features`, `tasks`, `subtasks` tables; new `steps`, `work_stages` tables.
- **File system**: Project codebase (for reading/writing files), skill directories (`backend/skills/`).
- **OrionAgent** (existing) – with FS/DB tools, trace emission, CLI.
- **Aider instances** – external prompting engines (TaraAider, DevonAider) that accept prompts and return file changes.
- **Test suite** – existing Jest/Vitest infrastructure.
- **Environment variables** – `DEEPSEEK_API_KEY` (already used by Orion).
- **Skill registry** – a mechanism to index and load skills (to be built).

## 3. IDENTIFY GAPS & MAP DATA FLOW
**CDP (Constraint Discovery Protocol) Level 3 applied:**

### Atomic Actions
1. `db_migration_create_steps` – create `steps` table.
2. `db_migration_create_work_stages` – create `work_stages` table.
3. `service_step_decomposer` – Orion calls FS/DB tools, writes steps to DB.
4. `service_context_builder` – reads file content, DB history, builds JSON context.
5. `service_aider_invoker` – crafts prompt, calls external Aider, captures response.
6. `service_result_processor` – applies file diff, updates step status.
7. `service_test_runner` – runs test suite, captures output.
8. `service_test_result_parser` – extracts pass/fail info.
9. `skill_loader` – loads SKILL.md and scripts into Orion’s memory.
10. `cli_trigger` – user command → Orion → skill activation.

### Resources Touched
| Resource | Action | Notes |
|----------|--------|-------|
| PostgreSQL (`steps`) | Write | StepDecomposer writes steps |
| PostgreSQL (`steps`) | Read/Update | ContextBuilder reads, ResultProcessor updates |
| File system (project files) | Read | ContextBuilder reads target file |
| File system (project files) | Write | ResultProcessor applies Aider’s diff |
| External Aider (TaraAider/DevonAider) | Write/Read | AiderInvoker sends prompt, receives response |
| Test suite (npm test) | Execute | TestRunner spawns child process |
| Skill directory (`backend/skills/`) | Read | SkillLoader reads SKILL.md and scripts |
| OrionAgent memory | Read/Write | SkillLoader loads instructions, Orion uses them |

### Resource Physics & Gaps
| Resource | Constraint | Risk | Mitigation |
|----------|------------|------|------------|
| PostgreSQL (`steps`) | Table must exist before writes | StepDecomposer fails | Run migrations before helper services start |
| File system (target file) | File may not exist | ContextBuilder fails | Handle missing file gracefully (create empty?) |
| External Aider | Network latency, rate limits, prompt quality | Aider returns error or nonsense | Retry with better context, fallback to manual |
| Test suite | Tests may be flaky, require specific environment | False positives/negatives | Isolate test environment, capture full output |
| Skill directory | SKILL.md must follow YAML + markdown format | Malformed skill breaks loading | Validate on load, fallback to default behavior |
| OrionAgent memory | Skills increase token usage | Context window overflow | Progressive loading (metadata → full skill) |

### Data Flow Map
```
User → CLI → OrionAgent → StepDecomposer → DB (steps)
OrionAgent → ContextBuilder → (File + DB) → JSON context
OrionAgent → AiderInvoker → External Aider → Response
OrionAgent → ResultProcessor → (Apply diff + Update DB)
OrionAgent → TestRunner → Test suite → TestResultParser → DB
```

**Gaps identified:**
1. **No error‑handling flow** – what happens if Aider returns malformed diff?
2. **No rollback mechanism** – if a step fails, how to revert file changes?
3. **Skill versioning** – how to update a skill without breaking existing workflows?
4. **Aider response format** – assumed to be a file diff; what if it’s a confirmation or error message?
5. **Test isolation** – running full test suite may be slow; need ability to run subset.

## 4. MAP DEPENDENCIES
1. Database migrations (1,2) → helper services (3‑8).
2. Helper services (3‑8) → skill integration (9).
3. Skill integration (9) → CLI triggers (10).
4. Aider prompts (3) must be defined before AiderInvoker (5) can work.
5. Test suite must be runnable before TestRunner (7) can execute.

**Blocking dependencies:**
- `steps` table must exist before `StepDecomposer` can write.
- Skill directories must exist before `SkillLoader` can load.

## 5. CHECK INTEGRATION
- **Input/output alignment**: 
  - `ContextBuilder` output matches `AiderInvoker` input (JSON context).
  - `AiderInvoker` output matches `ResultProcessor` input (file diff + metadata).
  - `TestRunner` output matches `TestResultParser` input (stdout/stderr).
- **Communication protocols**: 
  - Aider interaction is via prompt text (unstructured). Need a contract (e.g., “respond with a unified diff”).
  - Skills are loaded as text; Orion must parse YAML frontmatter and instructions.
- **Error handling**: Not specified; must be added to each service.

### 5.1 VALIDATE TEST SEAMS
- **Injection seams**: 
  - `StepDecomposer` can receive a mock OrionAgent.
  - `ContextBuilder` can receive mock FS/DB tools.
  - `AiderInvoker` can receive a mock Aider client.
  - `TestRunner` can receive a mock child‑process spawner.
- **Observation seams**: 
  - DB writes can be observed via querying `steps` table.
  - File changes can be observed via reading file content.
  - Test results can be observed via parsed output.
- **Verdict**: Plan is **testable** because each service can be injected and its effects observed.

## 6. VALIDATE COMPLETENESS
**Goal**: Enable Orion to delegate subtasks to TaraAider/DevonAider and run tests.

The plan covers:
- Database schema for tracking steps.
- Helper services for decomposition, context building, Aider invocation, result processing, test execution.
- Skill definition for orchestration and test execution.
- Integration into OrionAgent and CLI.

**Missing**:
- Detailed Aider prompt templates (only mentioned).
- Skill‑loading implementation details.
- Error‑handling and rollback strategies.
- Monitoring/observability for the Aider workflow (beyond existing traces).

## 7. DEFINE VERIFICATION TESTS
For each component:

1. **`steps` table migration** – verify table exists with correct columns.
2. **`StepDecomposer`** – given a feature description, produces N steps in DB.
3. **`ContextBuilder`** – given a step ID, returns JSON with file content and context.
4. **`AiderInvoker`** – given context, calls mock Aider and returns simulated diff.
5. **`ResultProcessor`** – given diff, applies to test file and updates step status.
6. **`TestRunner`** – runs a known test and captures output.
7. **`TestResultParser`** – parses test output into pass/fail summary.
8. **Skill loading** – loads SKILL.md, extracts YAML, makes instructions available to Orion.
9. **End‑to‑end** – CLI command “implement feature X” triggers full flow, results in file change and step completion.

---

## PVP VERDICT
**Plan is CONDITIONALLY SAFE** – it outlines the necessary components and flow, but several gaps must be addressed before implementation:

1. **Specify Aider prompt templates** (what exactly do TaraAider and DevonAider expect?).
2. **Define error‑handling and rollback** for each service.
3. **Detail skill‑loading mechanism** (registry, progressive loading, validation).
4. **Clarify Aider response format** (diff vs. confirmation vs. error).
5. **Add observability** – extend trace events to cover Aider invocation and test execution.

**Recommendation**: Create a follow‑up ADR or detailed spec for the Aider orchestration skill before starting implementation.
