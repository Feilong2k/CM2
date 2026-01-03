# Task 2-5-1 v3: Skills Framework MVP - Three-Test Probe-Based CAP Validation

## Objective
Test three key hypotheses about Orion's skill usage with clear experimental separation:
1. **Baseline:** Establish analysis quality without any skill influence
2. **Discovery:** Will Orion spontaneously use CAP skill when available in memory?
3. **Efficacy/Compliance:** How effectively does Orion apply CAP when prompted, and does it improve analysis quality?

## Test Design Summary
- **Single skill:** CAP (Constraint-Aware Planning) only
- **Three test phases:** 
  1. Baseline (no skills in memory)
  2. Discovery (skills in memory, natural prompts)
  3. Compliance/Efficacy (skills in memory, forced prompts)
- **Automated probe:** Standalone script runs all tests sequentially
- **Isolated environment:** Fresh Orion instance per test, no contamination of real work
- **AI-assisted grading:** Adam (Architect) scores all responses using consistent rubrics
- **Statistical comparison:** Baseline vs Discovery vs Compliance for robust analysis

## Success Criteria (MVP)
- [ ] **Discovery:** ≥40% spontaneous CAP usage in Discovery phase (vs 0% in Baseline)
- [ ] **Compliance:** ≥80% effective CAP step application in Compliance phase
- [ ] **Efficacy:** ≥20% quality improvement in Compliance vs Baseline (completeness, depth, constraints)
- [ ] **Automation:** Probe successfully runs 30 test cases (10 subtasks × 3 phases) with automated logging
- [ ] **Consistency:** Adam grading shows consistent rubric application across all responses

## MVP Implementation Tasks

### Task 1: Define Skill Structure and Create Three Skills
- [x] **Create skill directory structure** in `backend/Skills/`:
  - Each skill in its own folder: `CAP/`, `RED/`, `PCC1/`
  - Each skill folder contains `SKILL.md` with YAML frontmatter (metadata) and markdown body
  - YAML frontmatter includes: name, description, version, type, decision_triggers, dependencies, last_updated
  - Progressive disclosure: YAML frontmatter loads initially, detailed instructions in markdown body
  - Optional supporting files: `FORMS.md`, `reference.md`, `examples.md`
  - Optional `scripts/` folder for executable scripts (Python, etc.)
- [x] **Create CAP skill** in `backend/Skills/CAP/`:
  - `SKILL.md`: Complete 7-step CAP protocol with YAML frontmatter, examples, checklist format
  - Updated Step 3 to use PCC1 mapping for data flow analysis
  - Supporting files as needed
- [x] **Create RED skill** in `backend/Skills/RED/`:
  - `SKILL.md`: Requirement Extraction and Decomposition skill with YAML frontmatter
  - 5-step protocol with decomposition techniques
  - Supporting files as needed
- [x] **Create PCC1 skill** in `backend/Skills/PCC1/`:
  - `SKILL.md`: Protocol Compliance Checking subskill with YAML frontmatter
  - 6-step protocol for compliance checking
  - Supporting files as needed

### Task 2: Update ContextBuilderService for Skill Management
- [ ] **Update ContextBuilderService** to:
  - Scan `backend/Skills/` directory for skill folders
  - For each skill, read `SKILL.md` and generate optimized prompt sections
  - Format each skill as checklist with steps
  - Verify token impact (<5% increase for all three skills)
  - **Conditional inclusion:** Ability to include/exclude specific skills based on test phase (include only CAP for MVP testing)

### Task 3: Implement Database Schema for Three-Test Capture
- [x] **Create migration** for test tables:
  ```sql
  -- Store full test interactions
  CREATE TABLE skill_test_responses (
      id SERIAL PRIMARY KEY,
      test_phase TEXT CHECK (test_phase IN ('baseline', 'discovery', 'compliance')),
      subtask_id TEXT,
      user_prompt TEXT,
      orion_response TEXT,
      response_metadata JSONB, -- timing, token counts, tool calls, clarification flags
      created_at TIMESTAMP DEFAULT NOW()
  );

  -- Store Adam's grading results
  CREATE TABLE skill_test_grades (
      id SERIAL PRIMARY KEY,
      response_id INTEGER REFERENCES skill_test_responses(id),
      
      -- Discovery score (-1 to +2) - only relevant for discovery/compliance phases
      discovery_score INTEGER,
      
      -- Compliance metrics (CAP steps 1-7) - only for compliance phase
      cap_steps_applied INTEGER[], -- which steps were applied (1-7)
      total_steps_applied INTEGER,
      
      -- Quality scores (1-5) - for all phases
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

### Task 4: Build Automated Test Probe
- [x] **Create probe_skill_test.js** in `backend/scripts/probes/`:
  - Initializes fresh Orion instance per test phase
  - Runs through 10 subtasks (2-1-2 through 2-1-6, 2-2-1 through 2-2-5)
  - Executes three phases sequentially:
    1. Baseline: No CAP skills in memory
    2. Discovery: CAP skills in memory, natural prompts
    3. Compliance: CAP skills in memory, forced prompts
  - **Error handling:** Skips subtasks where Orion asks clarification questions, logs reason
  - **Database logging:** Uses DatabaseTool to store responses in skill_test_responses
- [x] **Probe design features:**
  - Configurable subtask list
  - Retry logic for transient failures
  - Progress reporting and summary statistics
  - Isolation: Each test runs in clean context

### Task 5: Define Three-Phase Test Procedure
- [ ] **Test subtasks:** 2-1-1, 2-1-2, 2-1-3, 2-1-4, 2-1-5, 2-1-6, 2-2-1, 2-2-2, 2-2-3, 2-2-4, 2-2-5, 2-2-6(12 total)
- [ ] **Baseline phase prompts** (no skills in memory):
  - `Review subtask {id}. Provide your analysis and provide concrete instructions to Tara on how to design and implement the tests, including what to verify and key edge cases, without asking clarification questions unless absolutely necessary.`
- [ ] **Discovery phase prompts** (skills in memory, natural):
  - `Review subtask {id}. Provide your analysis and provide concrete instructions to Tara on how to design and implement the tests, including what to verify and key edge cases, without asking clarification questions unless absolutely necessary.`
  - *Same prompt as baseline, but CAP skills available in Orion's context*
- [ ] **Compliance phase prompts** (skills in memory, forced):
  - `Using the CAP (Constraint-Aware Planning) skill, review subtask {id}. Apply CAP's 7 steps to structure your analysis and then provide concrete instructions to Tara on how to design and implement the tests, including what to verify and key edge cases, without asking clarification questions unless absolutely necessary.`
- [ ] **Execution order:**
  1. Baseline: All 12 subtasks
  2. Discovery: All 12 subtasks  
  3. Compliance: All 12 subtasks
  - *Total: 36 test runs*

### Task 6: Create Adam Grading Protocol (Updated for Three Tests)
- [ ] **Update AdamGradingPrompt.md** to include:
  - Phase-specific scoring rules (discovery score only for discovery/compliance)
  - Examples for each test phase
  - Statistical comparison guidance
- [ ] **Integrate with main Adam prompt** to reference three-test grading responsibilities

### Task 7: Execute Probe and Grade Responses
- [ ] **Run probe:** Execute 

set NODE_ENV=test
node backend/scripts/probes/tdd/three_phase_cap_probe.js

- [ ] **Monitor execution:** Ensure all 30 tests complete (some may be skipped)
- [ ] **Invoke Adam** to grade all responses:
  - "Adam, please grade all test responses for the skills framework MVP"
  - Adam queries `skill_test_responses` by phase, applies appropriate rubrics
  - Stores results in `skill_test_grades` with phase identification
- [ ] **Calibration:** Grade first 2-3 responses of each phase together to ensure consistency

### Task 8: Analyze Results and Generate Final Report
- [ ] **Calculate phase metrics:**
  - **Baseline:** Average quality scores (completeness, depth, constraints, actionable)
  - **Discovery:** Spontaneous CAP usage rate, quality scores
  - **Compliance:** CAP step application rate, quality scores, improvement over baseline
- [ ] **Statistical analysis:**
  - Discovery rate = (Discovery phase CAP usage) / (total discovery tests)
  - Compliance rate = (Compliance phase effective step application) / (total compliance tests)
  - Efficacy improvement = (Compliance quality scores) - (Baseline quality scores)
- [ ] **Generate comprehensive report** in `.Docs/07-WORKLOG/2026-01-CAP-Test-Results.md`:
  - Raw data tables
  - Statistical summaries
  - Visualization recommendations (charts, graphs)
  - Clear go/no-go recommendations with confidence levels
- [ ] **Recommend next steps** based on data

## Scoring Rubrics

### Discovery Score (-1 to +2) - Applies to Discovery and Compliance Phases
- **+2:** Spontaneous adoption - CAP not in prompt (Discovery phase only), Orion applies ≥3 CAP steps
- **+1:** Effective compliance - CAP in prompt (Compliance phase), Orion applies ≥3 CAP steps  
- **0:** Superficial compliance - CAP in prompt (Compliance phase), Orion mentions CAP but applies <3 steps
- **-1:** Non-compliance - CAP in prompt (Compliance phase), Orion ignores CAP entirely
- **N/A:** Baseline phase (no discovery score)

### CAP Step Application Tracking - Compliance Phase Only
**7 steps of CAP:**
1. List concrete actions needed
2. Identify resources each action touches
3. Find knowledge/skill gaps
4. Map dependencies between actions
5. Check integration with existing systems
6. Validate completeness against goal
7. Define test specifications

**Scoring:** Count which steps are explicitly referenced or clearly applied in analysis.

### Quality Scores (1-5 Scales) - All Phases

#### Completeness
- **1 (Poor):** Surface analysis only, misses major components, ignores dependencies
- **3 (Adequate):** Covers main task and major dependencies, some edge cases missed
- **5 (Excellent):** Exhaustive analysis of all components, dependencies, edge cases, failure modes, validation criteria

#### Depth
- **1 (Surface):** Only obvious, immediate implications; paraphrases task description
- **3 (Moderate):** Explores deeper implications with concrete examples
- **5 (Profound):** Challenges fundamental assumptions, uncovers hidden dependencies, considers second-order effects

#### Actionable Output
- **1 (Vague):** General recommendations without specifics (e.g., "implement this")
- **3 (Clear):** Clear actions but missing some owners or success criteria
- **5 (Operational):** Specific, owned tasks with clear success criteria, validation methods, contingency plans

#### Constraint Count
- Quantitative count of specific constraints identified (API limits, dependencies, resource requirements, etc.)
- Count each distinct constraint mentioned

## Example Test Prompts

### Baseline Phase (No skills in memory):
```
Review subtask 2-1-2. Provide analysis and Tara prompt without asking clarification questions.
```

### Discovery Phase (Skills in memory, natural prompt):
```
Review subtask 2-1-2. Provide analysis and Tara prompt without asking clarification questions.
```

### Compliance Phase (Skills in memory, forced prompt):
```
Using the CAP (Constraint-Aware Planning) skill, analyze subtask 2-1-2. 
Apply CAP's 7 steps and provide Tara prompt without asking clarification questions.
```

## Technical Implementation Notes

### Probe Implementation
```javascript
// probe_skill_test.js excerpt
async function runThreePhaseTest() {
  const subtasks = ['2-1-2', '2-1-3', '2-1-4', '2-1-5', '2-1-6', 
                    '2-2-1', '2-2-2', '2-2-3', '2-2-4', '2-2-5'];
  
  const phases = [
    { name: 'baseline', includeSkills: false, promptTemplate: 'Review subtask {id}...' },
    { name: 'discovery', includeSkills: true, promptTemplate: 'Review subtask {id}...' },
    { name: 'compliance', includeSkills: true, promptTemplate: 'Using CAP skill, analyze subtask {id}...' }
  ];
  
  for (const phase of phases) {
    console.log(`\n=== Starting ${phase.name.toUpperCase()} phase ===`);
    
    for (const subtask of subtasks) {
      try {
        const prompt = phase.promptTemplate.replace('{id}', subtask);
        const orion = createOrionInstance(phase.includeSkills);
        const response = await orion.process(prompt);
        
        // Check for clarification questions
        if (response.includes('clarification') || response.includes('question')) {
          console.log(`Skipping ${subtask} - Orion asked questions`);
          continue;
        }
        
        await logTestResponse(subtask, phase.name, prompt, response);
      } catch (error) {
        console.log(`Error on ${subtask}: ${error.message}`);
      }
    }
  }
}
```

### ContextBuilderService Modification
```javascript
// Conditional CAP skill inclusion
function buildSystemPrompt(includeCAPSkills = true) {
  const basePrompt = loadBaseTemplate();
  
  if (includeCAPSkills) {
    const capSection = generateCAPSection(); // From CAP.md
    return insertSectionAtPosition(basePrompt, capSection, 'AGENT_ROLE_SECTION');
  }
  
  return basePrompt;
}
```

## Timeline (AI Implementation Time)
- **Hour 1:** Create CAP.md and update ContextBuilderService with conditional inclusion
- **Hour 1.5:** Implement database schema for three-test capture
- **Hour 2:** Build probe_skill_test.js with three-phase execution
- **Hour 2.5:** Update Adam grading protocol for three-test analysis
- **Hour 3:** Execute probe (30 tests), grade responses, analyze results
- **Hour 3.5:** Generate final report and recommendations

**Total:** 3.5 hours of focused AI work (30% more than v2 for 50% more tests)

## Risks & Mitigations

### Risk: Orion asks clarification questions, reducing dataset size
- **Mitigation:** Skip and log, consider pre-populating subtask details in future iterations

### Risk: Three tests increase complexity
- **Mitigation:** Clear phase separation in code and database, consistent naming

### Risk: Statistical significance with only 10 subtasks
- **Mitigation:** Focus on effect size (20% improvement threshold), document limitations

### Risk: Probe crashes mid-execution
- **Mitigation:** Implement checkpointing, resume capability, or at least partial results saving

### Risk: Learning effects across phases
- **Mitigation:** Fresh Orion instance per test, different contexts prevent memory carryover

## Next Steps After MVP

### If Successful (All criteria met):
1. **Phase 2:** Expand to RED and PCC skills with same three-test framework
2. **Phase 3:** Implement skill registry with tag-based organization
3. **Phase 4:** Add automated skill execution tracking and performance metrics

### If Mixed Results (Discovery low but Compliance high):
1. **Add tool-based triggers:** `skill_execute` tool to prompt skill usage at decision points
2. **Refine skill presentation:** Better checklist format, more examples, improved decision triggers
3. **Test alternative skill designs:** Simpler protocols, different framing

### If Unsuccessful (Low adoption and low efficacy):
1. **Pivot to reference library:** Skills as documentation only, not active prompting
2. **Re-evaluate approach:** Different skill types or presentation methods
3. **Consider tool-only approach:** Skills as executable tools with no memory component

## Approval
This three-test MVP provides rigorous validation of CAP skill adoption and efficacy with clear experimental controls. The probe-based automation enables testing 30 scenarios in minutes rather than hours, providing robust data for architectural decision-making about the skills framework.

---
*Version 3.0 - Three-test probe-based validation with baseline comparison*
*Last updated: 2026-01-02*
