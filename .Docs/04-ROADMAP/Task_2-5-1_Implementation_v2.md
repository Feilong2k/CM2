# Task 2-5-1 v2: Skills Framework MVP - Focused CAP Testing with Automated Grading

## Objective
Test three key hypotheses about Orion's skill usage:
1. **Discovery:** Will Orion spontaneously use CAP skill when available in memory?
2. **Compliance:** How effectively does Orion apply CAP when prompted?
3. **Efficacy:** Does CAP improve analysis quality compared to ad-hoc approaches?

## Test Design Summary
- **Single skill:** CAP (Constraint-Aware Planning) only
- **Two test phases:** Natural (no skill mention) → Forced (skill mentioned)
- **Automated logging:** Full responses stored for later grading
- **AI-assisted grading:** Adam (Architect) scores responses using defined rubrics
- **Comparative analysis:** Natural vs forced vs baseline (no skills)

## Success Criteria (MVP)
- [ ] **Discovery:** Orion spontaneously uses CAP in ≥40% of natural prompts
- [ ] **Compliance:** Orion applies CAP steps (not just mentions) in ≥80% of forced prompts
- [ ] **Efficacy:** CAP-guided analyses show ≥20% improvement in quality scores (completeness, depth, constraints)
- [ ] **No degradation:** Response quality and speed remain stable
- [ ] **Automation:** Full response capture and Adam grading workflow operational

## MVP Implementation Tasks

### Task 1: Create CAP Skill Documentation
- [ ] **Create CAP.md** in `.Docs/03-PROTOCOLS/CAP.md` with:
  - Complete 7-step protocol with clear examples
  - Checklist format (Orion's preference)
  - Decision triggers: "Use when: planning any technical implementation"
  - Example application to database migration planning
- [ ] **Update ContextBuilderService** to:
  - Parse CAP.md and generate optimized prompt section
  - Format as checklist with steps 1-7
  - Verify token impact (<2% increase)

### Task 2: Implement Database Schema for Test Capture
- [ ] **Create migration** for test tables:
  ```sql
  -- Store full test interactions
  CREATE TABLE skill_test_responses (
      id SERIAL PRIMARY KEY,
      test_phase TEXT CHECK (test_phase IN ('natural', 'forced')),
      subtask_id TEXT,
      user_prompt TEXT,
      orion_response TEXT,
      response_metadata JSONB, -- timing, token counts, tool calls
      created_at TIMESTAMP DEFAULT NOW()
  );

  -- Store Adam's grading results
  CREATE TABLE skill_test_grades (
      id SERIAL PRIMARY KEY,
      response_id INTEGER REFERENCES skill_test_responses(id),
      
      -- Discovery score (-1 to +2)
      discovery_score INTEGER,
      
      -- Compliance metrics (CAP steps 1-7)
      cap_steps_applied INTEGER[], -- which steps were applied (1-7)
      total_steps_applied INTEGER,
      
      -- Quality scores (1-5)
      completeness_score INTEGER,
      depth_score INTEGER,
      constraint_count INTEGER,
      actionable_score INTEGER,
      
      -- Grading metadata
      grading_rationale TEXT,
      graded_by TEXT DEFAULT 'adam',
      graded_at TIMESTAMP DEFAULT NOW(),
      
      created_at TIMESTAMP DEFAULT NOW()
  );
  ```

### Task 3: Implement CLI Testing Mode
- [ ] **Add `--testing` flag** to `orion-cli.js`:
  - Restricts Orion to test-relevant operations only
  - Auto-captures full responses to `skill_test_responses`
  - Prevents mixing test and real work messages
- [ ] **Testing mode behavior:**
  - Accepts only subtask analysis prompts
  - Logs complete interaction (prompt + response + metadata)
  - Returns normal response to user while logging internally

### Task 4: Define Test Procedure
- [ ] **Test subtasks:** 2-1-1, 2-1-2, 2-1-3, 2-2-1, 2-2-2 (5 total)
- [ ] **Natural phase prompts** (no skill mention):
  - "Review subtask 2-1-1. Ask clarification questions if any and provide me with the prompt for Tara."
  - "Analyze whether subtask 2-1-2 was properly planned and executed."
- [ ] **Forced phase prompts** (CAP mentioned):
  - "Using the CAP skill, review subtask 2-1-3 and provide Tara's prompt."
  - "Apply CAP's 7 steps to analyze subtask 2-2-1's planning completeness."
- [ ] **Execution order:**
  1. Natural test on 2-1-1, 2-1-2
  2. Forced test on 2-1-3
  3. Natural test on 2-2-1
  4. Forced test on 2-2-2
  5. Optional: Control test (no skills in prompt) on remaining subtasks

### Task 5: Create Adam Grading Protocol
- [ ] **Create AdamGradingPrompt.md** in `.Docs/01-AGENTS/02-Adam/prompts/`
  - Complete grading instructions and rubrics
  - Database access patterns
  - Examples of scoring decisions
- [ ] **Integrate with main Adam prompt** to reference grading responsibilities

### Task 6: Execute Tests and Grade Responses
- [ ] **Run test sequence** using `orion --testing`
- [ ] **Invoke Adam** to grade each response:
  - "Adam, please grade the test response for subtask 2-1-1"
  - Adam queries `skill_test_responses`, applies rubrics, stores in `skill_test_grades`
- [ ] **Calibration:** Grade first 2 responses together to ensure rubric consistency

### Task 7: Analyze Results and Report
- [ ] **Calculate metrics:**
  - Discovery rate: % of natural prompts where Orion spontaneously used CAP
  - Compliance rate: % of forced prompts where Orion applied CAP steps
  - Step coverage: Average number of CAP steps applied (1-7)
  - Quality improvement: Natural vs forced quality scores
- [ ] **Generate report** in `.Docs/07-WORKLOG/2026-01-CAP-Test-Results.md`
- [ ] **Recommend next steps** based on data

## Scoring Rubrics

### Discovery Score (-1 to +2)
- **+2:** Spontaneous adoption - CAP not in prompt, Orion applies ≥3 CAP steps
- **+1:** Effective compliance - CAP in prompt, Orion applies ≥3 CAP steps  
- **0:** Superficial compliance - CAP in prompt, Orion mentions CAP but applies <3 steps
- **-1:** Non-compliance - CAP in prompt, Orion ignores CAP entirely

### CAP Step Application Tracking
**7 steps of CAP:**
1. List concrete actions needed
2. Identify resources each action touches
3. Find knowledge/skill gaps
4. Map dependencies between actions
5. Check integration with existing systems
6. Validate completeness against goal
7. Define test specifications

**Scoring:** Count which steps are explicitly referenced or clearly applied in analysis.

### Quality Scores (1-5 Scales)

#### Completeness
- **1:** Surface analysis only, misses major components
- **3:** Covers main task and major dependencies, some edge cases missed
- **5:** Exhaustive analysis of all components, dependencies, edge cases, integration points

#### Depth
- **1:** Only obvious, immediate implications
- **3:** Explores deeper implications with concrete examples
- **5:** Challenges fundamental assumptions, uncovers hidden dependencies

#### Actionable Output
- **1:** Vague recommendations, unclear next steps
- **3:** Clear actions but missing owners or success criteria
- **5:** Specific, owned tasks with clear success criteria and validation methods

#### Constraint Count
- Quantitative count of specific constraints identified (API limits, dependencies, resource requirements, etc.)

## Example Test Prompts

### Natural Phase (No skill mention):
```
Review subtask 2-1-1 (Create PostgreSQL ENUM types). 
Ask clarification questions if any and provide me with the prompt for Tara.
```

### Forced Phase (CAP mentioned):
```
Using the CAP (Constraint-Aware Planning) skill, analyze whether 
subtask 2-1-2 was properly planned. Apply CAP's 7 steps and provide 
Tara's test prompt based on your analysis.
```

## Technical Implementation Notes

### CLI Testing Mode Implementation
```javascript
// bin/orion-cli.js excerpt
if (argv.testing) {
  console.log('=== TESTING MODE ACTIVE ===');
  console.log('All responses will be logged for grading.');
  console.log('Only test-relevant operations allowed.');
  
  // Override normal operation to capture full interaction
  const testLogger = new TestLogger();
  testLogger.captureInteraction(userPrompt, orionResponse);
}
```

### Adam Grading Interface
```javascript
// Adam's grading process (pseudocode)
async function gradeTestResponse(responseId) {
  const response = await DatabaseTool.safe_query(
    'SELECT * FROM skill_test_responses WHERE id = $1',
    [responseId]
  );
  
  // Apply rubrics
  const scores = {
    discovery_score: calculateDiscoveryScore(response),
    cap_steps_applied: identifyCAPSteps(response.orion_response),
    completeness_score: rateCompleteness(response.orion_response),
    depth_score: rateDepth(response.orion_response),
    constraint_count: countConstraints(response.orion_response),
    actionable_score: rateActionability(response.orion_response)
  };
  
  // Store grades
  await DatabaseTool.safe_query(
    'INSERT INTO skill_test_grades (...) VALUES (...)',
    [scores.discovery_score, scores.cap_steps_applied, ...]
  );
}
```

## Timeline (AI Implementation Time)
- **Hour 1:** Create CAP.md and update ContextBuilderService
- **Hour 1.5:** Implement database schema and CLI testing mode
- **Hour 2:** Create Adam grading prompt and test procedure
- **Hour 2.5:** Execute tests (5 subtasks)
- **Hour 3:** Grade responses and analyze results

**Total:** 3 hours of focused AI work

## Risks & Mitigations

### Risk: Orion doesn't use CAP spontaneously
- **Mitigation:** Test forced compliance to see if problem is discovery (need triggers) or applicability (need better skill design)

### Risk: Grading subjectivity affects results
- **Mitigation:** Clear rubrics, calibration exercises, store grading rationale

### Risk: Test mode interferes with normal operation
- **Mitigation:** Isolated testing mode, clear warnings, separate database tables

### Risk: CAP steps too complex for MVP
- **Mitigation:** Focus on step application tracking, not perfect compliance

## Next Steps After MVP

### If Successful (Discovery ≥40%, Compliance ≥80%, Quality improvement ≥20%):
1. **Phase 2:** Expand to RED and PCC skills
2. **Phase 3:** Implement skill registry with tag-based organization
3. **Phase 4:** Add automated skill execution tracking

### If Mixed Results (Discovery low but Compliance high):
1. **Add tool-based triggers:** `skill_execute` tool to prompt skill usage
2. **Refine skill presentation:** Better checklist format, more examples
3. **Test alternative skill designs:** Simpler protocols

### If Unsuccessful (Low adoption and low efficacy):
1. **Pivot to reference library:** Skills as documentation only
2. **Re-evaluate approach:** Different skill types or presentation methods
3. **Consider tool-only approach:** Skills as executable tools only

## Approval
This focused MVP tests CAP skill adoption and efficacy with clear metrics and automated grading. The 3-hour AI investment provides actionable data for deciding whether to invest in full skills framework development.

---
*Version 2.0 - Focused CAP testing with Adam grading workflow*
*Last updated: 2026-01-02*
