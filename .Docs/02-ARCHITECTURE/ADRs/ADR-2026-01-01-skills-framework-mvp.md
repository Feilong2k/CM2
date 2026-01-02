# ADR-2026-01-01: Skills Framework MVP for Subtask Processing

## Status
**Proposed** – Architectural decision for Feature 2 implementation

## Context
Feature 2 (Autonomous TDD Workflow with Aider Integration) requires Orion to process diverse subtasks (database migrations, API endpoints, UI components, etc.) in a consistent, robust manner. The previous ADR (ADR-2025-12-29) established a modular architecture with agent skills, but did not specify the internal structure of the skills framework.

The `SKILLS_Architecture.md` document (in `.Docs/00-INBOX`) analyzed three architectural options for subtask processing skills:
1. **Monolithic skill** – One skill that does everything (simple but brittle)
2. **Independent skills** – 8 separate skills called sequentially (modular but coordination-heavy)
3. **Hierarchical skills** – One parent orchestrator that dynamically selects and executes sub-skills (balanced, extensible)

The hierarchical approach aligns with long-term goals of dynamic skill selection, fallback mechanisms, and adaptive learning while delivering MVP value quickly.

### **New Findings from Updated Analysis**
Recent discussions revealed critical insights that shape the implementation strategy:
1. **Usability Testing is Essential:** The fundamental assumption that Orion will actually use skills must be tested. LLM agents have context window limits, no persistent memory, and a tendency to "wing it" under time pressure.
2. **Existing Protocols as Skills:** Protocols in `.Docs/03-PROTOCOLS` (CAP, RED, PCC, etc.) are perfect candidates for sub-skills. They represent battle-tested processes that can be formalized as executable skills.
3. **Hybrid Integration Approach:** Skills must be both memory-accessible (concise summaries in system prompt) and tool-executable (structured tool calls for complex executions) to ensure actual usage.
4. **Progressive Validation:** Start with memory-based skill integration, test with real subtasks (e.g., 2-1-1), then evolve to tool-based execution with tracking and optimization.
5. **Dynamic Fallback Mechanisms:** The hierarchical approach enables skill swapping when one approach fails, providing robustness through alternative strategies.

## Decision
We will implement a **hierarchical skills framework** for subtask processing with the following characteristics:

### 1. **Parent Orchestrator Skill**
- **Name:** `ProcessSubtaskSkill`
- **Responsibility:** Coordinate the end-to-end processing of any subtask
- **Interface:** Accepts `subtask_id`, returns completion status and artifacts
- **Design:** Thin coordinator that delegates to sub-skills, manages workflow state, and handles errors

### 2. **Sub-skills (Modular, Reusable)**
- **Phase 1 (MVP):** 3 core sub-skills derived from existing protocols:
  1. `PlanningVerificationSkill` (CAP protocol) – Verify technical plans will achieve goals
  2. `RecursiveDecompositionSkill` (RED protocol) – Uncover unknown unknowns and hidden assumptions
  3. `ConstraintDiscoverySkill` (PCC protocol) – Identify constraints, gaps, and risks
- **Future phases:** Additional sub-skills from other protocols (Agent Handover, Observability, Safety Rollback, etc.)
- **Protocol Integration:** Skills will be formalized versions of existing battle-tested protocols from `.Docs/03-PROTOCOLS`

### 3. **Dynamic Skill Selection**
- **Phase 1:** Fixed workflow sequence (Analyze → Decompose → Orchestrate)
- **Phase 2:** Rule-based selection based on subtask type (database, API, UI, etc.)
- **Phase 3:** ML-driven selection with performance feedback and fallback mechanisms

### 4. **Skill Registry Pattern**
- Central registry for skill discovery and execution
- Standardized skill interface (input/output schemas, error handling)
- Skill metadata (name, version, tags, capabilities) for future dynamic selection

## Consequences

### Positive
- **MVP Deliverable:** Simple fixed workflow can be implemented quickly (Phase 1)
- **Extensibility:** New sub-skills can be added without breaking existing workflows
- **Reusability:** Sub-skills can be used independently for other purposes
- **Testability:** Each skill can be unit tested; orchestrator can be integration tested
- **Observability:** Each skill execution can be traced and monitored
- **Future-proof:** Architecture supports advanced features (A/B testing, skill marketplace, cross-project sharing)

### Negative
- **Initial Complexity:** More moving parts than monolithic approach
- **State Management:** Need to design context passing between skills
- **Coordination Overhead:** Parent skill must handle sub-skill sequencing and error propagation
- **Learning Curve:** Developers must understand skill composition patterns

### Risks
- **Over-engineering Phase 1:** Must resist adding dynamic features too early
- **Skill Interface Evolution:** Changing skill interface may break existing skills
- **Performance Degradation:** Too many skill invocations could slow processing
- **Skill Proliferation:** Without governance, too many similar skills may emerge

## Alternatives Considered

### Alternative A: Monolithic Skill
- **Description:** One `ProcessSubtaskSkill` that implements all logic internally
- **Rejection Reason:** Violates single responsibility principle, hard to test/extend/maintain

### Alternative B: Independent Skills
- **Description:** 8 separate skills that users/callers must sequence manually
- **Rejection Reason:** Puts coordination burden on callers, error-prone, less reusable

### Alternative C: Microservices Architecture
- **Description:** Each skill as independent service with HTTP/RPC interfaces
- **Rejection Reason:** Overkill for current scale, introduces network latency and failure modes

## Implementation Plan

### Phase 1: Foundation (MVP for Feature 2)
1. **Define Skill Interface Standard**
   - Input/output JSON schemas based on protocol requirements
   - Error handling contract with fallback mechanisms
   - Context passing format for state management between skills
2. **Create Skill Registry with Protocol Integration**
   - In-memory registry that loads protocols from `.Docs/03-PROTOCOLS`
   - Protocol-to-skill adapter that formalizes existing protocols as executable skills
   - Skill registration and discovery with metadata (tags, capabilities, performance)
3. **Implement 3 Core Protocol-Based Sub-skills**
   - `PlanningVerificationSkill` (CAP protocol): Formalize 7-step verification process
   - `RecursiveDecompositionSkill` (RED protocol): Implement 5-layer decomposition with audits
   - `ConstraintDiscoverySkill` (PCC protocol): Convert 3-level constraint analysis to executable skill
4. **Build Hybrid Parent Orchestrator**
   - **Memory Integration:** Add concise skill summaries to Orion's system prompt for quick recall
   - **Tool Integration:** Create `skill_execute` tool for structured protocol execution
   - **Fixed Workflow:** CAP → RED → PCC sequence for initial testing
   - **Error Handling:** Basic retry logic with skill swapping capabilities
   - **Observability:** Trace event emission for skill execution monitoring
5. **Usability Testing with Real Subtasks**
   - **Primary Test:** Subtask 2-1-1 (PostgreSQL ENUM types) as end-to-end validation
   - **Compliance Check:** Verify Orion actually uses skills vs. ad-hoc approaches
   - **Performance Metrics:** Measure plan completeness, time savings, error reduction
   - **Iterative Refinement:** Adjust skill definitions based on actual usage patterns

### Phase 2: Dynamic Selection (Post-Feature 2)
1. **Skill Metadata System**
   - Tagging (database, api, ui, testing, etc.)
   - Performance metrics collection
2. **Rule-based Selector**
   - Maps subtask types to optimal skill sequences
   - Fallback skill definitions
3. **Enhanced Error Recovery**
   - Alternative skill execution on failure
   - Skill performance-based routing

### Phase 3: Adaptive Learning (Long-term)
1. **Skill Performance Tracking**
   - Success/failure rates, execution times
   - Outcome quality assessment
2. **ML-based Recommendation**
   - Predict optimal skill combinations
   - Continuous improvement from historical data
3. **Skill Marketplace Concept**
   - Share skills across Orion instances
   - Community-contributed skills

### Phase 4: Advanced Intelligence (Vision)
1. **Automated Skill Refinement**
   - Skills that improve with usage
   - Cross-skill knowledge sharing
2. **Predictive Skill Composition**
   - Generate custom skill workflows for novel problems
   - Proactive skill development for emerging patterns

## Integration with Existing Architecture

### Alignment with ADR-2025-12-29
- Skills framework implements the "Agent Skills" concept from the previous ADR
- Skills directory structure can follow the `SKILL.md` + scripts pattern
- Progressive skill loading aligns with context window management goals

### Tool Integration
- Skills will use existing tools (`DatabaseTool`, `FileSystemTool`, etc.)
- Skill execution will be traceable via existing `TraceService`
- Skills will integrate with Aider-based sub-agents (TaraAider, DevonAider)

### Database Schema
- New table `skills` for skill metadata and performance tracking
- New table `skill_executions` for audit trail and learning data
- Extensions to `trace_events` for skill-level tracing

## Success Metrics

### Phase 1 MVP Success Criteria (Updated with Usability Focus)
- [ ] **Usability Validation:** Orion uses skills (CAP/RED/PCC) without prompting for subtask 2-1-1
- [ ] **Compliance:** Skill-guided planning produces more complete plans than ad-hoc approaches (measured by gap analysis)
- [ ] **Integration:** Hybrid approach works (memory prompts + tool execution) with no context window bloat (<5% increase)
- [ ] **Traceability:** Skill executions are fully traceable in UI with performance metrics
- [ ] **Error Handling:** Skill swapping on failure provides robustness (tested with simulated failures)
- [ ] **Protocol Conversion:** 3 protocols (CAP, RED, PCC) successfully formalized as executable skills

### Long-term Success Indicators
- **Skill Reusability:** Same protocol skills used across multiple subtask types (database, API, UI, etc.)
- **Processing Time:** Average subtask processing time decreases over time as skills improve
- **Success Rate:** Skill execution success rate improves with usage (learning from metrics)
- **Developer Velocity:** Time to add new skill decreases as protocol-to-skill pattern matures
- **Adaptive Selection:** Dynamic skill selection improves outcomes (measured by plan quality)

## Notes
- This ADR supersedes the skill-related decisions in ADR-2025-12-29 for subtask processing
- Implementation will begin with Task 2-5 (Skills Framework) in Feature 2
- The hierarchical architecture allows us to deliver MVP quickly while building foundation for advanced features
- Regular reviews will ensure we don't over-engineer early phases

## References
1. `.Docs/00-INBOX/SKILLS_Architecture.md` – Detailed analysis of architectural options
2. `ADR-2025-12-29-modular-architecture-with-skills.md` – Previous architecture decision
3. Feature 2 v5 Specification – Requirements for autonomous TDD workflow
4. Subtask 2-1-1 Implementation – First test case for skills framework
