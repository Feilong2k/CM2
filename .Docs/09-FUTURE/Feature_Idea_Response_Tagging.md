# Feature Idea: Response Tagging & Analysis System

## Goal
Implement a system to tag and classify Orion's responses (e.g., planning, execution, brainstorming) to enable long-term analysis, skill usage tracking, and model improvement.

## Rationale
- **Observability**: Understand how Orion spends its time and effort (planning vs. doing).
- **Skill Tracking**: Correlate response types with specific skills (CAP, RED, PCC) to measure effectiveness.
- **Data Curation**: Build high-quality datasets of "good planning" or "good execution" for future fine-tuning.
- **Debugging**: Identify mode collapse or behavior drift by analyzing tag distributions over time.

## Proposed Taxonomy (v1)

### 1. Response Types
- `planning`: Breaking down tasks, mapping dependencies, creating roadmaps.
- `analysis`: Understanding requirements, constraints, tradeoffs.
- `execution`: Giving implementation instructions, code edits, or direct changes.
- `tool_driven`: Responses primarily focused on interpreting tool output or deciding next calls.
- `brainstorming`: Idea generation, exploring solution space.
- `meta`: Reflecting on approach, summarizing, or negotiating scope.

### 2. Skill Signals (Inferred)
- `cap_like`: Structured planning, constraints, dependencies (CAP).
- `red_like`: Requirement/impact analysis (RED).
- `pcc_like`: Action/resource/constraint mapping (PCC).

### 3. Interaction Style
- `clarification_heavy`
- `direct_answer`
- `tool_first` vs `text_first`

## Implementation Strategy

### Phase 1: Offline/Batch Tagging (Post-MVP)
- **Mechanism**: Periodic script that scans `skill_test_responses` or message history.
- **Logic**: Heuristic/rule-based classification (similar to `grade_cap_probe_summary.js`).
- **Storage**: JSONB `tags` field in `response_metadata` or message table.
- **Pros**: Zero runtime overhead, easy to iterate on rules.

### Phase 2: Online Tagging (Future)
- **Mechanism**: Lightweight classifier run at response generation time.
- **Logic**: Model-based or optimized heuristic.
- **Usage**: Real-time dashboards, adaptive prompting based on current "mode".

## Integration Points
- `skill_test_responses` table (metadata column).
- Main message store / history log.
- Analysis scripts and dashboards.

## Next Steps (Post-MVP)
1. Define the initial JSON schema for tags.
2. Prototype a batch tagging script using the CAP probe data.
3. Validate tag accuracy against manual review.
4. Integrate into standard logging/history pipeline.
