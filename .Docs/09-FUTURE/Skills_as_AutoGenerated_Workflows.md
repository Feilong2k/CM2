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

## Enhanced Architecture: PCC Extractor as Compiler Front-End

### The Pipeline: PCC Extractor → Skill Compiler → Executable Tool

```
Natural Language Skill Description
         ↓
   PCC Extractor v1
   (Structured Analysis)
         ↓
   YAML Artifact with:
   - Atomic Actions (A1, A2...)
   - Resources Touched (R1, R2...)
   - Coverage Ledger
   - Missing Fundamentals
         ↓
   Skill Compiler
   (Transforms to SKILL.md v2)
         ↓
   Executable Workflow Steps
   with built-in constraint checks
```

### PCC Extractor Integration

The PCC Extractor (from `.Docs/03-PROTOCOLS/core/PCC_Extractor_v1.md`) provides:

1. **Structured analysis** of natural language skill descriptions
2. **Deterministic checks** for completeness and consistency
3. **Missing fundamentals detection** for scripts, tools, and resources
4. **Traceability** via source mapping and coverage ledger

### Handling Missing Scripts and Functions

When a skill requires a script/function that isn't available:

1. **Detection**: PCC Extractor marks it in `missing_fundamentals`:
   ```yaml
   missing_fundamentals:
     - id: M1
       type: "script"
       item: "backup_to_server.sh"
       required_by_actions: [A1]
       status: "MISSING"
   ```

2. **Auto-generation** (optional enhancement):
   - Template-based generation for common patterns (backup, cleanup, etc.)
   - Generated scripts stored in skill's `scripts/` folder
   - Status changed to `AUTO_GENERATED_NEEDS_REVIEW`

3. **Skill status tracking**:
   - **complete**: No missing fundamentals
   - **needs_review**: Auto-generated scripts need verification
   - **incomplete**: Missing scripts/tools require manual creation

### Template System for Common Operations

```yaml
# Compiler configuration
script_templates:
  backup_to_server:
    language: "bash"
    template: |
      #!/bin/bash
      # Auto-generated backup script for {{skill_name}}
      SOURCE="{{source_path}}"
      DEST="{{server_path}}"
      
      if [ ! -f "$SOURCE" ]; then
        echo "Error: Source file not found: $SOURCE"
        exit 1
      fi
      
      scp "$SOURCE" "$DEST"
      echo "Backup completed: $(date)"
    required_params: ["source_path", "server_path"]
```

### Re-compilation Capability: Iterative Skill Development

A key advantage of the compiler-based approach is **easy re-compilation**. When skill steps are updated:

1. **Skill authors edit** the natural language description or SKILL.md v2 `steps` section
2. **Re-run PCC Extractor** to analyze changes and update the YAML artifact
3. **Recompile** the skill with updated steps
4. **Skill immediately follows new steps** in the next execution

This enables **iterative skill development**:
- Start with simple skill description → compile → test
- Identify missing constraints or steps → update description → recompile
- Add new capabilities → update → recompile

**Example workflow:**
```bash
# Initial compilation
$ skill-compiler compile database_backup.skill.md

# Test reveals missing error handling
# Update skill description to include error recovery steps

# Recompile with updates
$ skill-compiler compile database_backup.skill.md --force

# Skill now includes error recovery in its workflow
```

**Benefits of re-compilation:**
- **Rapid iteration**: Update skills without manual step-by-step rewrites
- **Version control**: Track skill evolution through compilation artifacts
- **Consistency**: All skill instances immediately use updated steps
- **Validation**: Each recompilation runs deterministic checks to catch regressions

The PCC Extractor's **coverage ledger** ensures no steps are accidentally removed during updates, maintaining skill completeness across iterations.

## Implementation Roadmap

### Phase 1: Foundation (2 weeks)
- SKILL.md v2 format definition (extended, but optional alongside v1)
- Step Generator prototype (initially **linear only**, no parallelism)
- Convert 1-2 **non-critical** skills into v2 format for experimentation
- **NEW**: Basic PCC Extractor integration for skill analysis

### Phase 2: Execution Engine (3 weeks)
- Linear execution engine:
  - Execute `steps` top-to-bottom using existing ToolOrchestrator for `type: tool` steps
  - Use Main LLM for `type: analysis` steps
- Add **basic dependency support** via `output_var` / `inputs`
- Design and validate SKILL.md v2 schema with TDD (Tara/Devon prompts)
- **NEW**: Skill Compiler prototype transforming PCC YAML to SKILL.md v2

### Phase 3: Integration (2 weeks)
- Introduce **simple parallel groups**:
  - Mark explicit parallel blocks where steps have no mutual dependencies
  - Execute those groups concurrently; keep error handling simple (group fails on first failure)
- Integrate with SkillTool_execute (2-3-3):
  - If a skill has `steps` → use the workflow engine
  - If not → fall back to current "v1" text-based execution
- Update Orion coordination logic to treat skills with `steps` as **workflows**, not just prompts
- Add targeted probes to compare behavior vs existing v1 skills
- **NEW**: Missing script detection and basic template system

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
- **NEW**: Advanced script auto-generation with parameter inference

## Risk Assessment

### Technical Risks
1. **Step dependency complexity** → Graph algorithms
2. **Error handling in parallel flows** → Step-level retry logic
3. **Resource contention** → Agent pool management
4. **NEW**: Script auto-generation safety → Template validation and review process

### Mitigation Strategies
- Start with simple linear skills
- Implement comprehensive logging
- Gradual rollout with fallback option
- **NEW**: Human review required for auto-generated scripts

## Success Metrics

### Primary Metrics
- **Latency reduction**: Target 50% faster skill execution
- **Consistency improvement**: 100% identical execution patterns
- **Developer productivity**: Reduced manual step creation

### Secondary Metrics
- **Skill execution success rate**: Target 95%+
- **Parallelization efficiency**: % of steps executed concurrently
- **Resource utilization**: Optimal agent allocation
- **NEW**: Skill compilation success rate (PCC Extractor coverage)

## Cost-Benefit Analysis

### Development Costs
- **Effort**: ~8 weeks engineering time (including PCC Extractor integration)
- **Complexity**: Medium (new concurrent systems + compiler pipeline)
- **Maintenance**: Ongoing optimization and template expansion

### Performance Gains
- **Speed**: 2-3x faster skill execution
- **Consistency**: Eliminates execution variations
- **Scalability**: Handles growing skill library
- **NEW**: Automated skill creation from natural language

### Business Impact
- **Better TDD workflow reliability**
- **Faster developer feedback loops**
- **Foundation for advanced automation**
- **NEW**: Democratized skill creation (non-technical users can describe workflows)

## Next Steps

1. **Review with Adam** for architectural alignment
2. **Create SKILL.md v2 prototype** for 1–2 low-risk skills (keep v1 skills unchanged)
3. **Benchmark current vs proposed** performance on those skills only (A/B style)
4. **Define compatibility rules** between SKILL v1 and v2 (fallback behavior in SkillTool_execute)
5. **Plan gradual rollout** starting with non-critical workflows, keeping this as a **post-MVP** initiative
6. **NEW**: Implement PCC Extractor integration for skill analysis
7. **NEW**: Design template system for common script patterns
8. **NEW**: Create skill status tracking in SkillLoader

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
- **NEW**: Skills can be compiled from natural language via PCC Extractor
- **NEW**: Missing scripts can be auto-generated with template system

### Why This Matters (Prompt vs Workflow)

- **Problem with v1-only (soft) skills:**
  - Execution depends heavily on the main LLM's current prompt/history.
  - Old think/act patterns or prompt cruft can bias when/how skills are used.
  - Results can be inconsistent even for the same skill and input.

- **Benefit of v2 workflows:**
  - Skills become **declarative step graphs**, not just hints.
  - Execution is driven by a workflow engine, not by "soft" prompt interpretation.
  - This reduces the kind of inconsistency we saw with tool calls and soft CAP/PCC prompts.
  - **NEW**: Skills can be automatically generated and validated for completeness.

In short: keep MVP focused on v1 Skills + SkillLoader + SkillTool_execute. Once that is solid, incrementally introduce SKILL v2 workflows for selected skills to gain consistency and performance without destabilizing the current system.

---

Additionally, we've identified a key insight about attention directing through questionnaire-based skills (like 2-3-11 Task Preparation Assistant), which leads to exponential quality improvements by focusing AI attention on specific categories. This insight is noted as a future development opportunity for the skills automation system.

**Updated by:** Orion (Orchestrator)  
**Original Date:** 2024-01-01  
**Update Date:** 2026-01-06  
**Status:** Enhanced Proposal with PCC Extractor Integration
