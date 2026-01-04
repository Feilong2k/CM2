# Skills as Auto-Generated Workflows: Architecture Proposal

## Executive Summary

**Problem:** Skills are currently passive context fed to main LLM, causing:
- Inconsistent execution patterns
- Sequential thinking → tool call latency
- Manual step creation overhead
- No parallelism in workflows

**Solution:** Convert skills into auto-generated executable workflows:
- Skills → Step lists (auto-generated)
- Concurrent execution of independent steps
- Specialized agents for different step types
- Guaranteed consistency across executions

## Architecture Overview

### Three-Tier System

```
User Request → Skill Router → Step Generator → Concurrent Engine → Final Response
```

### **Architecture Diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│                    User Request                             │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    Skill Router LLM                         │
│  (Determines which skill matches request)                   │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    Skill → Step Generator                   │
│  (Converts skill into executable step list)                 │
└──────────────┬────────────────┬─────────────────────────────┘
               ↓                ↓
    ┌─────────────────┐  ┌─────────────────┐
    │  Tool Steps     │  │  Analysis Steps │
    │  (Immediate)    │  │  (When needed)  │
    └────────┬────────┘  └────────┬────────┘
             ↓                    ↓
    ┌─────────────────────────────────────┐
    │      Concurrent Execution Engine    │
    │  - Tool steps → Tool Caller LLM     │
    │  - Analysis → Main LLM              │
    │  - Parallel where possible          │
    └──────────────────┬──────────────────┘
                       ↓
    ┌─────────────────────────────────────┐
    │         Results Aggregator          │
    │  (Combines outputs, handles errors) │
    └──────────────────┬──────────────────┘
                       ↓
    ┌─────────────────────────────────────┐
    │          Final Response             │
    └─────────────────────────────────────┘
```
### Key Components

1. **Skill Router LLM**
   - Determines which skill matches request
   - Fast, deterministic routing (7B model)
   - Consistent skill selection

2. **Step Generator**
   - Converts skill definition into executable steps
   - Builds dependency graph
   - Assigns agents to steps

3. **Concurrent Execution Engine**
   - Parallel execution of independent steps
   - Agent pool management
   - Result aggregation

### Agent Specialization

- **Tool Caller LLM** (7B): Routine tool execution, no thinking
- **Main LLM** (70B+): Complex analysis, reasoning
- **Each optimized** for specific task types

## Technical Implementation

### SKILL.md v2 Format

```yaml
name: check_project_status
description: Checks current project status
steps:
  - type: tool
    agent: tool_caller
    action: DatabaseTool_list_subtasks_by_status
    params: {status: "pending", limit: 10}
    output_var: pending_tasks
  
  - type: tool  
    agent: tool_caller
    action: DatabaseTool_list_subtasks_by_status
    params: {status: "in_progress", limit: 10}
    output_var: active_tasks
  
  - type: analysis
    agent: main_llm
    action: summarize_status
    inputs: [pending_tasks, active_tasks]
```

### Step Types

1. **Tool Steps**: Database/FileSystem operations → Tool Caller
2. **Analysis Steps**: Reasoning, summarization → Main LLM
3. **Conditional Steps**: Branching logic → Step Generator
4. **Parallel Steps**: Independent operations → Concurrent Engine

### Dependency Resolution

- **Graph-based** dependency analysis
- **Independent steps** execute in parallel
- **Dependent steps** wait for inputs
- **Partial success** supported

## Performance Benefits

### Latency Comparison

**Current (Sequential):**
```
Think (500ms) → Tool1 (300ms) → Think (200ms) → Tool2 (300ms) → Analyze (300ms)
Total: ~1.6 seconds
```

**Proposed (Parallel):**
```
[Tool1, Tool2] in parallel (300ms) → Analyze (300ms)
Total: ~0.6 seconds (2.7x faster)
```

### Consistency Guarantees

- **Same skill** → **identical steps** every time
- **No variation** in execution patterns
- **Predictable** resource usage
- **Reliable** error handling

## CodeMaestro Integration

### TDD Workflow Example

**Current:**
- Orion manually creates steps for Tara/Devon
- Sequential tool calls
- Inconsistent execution patterns

**Proposed:**
```
Skill: "tdd_review" auto-generates:
  1. Tool: get_subtask_context (parallel)
  2. Tool: read_test_file (parallel)
  3. Analysis: review_tests (when 1-2 complete)
  4. Tool: update_subtask_status (final)
```

### Skill Transformation

**Before (Passive Context):**
```
"Use DatabaseTool to query subtasks, then analyze results..."
```

**After (Active Workflow):**
```
steps:
  - tool: DatabaseTool_list_subtasks_by_status
  - tool: DatabaseTool_get_subtask_full_context  
  - analysis: summarize_findings
```

## Implementation Roadmap

### Phase 1: Foundation (2 weeks)
- SKILL.md v2 format definition (extended, but optional alongside v1)
- Step Generator prototype (initially **linear only**, no parallelism)
- Convert 1-2 **non-critical** skills into v2 format for experimentation

### Phase 2: Execution Engine (3 weeks)
- Linear execution engine:
  - Execute `steps` top-to-bottom using existing ToolOrchestrator for `type: tool` steps
  - Use Main LLM for `type: analysis` steps
- Add **basic dependency support** via `output_var` / `inputs`
- Design and validate SKILL.md v2 schema with TDD (Tara/Devon prompts)

### Phase 3: Integration (2 weeks)
- Introduce **simple parallel groups**:
  - Mark explicit parallel blocks where steps have no mutual dependencies
  - Execute those groups concurrently; keep error handling simple (group fails on first failure)
- Integrate with SkillTool_execute (2-3-3):
  - If a skill has `steps` → use the workflow engine
  - If not → fall back to current "v1" text-based execution
- Update Orion coordination logic to treat skills with `steps` as **workflows**, not just prompts
- Add targeted probes to compare behavior vs existing v1 skills

### Phase 4: Optimization (ongoing)
- Generalize to full **DAG-based** dependency graph:
  - Arbitrary dependencies between steps via named outputs/inputs
  - Conditional/branching steps for more complex flows
- Improve error handling:
  - Step-level retry policies (per tool type)
  - Partial success semantics and graceful degradation
- Performance and UX optimization:
  - Pre-execution of predictable steps
  - Caching frequent results (integrated with ToolResultCacheService)
  - Dynamic step reordering when it is safe to do so

## Risk Assessment

### Technical Risks
1. **Step dependency complexity** → Graph algorithms
2. **Error handling in parallel flows** → Step-level retry logic
3. **Resource contention** → Agent pool management

### Mitigation Strategies
- Start with simple linear skills
- Implement comprehensive logging
- Gradual rollout with fallback option

## Success Metrics

### Primary Metrics
- **Latency reduction**: Target 50% faster skill execution
- **Consistency improvement**: 100% identical execution patterns
- **Developer productivity**: Reduced manual step creation

### Secondary Metrics
- **Skill execution success rate**: Target 95%+
- **Parallelization efficiency**: % of steps executed concurrently
- **Resource utilization**: Optimal agent allocation

## Cost-Benefit Analysis

### Development Costs
- **Effort**: ~7 weeks engineering time
- **Complexity**: Medium (new concurrent systems)
- **Maintenance**: Ongoing optimization

### Performance Gains
- **Speed**: 2-3x faster skill execution
- **Consistency**: Eliminates execution variations
- **Scalability**: Handles growing skill library

### Business Impact
- **Better TDD workflow reliability**
- **Faster developer feedback loops**
- **Foundation for advanced automation**

## Next Steps

1. **Review with Adam** for architectural alignment
2. **Create SKILL.md v2 prototype** for 1–2 low-risk skills (keep v1 skills unchanged)
3. **Benchmark current vs proposed** performance on those skills only (A/B style)
4. **Define compatibility rules** between SKILL v1 and v2 (fallback behavior in SkillTool_execute)
5. **Plan gradual rollout** starting with non-critical workflows, keeping this as a **post-MVP** initiative

---

## Relationship to Current Skills v1 (MVP)

This proposal is intentionally a **post-MVP evolution** of the Skills Framework.

### Current (v1) Skills

- SKILL.md (v1) is primarily **textual protocol** plus YAML frontmatter.
- `SkillLoader` (2-3-2) provides metadata (name, description, type, tags).
- `SkillTool_execute` (2-3-3) will:
  - Load SKILL.md body,
  - Inject it into LLM context,
  - Let the LLM follow the protocol (soft execution).

### Future (v2) Skills as Workflows

- SKILL.md v2 will **add** a structured `steps` section (tool/analysis/conditional steps).
- A workflow engine will:
  - Interpret and execute these steps directly,
  - Use ToolOrchestrator for `type: tool` steps,
  - Use Main/Reasoner LLM for `type: analysis` steps.
- `SkillTool_execute` will:
  - If `steps` are present → execute via engine (hard, deterministic execution),
  - Else → fall back to v1 behavior (textual, soft execution).

### Why This Matters (Prompt vs Workflow)

- **Problem with v1-only (soft) skills:**
  - Execution depends heavily on the main LLM's current prompt/history.
  - Old think/act patterns or prompt cruft can bias when/how skills are used.
  - Results can be inconsistent even for the same skill and input.

- **Benefit of v2 workflows:**
  - Skills become **declarative step graphs**, not just hints.
  - Execution is driven by a workflow engine, not by "soft" prompt interpretation.
  - This reduces the kind of inconsistency we saw with tool calls and soft CAP/PCC prompts.

In short: keep MVP focused on v1 Skills + SkillLoader + SkillTool_execute. Once that is solid, incrementally introduce SKILL v2 workflows for selected skills to gain consistency and performance without destabilizing the current system.

---

**Prepared by:** Orion (Orchestrator)  
**Date:** 2024-01-01  
**Status:** Proposal for Architecture Review
