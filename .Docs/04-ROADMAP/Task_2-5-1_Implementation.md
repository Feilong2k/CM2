# Task 2-5-1: Skills Framework MVP - Automated Memory-Based Integration

## Objective
Test the fundamental assumption: Will Orion use protocol-based skills when they are available in memory, even after context decay (20+ messages)? Implement automated testing with database logging across multiple subtasks to measure skill adoption and effectiveness.

## Success Criteria (MVP)
- [ ] Orion references at least 2 skills without explicit prompting in 60% of subtask analyses
- [ ] Skill usage improves analysis quality (measured by completeness, depth, constraint identification)
- [ ] No significant degradation in Orion's response time or quality
- [ ] Skills section adds minimal tokens to prompt (<2% increase)
- [ ] Automated logging of test results for multiple subtasks (2-1-1 through 2-1-N, 2-2-1 through 2-2-M)
- [ ] Quantitative metrics demonstrate skill utility beyond context freshness

## MVP Implementation Tasks

### Task 1: Create Comprehensive Skill Documentation
- [ ] **Create Skills.md** in `.Docs/03-PROTOCOLS/Skills.md` with:
  - CAP (Constraint-Aware Planning): Full 7-step protocol with examples
  - RED (Recursive Execution Decomposition): 5-layer decomposition with examples  
  - PCC Level 1, 2, 3 (Preflight Constraint Check): Hierarchical sub-skills
  - **Checklist format** (Orion's preference) with numbered steps
  - **Decision triggers**: "Use when: planning any technical implementation"
  - **Tags**: planning, verification, decomposition, constraint_check
  - **Sub-skill relationships**: PCC lvl1 → PCC lvl2 → PCC lvl3
  - **Examples**: Real-world application scenarios

### Task 2: Implement Database Schema for Automated Logging
- [ ] **Create migration** for skills tables:
  - `skills` table (if not exists) - stores skill definitions
  - `skill_test_results` table - stores automated test metrics
- [ ] **Schema design:**
  ```sql
  CREATE TABLE skill_test_results (
    id SERIAL PRIMARY KEY,
    test_run_id TEXT,
    subtask_id TEXT,
    condition TEXT, -- 'with_skills' or 'without_skills'
    skill_used TEXT,
    usage_count INTEGER,
    completeness_score INTEGER, -- 1-5 scale
    constraint_identification_count INTEGER,
    analysis_depth_score INTEGER, -- 1-5 scale
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] **Use existing DatabaseTool** for logging (no new tool needed)

### Task 3: Update ContextBuilderService
- [ ] **Parse Skills.md** and generate optimized prompt section
- [ ] **Format skills as checklists** with decision triggers (Orion's preferred format)
- [ ] **Placement**: After agent role, before other context sections
- [ ] **Verify token impact** (<2% increase, measure with token counter)
- [ ] **Maintain backward compatibility** with existing prompt structure

### Task 4: Create Automated Test Harness
- [ ] **Script to run Orion on multiple subtasks**:
  - Test subtasks 2-1-1 through 2-1-5 and 2-2-1 through 2-2-5
  - Alternate conditions: WITH skills vs WITHOUT skills (control group)
  - Simulate context decay: Run tests separated by 20+ other messages
- [ ] **Automate logging** using DatabaseTool:
  - Log skill usage events
  - Record quantitative metrics (scores, counts, timing)
  - Store results in skill_test_results table
- [ ] **Metrics collection**:
  - Skill reference count per analysis
  - Completeness score (1-5): How thoroughly was the subtask analyzed?
  - Depth score (1-5): How deep was the analysis (surface vs fundamental)?
  - Constraint identification count: How many constraints were identified?
  - Execution time: Response generation time

### Task 5: Conduct Multi-Subtask Test with Context Decay
- [ ] **Run automated test sequence**:
  1. Test 2-1-1 WITH skills (fresh context)
  2. Run 20+ unrelated messages (simulate typical work session)
  3. Test 2-1-2 WITHOUT skills (control, decayed context)
  4. Test 2-1-3 WITH skills (decayed context)
  5. Continue alternating for remaining subtasks
- [ ] **Ensure proper isolation**: Clear context between tests where needed
- [ ] **Monitor for interference**: Track if skills degrade other reasoning

### Task 6: Analyze Results and Document Findings
- [ ] **Generate comparative reports** from database:
  - Skill adoption rate (with vs without skills, fresh vs decayed context)
  - Quality improvement metrics (completeness, depth, constraints)
  - Context decay impact on skill usage
- [ ] **Calculate success metrics**:
  - Primary: Skill usage in 60%+ of applicable analyses
  - Secondary: 20%+ improvement in analysis quality scores
  - Tertiary: No performance degradation
- [ ] **Document findings** in `.Docs/07-WORKLOG/2026-01-Skills-MVP-Results.md`
- [ ] **Recommend next steps** based on data:
  - If successful → Phase 2: DB skill registry & advanced tracking
  - If mixed results → Adjust skill presentation or add tool-based reminders
  - If unsuccessful → Pivot to tool-based approach or reconsider skill design

## Skill Documentation Format (Skills.md)

### CAP (Constraint-Aware Planning)
**[Use when:** Planning any technical implementation**]**

**7-step checklist:**
1. List all concrete actions needed
2. Identify resources each action touches  
3. Find knowledge/skill gaps
4. Map dependencies between actions
5. Check integration with existing systems
6. Validate completeness against goal
7. Define test specifications

**Example:** Analyzing database migration plan → check dependencies, integration points, test coverage.

### RED (Recursive Execution Decomposition)
**[Use when:** Analyzing complex or unfamiliar systems**]**

**5-layer decomposition:**
1. System level: Overall goal and context
2. Operation level: Major operations required
3. Mechanism level: Specific mechanisms for each operation
4. Atomic operation level: Individual actions
5. Fundamental level: Primitives and assumptions

**Example:** Understanding API integration → from system goal (data sync) to atomic ops (HTTP calls, error handling).

### PCC Level 1-3 (Preflight Constraint Check)
**[Use when:** Before starting any implementation**]**

**Hierarchical levels:**
- **Level 1 (Atomic):** Individual action constraints
- **Level 2 (Resource):** Resource availability and conflicts  
- **Level 3 (System):** System-wide constraints and integration points

**Example:** Checking new feature → Level 1: API constraints, Level 2: database capacity, Level 3: system architecture.

## Technical Implementation Notes

### File-First, DB-Ready Architecture
```javascript
// Skills.md → ContextBuilderService → Orion Prompt
// Test Results → Database (automated logging)
// Future: Skills.md → DB migration for Phase 2

// ContextBuilderService skill parsing
function parseSkillsMarkdown(markdownContent) {
  // Extract skill definitions, checklists, triggers
  // Format for Orion's preferred checklist presentation
}

// Test harness using existing DatabaseTool
async function logSkillTestResult(testData) {
  await DatabaseTool.safe_query(
    `INSERT INTO skill_test_results (...) VALUES (...)`,
    [testData.subtask_id, testData.condition, ...]
  );
}
```

### Leveraging Existing Work
1. **Orion's SkillTool.js** - Reference for skill execution patterns (Phase 2)
2. **DatabaseTool** - Already has safe_query for logging
3. **Existing trace system** - Can be extended for skill events (Phase 2)
4. **ContextBuilderService** - Already handles prompt assembly

### No New Tools Needed for MVP
- Use `DatabaseTool.safe_query` for logging
- Use `FileSystemTool.read_file` for Skills.md parsing
- Use existing orchestration for test execution

## Timeline (AI Implementation Time)
- **Hour 1:** Create Skills.md and database schema (migration)
- **Hour 2:** Update ContextBuilderService and create test harness
- **Hour 2.5:** Run initial tests, analyze results, iterate if needed
- **Hour 3:** Complete full test sequence and generate final report

**Total:** 2.5-3 hours of focused AI work

## Risks & Mitigations

### Risk: Database dependency adds complexity
- **Mitigation:** Use simple schema, existing DatabaseTool, minimal queries

### Risk: Test harness may have bugs
- **Mitigation:** Start with 2-3 subtasks, validate logging, then scale

### Risk: Context decay simulation may not match real usage
- **Mitigation:** Use real message history patterns, document limitations

### Risk: Skills interfere with other reasoning
- **Mitigation:** Monitor analysis quality, include "skip skill" capability

### Risk: Quantitative metrics are subjective
- **Mitigation:** Use clear scoring rubrics (1-5 scales with criteria), document scoring method

## Next Steps After MVP

### If Successful (Skills used, improve outcomes):
1. **Phase 2:** Implement DB skill registry with tag-based organization
2. **Phase 3:** Add skill execution tracking and performance metrics  
3. **Phase 4:** Implement dynamic skill selection and fallback
4. **Phase 5:** Skill marketplace and community sharing

### If Mixed Results (Skills used but not consistently):
1. **Adjust presentation:** Refine checklist format, decision triggers
2. **Add tool-based reminders:** Skill execution prompts at key decision points
3. **Test alternative strategies:** Different skill combinations, ordering

### If Unsuccessful (Skills ignored or degrade performance):
1. **Pivot to tool-based approach:** `skill_execute` tool instead of memory-based
2. **Re-evaluate skill design:** Simpler protocols, better examples
3. **Consider alternative:** Skill library for reference only, not active use

## Approval
This automated MVP plan tests the fundamental question "Will Orion use skills?" with realistic context decay simulation and quantitative metrics. The 2.5-3 hour AI investment enables testing across 10+ subtasks with automated logging, providing high-confidence data for go/no-go decisions on skill framework investment.
