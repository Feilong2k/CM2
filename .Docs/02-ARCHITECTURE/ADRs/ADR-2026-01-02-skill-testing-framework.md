# ADR-2026-01-02: Skill Testing Framework with Three-Phase Probe

## Status
**Accepted** – Architectural decision for validating skill effectiveness in CM2

## Context
The CM2 project has implemented a skills framework (per ADR-2026-01-01) to enhance Orion's subtask processing capabilities. However, a critical question remained unanswered: **Will Orion actually use the skills we provide, or will it default to ad-hoc approaches?**

Traditional testing approaches (unit tests, integration tests) verify that code works correctly, but they don't measure whether an LLM agent will actually follow the intended workflows. We needed a way to:

1. **Measure baseline behavior** – How does Orion perform tasks without skills?
2. **Test skill discovery** – Does Orion discover and use skills when they're available in context?
3. **Validate compliance** – Does Orion properly apply skills when explicitly instructed to do so?

## Decision
We will implement a **three-phase skill testing framework** that:
1. **Uses real OrionAgent instances** with identical context and prompt structures as the CLI
2. **Employs mock tools** to isolate testing from infrastructure issues (database connectivity, file system access)
3. **Automates systematic testing** across multiple subtasks with controlled conditions
4. **Stores responses in a database** for quantitative analysis and Adam grading

### Three-Phase Test Design
1. **Baseline Phase**: Orion processes subtasks without any skills in context
   - **Purpose**: Establish performance baseline for natural Orion behavior
   - **Metric**: Response quality, clarification questions, tool usage patterns

2. **Discovery Phase**: Orion processes subtasks with skills available in context
   - **Purpose**: Test if Orion discovers and applies skills without explicit instruction
   - **Metric**: Skill usage rate, response improvement over baseline

3. **Compliance Phase**: Orion processes subtasks with explicit skill application instructions
   - **Purpose**: Test if Orion properly executes skills when directed to do so
   - **Metric**: Skill compliance rate, execution completeness

### Key Implementation Details
1. **Context Identity**: The probe uses the exact same `ContextService.buildContext()` method as the CLI, ensuring identical system prompts and message structures.
2. **Mock Tools**: Custom `MockDatabaseTool` and `MockFileSystemTool` handle Orion's object parameter format and provide consistent test data.
3. **Isolation**: Each test runs with fresh context to prevent contamination between subtasks.
4. **Data Collection**: All responses stored in `skill_test_responses` table for post-analysis.

## Consequences

### Positive
- **Validates Skill Usability**: Measures whether skills are actually used, not just whether they exist
- **Quantifiable Metrics**: Provides data on clarification rates, response lengths, skill application success
- **Controlled Experiments**: Enables A/B testing of skill variations and prompt engineering
- **Framework Reusability**: Can test any skill (CAP, RED, PCC, etc.) with the same infrastructure
- **Realistic Testing**: Uses actual OrionAgent instances, not simplified mocks

### Negative
- **Resource Intensive**: Each test runs a full OrionAgent instance with tool orchestration
- **Time Consuming**: 30 tests (10 subtasks × 3 phases) take ~30-60 minutes to complete
- **False Negatives**: Orion's natural language variability may cause tests to be skipped (clarification questions)
- **Mock Maintenance**: Mock tools must be kept in sync with real tool interfaces

### Risks
- **Over-reliance on Mocks**: May miss integration issues that only appear with real tools
- **Test Flakiness**: LLM non-determinism could produce inconsistent results across runs
- **Context Window Differences**: CLI may have different context (chat history) than isolated tests

## Implementation Details

### Probe Architecture (`backend/scripts/probes/probe_skill_test.js`)
```javascript
// Key components:
1. Three-phase test configuration (baseline, discovery, compliance)
2. Mock tools that handle Orion's object parameter format
3. ContextService integration for realistic context building
4. Response storage in PostgreSQL for analysis
5. Automated execution across 10 subtasks
```

### Mock Tools Design
- **`MockDatabaseTool`**: Handles object parameters (`{ subtask_id: '...', context: {...} }`), returns placeholder data
- **`MockFileSystemTool`**: Provides mock file content for common paths, avoids ENOENT errors
- **Parameter Bug Workaround**: Mocks accept Orion's object parameter format, exposing CLI vs automated testing differences

### Data Schema
```sql
-- skill_test_responses table stores:
- test_phase (baseline, discovery, compliance)
- subtask_id (e.g., '2-1-2')
- user_prompt (exact prompt sent to Orion)
- orion_response (full response text)
- response_metadata (JSON with skill usage, clarification flags, etc.)
```

## Testing Workflow Discovered
During implementation, we discovered a **repeatable skill testing workflow**:

1. **Identify Parameter Mismatches**: Automated testing exposes differences between CLI and automated parameter passing
2. **Create Targeted Mocks**: Build mock tools that handle the actual parameter formats Orion uses
3. **Isolate Skill Effects**: Test skills in controlled conditions without infrastructure dependencies
4. **Collect Quantitative Data**: Store responses for objective analysis and grading
5. **Iterate Based on Findings**: Use test results to improve skills and prompts

This workflow can be extended to:
- Testing new skills before deployment
- Benchmarking Orion improvements across versions
- Validating prompt engineering strategies
- A/B testing alternative skill implementations

## Future Applications

### Immediate Next Steps
1. Let current probe complete all 30 tests to collect full dataset
2. Have Adam grade responses for skill application quality
3. Compare baseline vs discovery vs compliance phases

### Long-term Vision
1. **Automated Skill Validation**: New skills must pass three-phase testing before deployment
2. **Performance Regression Testing**: Monitor skill effectiveness across Orion updates
3. **Cross-Skill Comparison**: Test which skills are most effective for different task types
4. **Prompt Optimization**: Use test results to refine skill descriptions and usage instructions

## References
1. `ADR-2026-01-01-skills-framework-mvp.md` – Skills framework architecture
2. `backend/scripts/probes/probe_skill_test.js` – Three-phase probe implementation
3. `backend/scripts/probes/mock_database_tool.js` – Mock database tool
4. `backend/scripts/probes/mock_fs_tool.js` – Mock filesystem tool
5. Feature 2 v5 Specification – Requirements for autonomous TDD workflow

---

**Approved by**: Adam (Architect)  
**Date**: 2026-01-02  
**Test Results**: Probe currently running (4/30 tests completed in baseline phase)
