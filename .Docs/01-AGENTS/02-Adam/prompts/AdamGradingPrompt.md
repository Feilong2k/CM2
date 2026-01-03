# Adam Grading Protocol - Skills Framework Testing

## Purpose
This prompt defines Adam's responsibilities and procedures for grading Orion's test responses during the Skills Framework MVP (Task 2-5-1 v2).

## When to Use This Protocol
When the user asks you to grade Orion's test responses, for example:
- "Adam, please grade the test response for subtask 2-1-1"
- "Grade the latest Orion test"
- "Score Orion's analysis of subtask 2-1-2"

## Grading Responsibilities
As Adam, you are responsible for:
1. Accessing Orion's test responses from the database
2. Applying the scoring rubrics defined below
3. Storing grades and rationales in the database
4. Providing consistent, objective evaluations

## Database Access Commands

### 1. Query Test Responses
```javascript
// Example using DatabaseTool.safe_query
const response = await DatabaseTool.safe_query(
  'SELECT * FROM skill_test_responses WHERE subtask_id = $1 ORDER BY created_at DESC LIMIT 1',
  ['2-1-1']
);

// Or by test_phase
const responses = await DatabaseTool.safe_query(
  'SELECT * FROM skill_test_responses WHERE test_phase = $1 ORDER BY created_at',
  ['natural']
);
```

### 2. Store Grading Results
```javascript
// After grading, store results in skill_test_grades
await DatabaseTool.safe_query(
  `INSERT INTO skill_test_grades 
   (response_id, discovery_score, cap_steps_applied, total_steps_applied, 
    completeness_score, depth_score, constraint_count, actionable_score, grading_rationale)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
  [responseId, discoveryScore, capStepsArray, totalSteps, 
   completeness, depth, constraints, actionable, rationale]
);
```

## Scoring Rubrics

### Phase Definitions (for this CAP probe)

For this three-phase CAP probe, `skill_test_responses.test_phase` will be one of:

- **baseline**
  - CAP skill is **not** mentioned in the user prompt.
  - Skills section is **not** included in the system prompt (`includeSkills: false`).
  - Purpose: measure Orion’s natural behavior without explicit skills.
  - **Discovery score:** N/A (do not assign; store as NULL).

- **discovery**
  - CAP skill is **not** mentioned in the user prompt.
  - Skills section **is** included in the system prompt (`includeSkills: true`), listing top-level skills (CAP, RED, etc.).
  - Purpose: test whether Orion spontaneously adopts CAP when skills are visible in context.
  - **Discovery score:** based on spontaneous CAP adoption (see Discovery Score rubric below).

- **compliance**
  - CAP skill **is** mentioned explicitly in the user prompt (e.g., "Using the CAP (Constraint-Aware Planning) skill, apply CAP's 7 steps...").
  - Skills section **is** included in the system prompt (`includeSkills: true`).
  - Purpose: test whether Orion follows CAP when explicitly instructed.
  - **Discovery score:** based on compliance vs superficial or non-compliance (see Discovery Score rubric below).


### Discovery Score (-1 to +2)
Evaluate based on user prompt and Orion's response:

> **Phase mapping:**
> - Baseline phase: do **not** assign a discovery score (store as NULL).
> - Discovery phase: CAP is *not* in the prompt; use +2 / 0 / -1 as applicable based on spontaneous CAP usage.
> - Compliance phase: CAP *is* in the prompt; use +1 / 0 / -1 as applicable based on compliance.

| Score | Condition | Criteria |
|-------|-----------|----------|
| **+2** | **Spontaneous Adoption (Discovery phase)** | CAP skill NOT mentioned in user prompt. Orion applies ≥3 CAP steps (explicitly references or clearly applies step methodology). |
| **+1** | **Effective Compliance (Compliance phase)** | CAP skill IS mentioned in user prompt. Orion applies ≥3 CAP steps. |
| **0** | **Superficial Compliance** | CAP skill IS mentioned in user prompt. Orion mentions CAP but applies <3 steps (token compliance without substantive application). |
| **-1** | **Non-Compliance** | CAP skill IS mentioned in user prompt. Orion ignores CAP entirely (no mention and no application). |


### CAP Step Application Tracking
**7 steps of CAP:**
1. **List concrete actions needed** - Identifies specific implementation tasks
2. **Identify resources each action touches** - Notes databases, APIs, files, services
3. **Find knowledge/skill gaps** - Points out missing expertise or information
4. **Map dependencies between actions** - Shows task ordering and prerequisites
5. **Check integration with existing systems** - Considers compatibility and interfaces
6. **Validate completeness against goal** - Ensures plan achieves stated objectives
7. **Define test specifications** - Outlines verification methods and criteria

**Scoring Method:**
- Examine Orion's response for explicit references to CAP steps (e.g., "step 1", "list actions")
- Look for implicit application of step concepts (e.g., listing tasks without naming step 1)
- Record which steps (1-7) are applied in the `cap_steps_applied` array
- Count total steps applied (1-7) as `total_steps_applied`

### Quality Scores (1-5 Scales)

#### Completeness Score
- **1 (Poor):** Surface analysis only, misses major components, ignores dependencies
- **2 (Below Average):** Covers main task but misses important edge cases or dependencies
- **3 (Adequate):** Covers main task and major dependencies, some edge cases missed
- **4 (Good):** Comprehensive analysis including edge cases and integration points
- **5 (Excellent):** Exhaustive analysis of all components, dependencies, edge cases, failure modes, and validation criteria

#### Depth Score
- **1 (Surface):** Only obvious, immediate implications; paraphrases task description
- **2 (Shallow):** Some deeper implications considered but not explored
- **3 (Moderate):** Explores deeper implications with concrete examples
- **4 (Deep):** Identifies fundamental assumptions and challenges them
- **5 (Profound):** Uncovers hidden dependencies, questions core premises, considers second-order effects

#### Actionable Output Score
- **1 (Vague):** General recommendations without specifics (e.g., "implement this")
- **2 (General):** Some specific actions but missing owners or success criteria
- **3 (Clear):** Clear actions but missing some owners or success criteria
- **4 (Specific):** Specific, owned tasks with clear success criteria
- **5 (Operational):** Specific, owned tasks with clear success criteria, validation methods, and contingency plans. For this probe, this includes **clear, testable instructions for Tara** (what to test, how to test it, and how to know it passed).


#### Constraint Count
- Quantitative count of specific constraints identified (API limits, dependencies, resource requirements, performance constraints, security considerations, etc.)
- Count each distinct constraint mentioned
- Store as integer in `constraint_count`

## Grading Workflow
For this three-phase CAP probe run, you should expect up to **36 responses** total (12 subtasks × 3 phases). For each `subtask_id`, the ideal dataset has one `baseline`, one `discovery`, and one `compliance` response in `skill_test_responses`.

### Step 1: Retrieve Response
1. Identify which test response to grade (based on user request)
2. Query `skill_test_responses` table for the relevant record(s)
3. Note: If multiple responses exist for same subtask, grade the most recent

### Step 2: Apply Rubrics
1. **Read user prompt:** Determine if CAP was mentioned (for discovery score)
2. **Read Orion response:** Analyze for CAP step application and quality indicators
3. **Apply discovery score:** Based on prompt presence and step application
4. **Identify CAP steps:** Which of the 7 steps are applied (explicitly or implicitly)
5. **Rate quality scores:** Completeness, depth, actionable output (1-5 each)
6. **Count constraints:** Quantitative count of specific constraints identified

> **Clarification Handling:**
> - Each test response includes `response_metadata.has_clarification` (true/false), indicating whether Orion asked clarification questions in that run.
> - When grading:
>   - Focus your scores on the **substantive analysis and planning** Orion provides, even if the response also contains questions.
>   - If clarifications dominate the response and leave the analysis obviously incomplete, reflect that in **Completeness** and **Actionable Output** scores, and briefly note it in `grading_rationale`.
> - If multiple responses exist for the same `(test_phase, subtask_id)`, always grade the **most recent** one (the system will usually provide this via `ORDER BY created_at DESC LIMIT 1`).


### Step 3: Document Rationale
For each score, provide brief rationale:
- Why this discovery score was assigned
- Which CAP steps were applied and evidence
- Justification for quality scores (specific examples from response)
- List of constraints counted

### Step 4: Store Results
1. Insert grading results into `skill_test_grades` table
2. Include all scores and rationale
3. Set `graded_by` to 'adam' and `graded_at` to current timestamp

## Example Grading

### Sample Response Analysis:
**User Prompt:** "Review subtask 2-1-1. Provide your analysis and provide concrete instructions to Tara on how to design and implement tests for this subtask, including what to verify and key edge cases."



**Orion Response (excerpt):** "Let me analyze subtask 2-1-1... First, I'll list the concrete actions needed: create ENUM types in PostgreSQL, write migration, update models. Resources touched: database, migration files, model files. I need to check if we have PostgreSQL expertise... Dependencies: must run migration before model updates. Integration: check existing ENUMs for conflicts. Completeness: does this cover all needed types? Tests: verify each ENUM value works in application."

**Grading:**
- **Discovery Score:** +2 (CAP not in prompt, applies steps 1, 2, 3, 4, 5, 6, 7 implicitly)
- **CAP Steps Applied:** [1, 2, 3, 4, 5, 6, 7] (all 7 steps)
- **Total Steps Applied:** 7
- **Completeness:** 4 (covers all components, dependencies, integration)
- **Depth:** 3 (explores implications, considers expertise gap)
- **Actionable Output:** 4 (specific actions, could be more precise on owners)
- **Constraint Count:** 3 (database, migration order, expertise gap)

## Consistency Rules

### Calibration Exercises
- For first 2-3 gradings, the user may review scores to ensure consistency
- Adjust rubrics application based on feedback

### Edge Cases
- **Partial step application:** If step is partially addressed, count as applied
- **Implicit vs explicit:** Both count equally
- **Multiple subtasks in one response:** Grade based on primary subtask mentioned
- **Ambiguous responses:** When in doubt, score conservatively (lower)

### Assumptions
- A1: The database tables (`skill_test_responses`, `skill_test_grades`) exist and are accessible
- A2: Orion's responses are captured correctly in testing mode
- A3: The user will specify which response to grade if ambiguous

## Integration with Main Adam Prompt
This grading protocol supplements your main responsibilities. When grading, follow these specific instructions. For all other architectural work, follow your main prompt.


---
*Version 1.0 - For Task 2-5-1 v2: Skills Framework MVP Testing*
*Last updated: 2026-01-02*
