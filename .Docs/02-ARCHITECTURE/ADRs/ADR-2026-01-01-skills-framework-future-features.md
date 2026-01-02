# ADR-2026-01-01: Future Skills Framework Features (Post-MVP)

## Status
**Deferred** – Features planned for implementation after MVP validation

## Context
The Skills Framework MVP (Task 2-5-1) is intentionally minimal, focusing on testing the fundamental assumption: "Will Orion use protocol-based skills when they are available in memory?" This MVP includes only:

1. Hardcoded skill descriptions in ContextBuilderService
2. No tool calls or complex infrastructure
3. Manual evaluation only (no automated metrics)
4. Testing with completed subtask 2-1-1

During architectural discussions, several advanced features were identified but intentionally excluded from MVP to maintain focus and avoid over-engineering. This ADR documents those features for future implementation.

## Features Deferred from MVP

### 1. Skill Registry with Tag-Based Organization
- **Description:** Central registry for skill discovery and execution with metadata (name, version, tags, capabilities, priority, execution steps).
- **Excluded from MVP because:** Hardcoded array is sufficient for testing memory-based usage.
- **Future Implementation:**
  - Schema with fields: `skill_id`, `name`, `type`, `description`, `tags[]`, `required_sub_skill_tags[]`, `auto_include`, `priority`, `execution_steps`
  - Tag conventions: category tags (planning, constraint, decomposition), function tags, domain tags, complexity tags
  - Registry methods: `register()`, `get()`, `getByTag()`, `getByTags()`, `findSubSkills()`

### 2. Skill Execution Tracking & Metrics
- **Description:** Automated logging of skill usage, compliance scoring, and performance metrics.
- **Excluded from MVP because:** Manual observation is sufficient for initial validation.
- **Future Implementation:**
  - Extend TraceService to log `skill_execution` events
  - Event schema: skill_name, steps_followed[], timestamp, subtask_id, compliance_score
  - Metrics: compliance rate, plan completeness, time savings, adoption frequency
  - Integration with existing trace event system

### 3. Dynamic Skill Selection & Fallback Mechanisms
- **Description:** Rule-based and eventually ML-based selection of sub-skills based on tags and context, with ability to try alternatives on failure.
- **Excluded from MVP because:** Fixed skill presentation is sufficient for initial testing.
- **Future Implementation:**
  - Parent skills declare required sub-skill tags (e.g., CAP requires `constraint_check`, `gap_analysis`)
  - Sub-skills advertise capabilities via tags (e.g., PCC Level 1 has `constraint_check`)
  - Registry matches sub-skills to parent requirements by tag
  - Fallback: if primary skill fails, try alternative skills with same tags

### 4. Hierarchical Skill Composition
- **Description:** Parent skills that orchestrate sub-skills, enabling complex workflows and skill reuse.
- **Excluded from MVP because:** Initial testing uses flat skill list.
- **Future Implementation:**
  - Skill types: `parent_skill` (orchestrators) and `sub_skill` (specialized components)
  - Parent skills can call sub-skills dynamically based on required tags
  - Workflow composition: skills can be chained or nested
  - State passing between skills via execution context

### 5. Tool-Based Skill Execution
- **Description:** `skill_execute` tool for structured skill execution, providing detailed steps, validation, and traceability.
- **Excluded from MVP because:** Memory-based integration is being tested first.
- **Future Implementation:**
  - Tool interface: `skill_execute(skill_name, inputs)`
  - Returns structured outputs and execution trace
  - Can be called by Orion for complex skill execution
  - Integrates with skill registry for dynamic skill loading

### 6. Skill Marketplace Concept
- **Description:** Sharing skills across Orion instances, community-contributed skills, skill rating and discovery.
- **Excluded from MVP because:** Too advanced for current needs.
- **Future Implementation:**
  - Central skill repository (like npm for skills)
  - Skill versioning and dependency management
  - Performance ratings and user feedback
  - Skill discovery by problem type or domain

### 7. Adaptive Learning & ML Optimization
- **Description:** Skills that improve with usage, ML-based skill selection, predictive skill composition.
- **Excluded from MVP because:** Requires baseline usage data first.
- **Future Implementation:**
  - Skill performance tracking (success rates, execution times)
  - ML models to predict optimal skill combinations
  - Skills that refine their own execution based on feedback
  - Cross-skill knowledge sharing

## Decision
Defer implementation of these advanced features until MVP validation is complete. The MVP will provide critical data on whether Orion uses skills at all, which will inform the design and prioritization of future features.

## Consequences

### Positive
- **MVP can be delivered quickly** (3 days vs. weeks)
- **Reduced risk** – if skills aren't used, we avoid building complex infrastructure
- **Data-driven design** – future features can be informed by actual usage patterns
- **Incremental adoption** – team can learn and adapt as features are added

### Negative
- **Temporary limitations** – advanced capabilities won't be available immediately
- **Potential rework** – if MVP design doesn't support future features, some refactoring may be needed
- **Delayed benefits** – advanced features like dynamic selection and fallback won't be available until later

### Risks
- **Over-engineering later** – tendency to build everything at once when expanding from MVP
- **Skill proliferation** – without governance, too many similar skills may emerge
- **Performance degradation** – complex skill execution could slow Orion's responses

## Future Implementation Plan

### Phase 2: Skill Registry & Basic Tracking (Post-MVP Validation)
1. Implement skill registry with tag-based organization
2. Add skill execution tracking to TraceService
3. Test with 2-3 additional subtasks beyond 2-1-1

### Phase 3: Dynamic Selection & Composition
1. Implement parent skill orchestration of sub-skills
2. Add dynamic skill selection based on tags
3. Implement basic fallback mechanisms
4. Test with diverse subtask types (database, API, UI)

### Phase 4: Tool Integration & Advanced Features
1. Implement `skill_execute` tool for structured execution
2. Add skill performance metrics and dashboards
3. Implement skill versioning and update mechanisms

### Phase 5: Learning & Optimization
1. Collect sufficient usage data for ML training
2. Implement ML-based skill recommendation
3. Add skill adaptation and improvement loops

## Integration with Existing Architecture

All future features will build upon the existing:
- **TraceService** for skill execution logging
- **ContextBuilderService** for skill presentation
- **DatabaseTool** for skill metadata storage (if needed)
- **Existing protocol definitions** in `.Docs/03-PROTOCOLS`

## Success Metrics for Future Phases

### Phase 2 Success Criteria
- [ ] Skill registry successfully loads and organizes 5+ skills
- [ ] Automated skill usage tracking captures 90% of skill references
- [ ] Skill execution events are queryable in trace UI

### Phase 3 Success Criteria
- [ ] Parent skills can dynamically select appropriate sub-skills by tag
- [ ] Fallback mechanisms work for at least 2 skill failure scenarios
- [ ] Skill composition reduces duplicate analysis by 30%

### Phase 4 Success Criteria
- [ ] `skill_execute` tool used for 50% of skill executions
- [ ] Skill performance metrics inform skill improvement decisions
- [ ] Users report skill execution is more reliable and consistent

### Phase 5 Success Criteria
- [ ] ML-based skill selection outperforms rule-based by 20% on success rate
- [ ] Skills adapt and improve over time (measured by compliance scores)
- [ ] Cross-skill knowledge sharing reduces skill creation time by 40%

## Notes
- This ADR should be reviewed when MVP validation is complete (Task 2-5-1)
- Features may be reprioritized based on MVP findings
- Implementation details may evolve based on real-world usage
- Regular reviews will ensure we don't over-engineer future phases

## References
1. `.Docs/04-ROADMAP/Task_2-5-1_Implementation.md` – MVP implementation plan
2. `.Docs/02-ARCHITECTURE/ADRs/ADR-2026-01-01-skills-framework-mvp.md` – Original skills framework ADR
3. `.Docs/00-INBOX/SKILLS_Architecture.md` – Initial architectural analysis
