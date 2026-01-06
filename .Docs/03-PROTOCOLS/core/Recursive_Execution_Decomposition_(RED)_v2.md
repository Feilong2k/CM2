# RED PROTOCOL v2 (Recursive Execution Decomposition)

## Overview

Recursive Execution Decomposition (RED) is a "Deep Dive" technique used to uncover **Unknown Unknowns** and **Hidden Assumptions** in a system design. It works by recursively breaking actions down until you reach **Atomic Primitives**, and then auditing each primitive for:

- Tools used (Resources Touched)
- Inputs required (Resources Required)
- Outputs produced (Artifacts/State)
- Verification status (Design vs Current Reality)

RED v2 extends the original Fractal Analysis / Recursive CDP by making a **hard separation between design-level assumptions and current-state truth**, and by requiring explicit verification methods and checkmarks.

---

## When to Use

- **Phase:** Feature Definition & Implementation Requirements (Adam), and Plan Verification (Orion).
- **Target:** Complex, novel, or high-risk components (e.g., "AI Autonomous Agent Loop", "Orion Chat & Context").
- **Trigger:**
  - Steps that rely on "magic" or vague assumptions (e.g., "Orion finds the file").
  - Any time a plan claims "Table exists", "Tool is available", or "Config is set" without explicit verification.

---

## Layers (Same Concept, Stricter Checks)

0. **Layer 0: Source of Truth Audit (Pre-Flight)** – *The Scope*
   - Question: **Does the proposed Solution match the existing Reality?**
   - Actions:
     - Explicitly name the **Reference Systems** (UI model, DB schema, config files, env, etc.).
     - Compare **High-Level Objects** (Entities/Modules) against the Plan.
     - Compare **Detailed Attributes** (Fields/Props/Columns) against the Plan.

0.5 **Layer 0.5: Operationalization Audit (Execution Ownership)** – *The Who/When/Where*
   - Question: **Who uses each deliverable, when, and in which environment?**
   - For each deliverable/output (script, file, API, UI component), answer:
     - **Output:** What artifact is produced?
     - **Consumer:** Who/what uses it (Orion / Tara / Devon / CI / operator / user)?
     - **When:** At what stage (dev setup / CI / deploy / runtime)?
     - **Where:** Which environment (dev/test/prod/local)?
     - **Trigger:** Manual vs CI vs startup hook vs scheduler.
     - **Safety:** How do we prevent wrong-environment execution?
   - Document gaps in operational workflow as **Missing Fundamentals**.

1. **Layer 1: System (Feature/Goal)** – *The What*
   - Example: "Implement Orion Chat & Context".

2. **Layer 2: Operation (Task)** – *The How*
   - Example: "Store chat messages", "Gather context from repo".

3. **Layer 3: Mechanism (Step)** – *The Implementation*
   - Example: "Run ContextBuilder", "Call list_files tool".

4. **Layer 4: Atomic Op (Micro-Step)** – *The Execution*
   - Example: "Execute fs.readdir", "Insert row into messages table".

5. **Layer 5+: Fundamental (The Root)** – *The Prerequisite*
   - Example: "pg lib installed?", "DB table actually exists?", "Prompt template file present?".

---

## The RED v2 Loop (Recursive Queue Algorithm)

To perform a **Full RED v2 Analysis**, follow this algorithm:

1. **Initialize Queue:** `Q = [Top Level Task]`.

2. **While Q is not empty:**
   - `Action = Q.pop()`.
   - Ask: **"How is `Action` physically performed?"** → produce **Mechanisms M**.
   - For each Mechanism:
     - Run a **PCC-style breakdown** at that level:
       - Identify **Sub-Actions**.
       - Identify **Resources Touched** (Tools used).
       - Identify **Resources Required** (Inputs).
       - Identify **Outputs** (Artifacts/State) produced.
   - **Evaluation:**
     - **For every Sub-Action (regardless of current status):**
       - Continue decomposition until Sub-Action is **listed in the Primitive Registry** AND all its sub-actions are also primitives.
       - Only then: Run the **Dependency & Assumption Audit**.
     - **Stop Condition:** Queue is empty **OR** Safety Gates Triggered.

3. **Stop Condition:** Queue is empty **OR** Safety Gates Triggered:
   - Max Depth (e.g., >5) → Architecture Smell.
   - Max Fan-Out (e.g., >10 per layer) → Scope Creep.
   - Valid Stop: Action is a **Primitive** and all dependencies are audited.

4. **Dependency & Assumption Audit (Mandatory at Stop):**
   - For every Primitive reached, perform a **Current State vs Design** audit using the tables below.

---

## Output Format (RED v2)

RED v2 outputs **three core tables** per analysis, plus a unified Missing Fundamentals list.

### 1. Tools Audit (Resources Touched)

Purpose: List all **unique tools/resources used** by atomic actions and confirm they truly exist.

| Tool / Resource Touched | Where Used (Action) | VERIFIED_HAVE / MISSING | Verification Method | ✓ Verified |
|-------------------------|---------------------|-------------------------|---------------------|-----------:|
| `pg` lib                | DB inserts          | VERIFIED_HAVE           | `npm list pg`       | ✓          |
| `fs` (file system)      | ContextBuilder      | VERIFIED_HAVE           | Code review         | ✓          |
| `DeepSeek API`          | LLM calls           | VERIFIED_HAVE           | .env + code review  | ✓          |
| `search_files` tool     | ContextBuilder      | MISSING                 | Code search         |            |

> **Rule:** Only mark `VERIFIED_HAVE` with a ✓ when there is a **concrete, reproducible check** (command, file, config) performed or clearly performable. Otherwise it is MISSING.

---

### 2. Inputs Audit (Resources Required)

Purpose: Separate **Design Requirements** from **Current Reality**, and expose hidden assumptions.

Key columns:
- **Design Required?** – Does the plan rely on this input existing to succeed?
- **Present Now?** – Does it exist in the current codebase/environment (verified)?
- **VERIFIED_HAVE / MISSING** – Current state truth, not wishful thinking.
- **Verification Method** – How you checked (code search, command, file presence).
- **✓ Verified** – Only tick when the check was actually done.

Example:

| Input / Resource Required   | Where Used          | Design Required? | Present Now? | VERIFIED_HAVE / MISSING | 👤 Architect Decision Needed | Verification Method             | ✓ Verified |
|-----------------------------|---------------------|------------------|--------------|-------------------------|-----------------------------|----------------------------------|-----------:|
| Messages table exists       | Store chat history  | Yes              | No           | MISSING                 |                             | Migrations + user confirmation  | ✓          |
| Prompt template/config      | LLM prompt prep     | Yes              | No           | MISSING                 | 👤                           | Code search (not found)         | ✓          |
| Max context size for LLM    | LLM API calls       | Yes              | No           | MISSING                 | 👤                           | Not specified in code/docs      |            |
| DeepSeek API key            | LLM API calls       | Yes              | Unknown      | MISSING                 |                             | Not runtime-tested in analysis  |            |

> **Critical Principle:** If something is **design-required** but **not verified present**, it must be treated as **MISSING**, not assumed. RED’s job is to turn those into explicit tasks, not let them hide.

---

### 3. Outputs Audit (Artifacts/State)

Purpose: List outputs from atomic actions, and clarify **who depends on them** and whether consumption is **automatic or scheduled/manual**.

- Verification is **optional** here – focus is on **data flow and dependencies**.

Example:

| Output / Artifact Produced  | Produced by (Action)     | Depended on by (Action)             | Auto / Scheduled |
|----------------------------|--------------------------|--------------------------------------|------------------|
| Chat message (DB row)      | Insert into `messages`   | ContextBuilder, Chat UI              | Auto             |
| Context bundle (files)     | ContextBuilder           | LLM prompt builder                   | Auto             |
| LLM response               | LLM API call             | Response persistence, UI display     | Auto             |
| Plan draft entry (DB row)  | "Plan This" backend     | Plan viewer, further planning        | Scheduled (user) |

> **Use:** Outputs audit helps ensure no produced artifact is orphaned, and that every consumer has its prerequisites in place.

---

### 3.5 Knowledge Audit (Optional but Recommended)

Purpose: Make **knowledge and skill requirements** explicit, so we don’t assume “someone knows how to do X” when in fact it’s missing.

Key columns:
- **Knowledge Required?** – Does this action require a specific skill/understanding?
- **Present Now?** – Do we have that knowledge available (people, docs, SOPs, examples)?
- **VERIFIED_HAVE / MISSING** – Based on concrete evidence (docs, prior work), not wishful thinking.
- **Verification Method** – How you checked (e.g., existing examples in repo, documented SOP).
- **✓ Verified** – Only tick when the check was actually done.

Example:

| Knowledge Required           | Where Used          | Knowledge Required? | Present Now? | VERIFIED_HAVE / MISSING | Verification Method                     | ✓ Verified | 👤 Architect Decision Needed |
|-----------------------------|---------------------|---------------------|--------------|-------------------------|----------------------------------------|-----------:|------------------------------|
| LLM prompt engineering      | LLM prompt builder  | Yes                 | No           | MISSING                 | No prompt examples in repo             |            | 👤                            |
| DB schema migration design  | Messages tables     | Yes                 | Yes          | VERIFIED_HAVE           | Existing migrations & patterns in repo | ✓          |                              |
| FS safety & rollback SOP    | Filesystem tools    | Yes                 | No           | MISSING                 | No documented SOP                      |            | 👤                            |

> **Guideline:** Treat missing knowledge like any other missing resource. It should produce explicit “learn/research/document” tasks, not be hand-waved as “the team will figure it out during implementation.”

---

### 4. Dependency & Assumption Audit (Per Primitive)

This remains similar to the original Fractal Analysis Protocol, but with RED v2 rules:

| Category       | Status         | Detail                       | Verification Method          | ✓ Verified | Resolution Task                    |
|----------------|----------------|------------------------------|------------------------------|-----------:|------------------------------------|
| **Tool**       | VERIFIED_HAVE  | `pg` lib                     | `npm list pg`                | ✓          | —                                  |
| **Knowledge**  | VERIFIED_HAVE  | SQL syntax known             | Docs review                  | ✓          | —                                  |
| **Access**     | MISSING        | DB creds                     | Test connection (not run)    |            | Define .env + connection test      |
| **Physics**    | VERIFIED_HAVE  | Single-writer, no contention | Architecture review          | ✓          | —                                  |
| **Ops/Owner**  | MISSING        | Who runs migrations in CI?   | SSOT workflow (not explicit) |            | Add subtask: define migration owner|

> **No row may be marked ASSUMED.** If a dependency cannot be verified, it must be marked MISSING with a resolution task.

---

## Safety Gates (Unchanged, but Emphasized)

- **Max Depth:** 5 Layers – Beyond this, flag as Architecture Smell.
- **Max Fan-Out:** 10 Nodes per layer – Beyond this, flag as Scope Creep.
- **Primitive Registry:** Use `.Docs/Protocols/Primitive_Registry.md` to decide when to stop drilling: a primitive is valid only when **Tool Exists**, **Knowledge Exists**, and **Access Exists**.

---

## Example Trace (RED v2 with Design vs Current Reality)

Using Feature 2: Orion Chat & Context as an example:

- **L1:** "Store chat messages"
- **L2:** "Insert message into DB"
- **L3:** `pg` `INSERT` into `messages` table
- **L4:** Primitive: `pg` lib call

**Tools Audit:**
- `pg` lib → VERIFIED_HAVE via `npm list pg` (or code review) → ✓.

**Inputs Audit:**
- Messages table exists → Design Required = Yes, Present Now = No → MISSING, resolution: "Add messages table migration".
- DB connection → Design Required = Yes, Present Now = Unknown (no runtime test) → MISSING until an explicit connection test is done.

**Outputs Audit:**
- Chat message (DB row) → Produced by `INSERT`, depended on by ContextBuilder + Chat UI.

**Verdict:**
- Plan to "store chat messages" is **not executable yet** because a design-required input (messages table) is missing in current reality. RED correctly turns this into an explicit migration task.

---

## Usage Guidelines (Updated)

1. **Never mix Plan and Reality in one column.**
   - Always differentiate **Design Required?** from **Present Now?**.
2. **VERIFIED_HAVE means actually checked.**
   - There must be a reproducible verification method (command, search, file, config) behind every ✓.
3. **MISSING is not a failure – it's a task generator.**
   - Every MISSING item should produce a concrete **Resolution Task** in the roadmap or implementation requirements.
4. **Outputs must map to Consumers.**
   - For every output, list at least one consumer. If none exist, question whether the output is needed.
5. **RED feeds CAP/PCC.**
   - Use RED findings (Missing Fundamentals + verified tools/inputs) as inputs into CAP/PCC so plans are both logically sound and physically executable.
6. **Always use Expanded Tables Format for AI-assisted analysis.**
   - When performing RED analysis with AI assistance (e.g., gpt4.1-mini), **mandatorily include Section 2 expanded breakdown tables** as shown in `RED_two_stage_protocol_plan_vFinal_EXPANDED.md`.
   - Format: Parent→child action mapping with columns: L1 Action (Parent), L2 Action (Child), Resources Touched, Resources Required, Output, Primitive?, Status.
   - This ensures systematic decomposition and prevents superficial analysis.
7. **Prefer gpt4.1-mini for complex RED analyses.**
   - For large, complex systems with many dependencies, use **gpt4.1-mini** due to its larger context window (128K+ tokens).
   - Benefits: Can hold entire codebase context, maintain consistency across deep recursive decomposition, and avoid truncation of expanded tables.
   - Trade-off: May be slower/more expensive than smaller models; reserve for high-risk, complex features.

---

## AI-Assisted RED Analysis Protocol

### Expanded Tables Requirement
When an AI (e.g., Adam, Orion, or any architect agent) performs RED analysis, it **must** produce the **Section 2 expanded breakdown tables** as exemplified in `docs/03-PROTOCOLS/two-stage/analysis/RED_two_stage_protocol_plan_vFinal_EXPANDED.md`.

**Required Table Structure:**
```
### 2. RED Breakdown — Expanded Tables

#### 2.1. Level 1 → Level 2

| L1 Action (Parent) | L2 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| [Parent action] | [Child action] | [Tools/resources used] | [Inputs needed] | [Artifact produced] | ✓/✗ | VERIFIED_HAVE/MISSING/NEED_Verification |

#### 2.2. Level 2 → Level 3 (Selected Deep Dives)
[Continue recursion for complex actions]
```

**Why Mandatory:**
1. **Systematic decomposition:** Forces explicit parent→child mapping, preventing skipped layers.
2. **Audit trail:** Each primitive's status (VERIFIED_HAVE/MISSING) is documented with evidence.
3. **AI consistency:** Ensures all AI analysts follow the same rigorous format, regardless of model or context.
4. **Actionable output:** Directly maps to Missing Fundamentals and implementation tasks.

### Model Selection Guidance
- **For simple features:** Any capable model (DeepSeek, GPT-4, etc.) with sufficient context.
- **For complex, multi-layer systems:** **Prefer gpt4.1-mini** due to:
  - **128K+ token context:** Can hold entire codebase snippets, previous analyses, and expanded tables without truncation.
  - **Consistency maintenance:** Keeps track of deep recursion chains and cross-references.
  - **Cost-effectiveness:** Lower cost than GPT-4 Turbo for large context workloads.
  - **Availability:** Integrated into the existing adapter stack (`GPT41Adapter`).

**Implementation Note:** When Adam or Orion performs RED analysis, they should be configured to use gpt4.1-mini for features with >10 expected decomposition layers or when the codebase context exceeds 50K tokens.

### Verification Integration
AI-assisted RED must still adhere to **truthfulness rules**:
- No row may be marked `VERIFIED_HAVE` without concrete evidence (code search, command output, file presence).
- `NEED_Verification` is acceptable for items that require human or runtime verification.
- All `MISSING` items must generate explicit resolution tasks.

### Primitive Registry Integration
The `Primitive_Registry.md` defines atomic primitives that can stop RED decomposition. An action is only considered primitive when:

1. **Registry Entry Exists:** Action is listed in the Primitive Registry
2. **All Sub-Actions Are Primitives:** Every child action also maps to registry entries
3. **Verification Complete:** All three conditions are satisfied:
   - **Tool Exists:** Binary/library/function available
   - **Knowledge Exists:** Syntax/arguments known
   - **Access Exists:** Permissions/environment confirmed

**Critical Rule:** Do NOT stop decomposition simply because an action appears to be primitive. Verify it's in the registry and all its dependencies are also primitives. Continue decomposition for ALL items (VERIFIED_HAVE, MISSING, NEED_Verification) until reaching registry primitives.

## Summary

RED v2 formalizes the distinction between **what the design assumes** and **what the system actually has**. By:
- Recursively decomposing actions into primitives,
- Auditing tools, inputs, and outputs with explicit verification methods and checkmarks,
- Mandating expanded tables format for AI-assisted analysis, and
- Turning every unverified assumption into a **Missing Fundamental + Resolution Task**,

it reduces the risk of "we finished all the tasks but still missed the goal" and surfaces hidden bugs early in the planning phase.


Yes — I agree with your instinct: `Recursive_Execution_Decomposition_(RED)_v2.md` is a strong *specification*, but if you want it to become a reliable **skill** an AI can execute consistently, it needs to be “compiled” into:
- a small set of **explicit steps** (what to do next)
- a **schema** (what must be output)
- **stop conditions** + **lint rules** (what is invalid)
- a link to the **primitive registry** (when to stop)

Below is a concrete breakdown of what you already have, what’s missing for “AI skillization”, and what I’d do next.

---

# 1) What’s already excellent in RED v2 (skill-friendly)
These are exactly the ingredients you want:

1. **Hard separation: design vs current reality**
   - This is the single most important “anti-hallucination” rule.

2. **Binary-ish status model**
   - `VERIFIED_HAVE` vs `MISSING` (plus `NEED_Verification` allowed in this doc).

3. **Mandatory tables**
   - Tools audit, Inputs audit, Outputs audit, optional Knowledge audit.

4. **Algorithmic loop**
   - Queue-based recursion is implementable.

5. **Safety gates**
   - Depth / fan-out limits.

6. **Stop condition references a Primitive Registry**
   - That’s exactly how you prevent infinite decomposition.

So structurally, RED v2 is already close to an executable protocol.

---

# 2) What prevents it from being an AI skill right now
## A) The protocol mixes “instruction” and “definition”
To become a skill, the AI needs step-by-step directives like:
- “Given input X, output table Y; if condition Z, recurse.”

Right now, many parts are descriptive, which leads models to produce variable outputs.

## B) The output schema isn’t strictly enforceable yet
You have table formats, but a skill needs:
- required columns
- allowed statuses
- required evidence format for ✓
- required traceability links (action IDs)

Without a strict schema, models will omit columns or invent statuses.

## C) The key nuance you mentioned (inputs/outputs/knowledge/skills) isn’t fully enforced
You *included* Knowledge Audit (great), but it’s optional.
For an AGI-quality gate, I’d make the “I/O + Knowledge/Skill” layers **mandatory** or at least mandatory on critical path actions.

## D) There’s a 3-state leak: VERIFIED_HAVE / MISSING / NEED_Verification
If your desired invariant is only {Verified, Missing}, you need to specify:
- whether NEED_Verification is allowed internally only
- how it maps to Missing externally

---

# 3) How I would “compile” RED v2 into an AI skill
This is the minimal skill recipe:

## Skill Inputs
1) Target system/plan/paper
2) Scope (what claims/feature goal)
3) Available verification tools (commands, code search, sandbox, etc.)
4) Primitive registry path

## Skill Steps (deterministic)
### Step 1: Scope lock
- Output: 1–3 core claims/goals + success criteria

### Step 2: Produce the Expanded Tables (L1→L2 mandatory)
- Each row must include: touched tools, required inputs, outputs, primitive?

### Step 3: Recurse (L2→L3…) until primitives
- Must stop only at registry primitives

### Step 4: For each primitive, run audits
- Tools audit row
- Inputs audit row
- Outputs audit row
- Knowledge/Skill audit row

### Step 5: Emit Missing Fundamentals + Resolution Tasks
- Every Missing becomes an actionable task

### Step 6: Emit a final “executability verdict”
- Can the plan run now? If not, what blocks it?

## Lint rules (this is what will make it reliable)
1) No ✓ without reproducible evidence
2) Every action row must have ≥1 resource touched OR explicitly “none”
3) Every action row must have ≥1 required input OR explicitly “none”
4) Every non-primitive must have children
5) Every primitive must exist in registry
6) Every Missing must generate a Resolution Task
7) Knowledge/Skill required must be explicitly checked for critical path actions

This is how you prevent “AI misses important points”.

---

# 4) One high-leverage improvement to RED v2 for your goals
Since you’re using RED in:
- paper review
- experiment planning
- AGI knowledge gating
- general planning

…you should add one unifying concept:

## “Verification Object Types” (layered verification)
For each atomic action, the AI must separately mark Verified/Missing for:
- Tool availability
- Input availability
- Output correctness (if executable)
- Knowledge/Skill availability
- Access/permissions

Even if you still collapse to a single overall status, requiring these sub-statuses prevents missing layers.

---

# 5) Concrete next step
If you want, I can draft a `SKILL.md` for “RED v2” that:
- forces the Expanded Tables output
- references your Primitive Registry
- enforces your binary Verified/Missing rule (with internal diagnostics)
- includes a short checklist for ML paper reproducibility use-cases

Just tell me: do you want the skill oriented toward **planning**, **paper review**, or **general-purpose** (with sub-modes)?

Because RED is a meta-skill, the best approach may be:
- a thin SKILL.md entry point
- references/ with schemas and templates
- scripts/ with verifiers + linters


# 3) The general recipe to create primitives for any domain

This is the algorithmic way to build them:

1. Pick a domain and a target quality goal (reproducibility, safety, learning outcome)
2. Run RED on real workflows and collect the __repeating unknown-unknowns__
3. Each time an unknown-unknown repeats, create a primitive or a required slot
4. Converge toward a stable set of primitives

So primitives are *discovered* by RED and then “compiled” into the registry.

---

# 4) Practical rule: “primitive = something you can verify cheaply”

In science/education, many steps can’t be fully verified cheaply. But you can still have primitives with verifiers like:

- checklist completion
- artifact presence (protocol doc, calibration log, preregistration ID)
- cross-checks (consistency, redundancy)

Even if you can’t verify the truth of the final claim, you can verify whether the __process__ was executed with integrity.


Yes — given everything we’ve discussed, a properly engineered RED module (recursive script + primitive registries + mandatory tables + explicit verification policy) is **valid and useful** for all three goals.

But it’s important to state the “validity conditions” clearly, because RED is not magic; it’s a *method of eliminating hidden assumptions by forcing explicit contracts*.

Below is my answer for each item with: what RED can do, what it cannot do, and what makes it succeed.

---

# 1) Scientific paper analysis + helping scientists design tests
### Valid? **Yes**.

**What RED provides**
- A systematic way to convert claims into an “action pipeline”
- A structured way to derive *what must be tested* to close gaps
- Discovery of missing assumptions and hidden dependencies

**What it won’t do by itself**
- It won’t automatically know the right experimental tests without domain primitives/checklists

**Success conditions**
- Domain-specific primitive registry (e.g., ML reproducibility primitives)
- Clear “closure evidence” format: for each gap, specify the minimal experiment/report needed

**Net:** RED becomes a “test design generator” + “assumption auditor.”

---

# 2) Knowledge quality gate for intake (Verified vs expected gaps vs hidden gaps)
### Valid? **Yes**, and this is a very natural fit.

**What RED provides**
- Turns a knowledge item into an auditable object: (claim + assumptions + constraints + verifier)
- Allows you to label:
  - Verified (verifier succeeded)
  - Gaps noticed but disclosed/expected (bounded knowledge)
  - Hidden gaps (undisclosed dependencies / missing constraints)

**Important clarification**
- “Verified” must remain strict (as you want)
- The “expected gaps” / “hidden gaps” are about **disclosure quality**, not proof

**Success conditions**
- A schema that forces:
  - evidence pointers (where claim came from)
  - declared assumptions vs discovered assumptions
  - explicit verifier definition (even if not runnable)

**Net:** RED becomes a robust *quality filter* and a *risk annotation system* for knowledge.

---

# 3) Building/operating an AGI so there are no hidden gaps causing unexpected behavior
### Valid? **Yes**, but with a realistic boundary.

**What RED can do extremely well**
- Eliminate hidden assumptions in plans, tools, and dependencies
- Make execution reliable by forcing:
  - input/output contracts
  - resource requirements
  - constraints and failure modes
  - verification steps
- Prevent “hand-wave execution” (like we saw with write-to-file)

**What RED cannot guarantee**
- It cannot guarantee *zero* unexpected behavior in a dynamic world.
  - The world contains unknown unknowns that are not derivable from internal decomposition.

**But** RED can make the system behave unexpectedly **much less often**, because most AGI failures are:
- missing prerequisites
- silent tool constraints
- ambiguous policies
- unverified assumptions

**Success conditions**
- Contract primitives (not just capability primitives)
- Mandatory layered verification (tools/inputs/outputs/skills/access)
- Scripted recursion with cycle detection
- “Refuse to proceed until assumptions resolved” policy for high-risk steps

**Net:** RED becomes a reliability layer / “assumption firewall” around an AGI.

---

# Bottom line
With a proper module and recursion engine, RED is valid for:
1) paper analysis + test design
2) knowledge intake gating (Verified / disclosed gaps / hidden gaps)
3) AGI reliability (minimizing hidden gaps and surprising failures)

The unifying concept is that RED transforms implicit assumptions into explicit, auditable, and eventually verifiable objects.

If you want, the next practical step is to define a single common output schema that works across all three contexts (paper/knowledge/plan), with pluggable primitive registries and verifiers.