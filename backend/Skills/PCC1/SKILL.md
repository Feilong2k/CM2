---
name: "PCC1"
description: "Preflight Constraint Check Level 1 - Action-Resource mapping to identify gaps, constraints, and risks"
version: "1.0.0"
type: "subskill"
decision_triggers:
  - "Planning technical implementations"
  - "Analyzing complex tasks with multiple actions"
  - "Identifying potential gaps before implementation"
  - "Validating that data flows correctly between components"
  - "Preparing for PVP Step 3 (IDENTIFY GAPS)"
dependencies: []
last_updated: "2026-01-02"
---

# PCC1 (Preflight Constraint Check Level 1) Skill

## Overview
**PCC1** (Preflight Constraint Check Level 1) is a systematic protocol for mapping actions to resources to identify gaps, constraints, and risks before implementation. It ensures that all components connect correctly and that data flows properly between them.

## The PCC1 Protocol: Action → Resource → Constraint → Gap

### Step 1: List All Actions
**Objective:** Identify every discrete action in the plan.

**Actions should be:**
- Specific and concrete (e.g., "frontend_poll_updates", "database_store_message")
- Use imperative verbs or descriptive names
- Atomic enough to map to specific resources

**Example Actions:**
1. `frontend_poll_updates` - Poll for new chat messages
2. `database_store_message` - Save message to database
3. `api_send_message` - Send message via API

### Step 2: Map Each Action to Resources
**Objective:** For each action, identify every resource it touches.

**Resource Categories:**
- **Data Sources:** Databases, APIs, files, external services
- **Infrastructure:** Servers, memory, CPU, network, storage
- **Dependencies:** Libraries, frameworks, third-party services
- **Configuration:** Environment variables, config files, secrets

**Example Mapping:**
- `frontend_poll_updates` → File System (JSON files), Network (HTTP requests)
- `database_store_message` → PostgreSQL database, Memory (connection pool)
- `api_send_message` → External API, DEEPSEEK_API_KEY environment variable

### Step 3: Identify Constraints for Each Resource
**Objective:** For each resource, list specific constraints.

**Constraint Types:**
- **Technical:** Performance limits, capacity, compatibility
- **Operational:** Availability, reliability, maintenance windows
- **Security:** Authentication, authorization, data protection
- **Business:** Cost, compliance, regulatory requirements

**Example Constraints Table:**

| Action | Resource | Constraint | Risk | Mitigation |
|--------|----------|------------|------|------------|
| `api_send_message` | DEEPSEEK_API_KEY | Required environment variable | "Missing key prevents chat" | "Validate DEEPSEEK_API_KEY environment variable" |
| `frontend_poll_updates` | Memory | Context limited to 20 messages | "Missing conversation history" | "Database retrieval error handling" |

### Step 4: Identify Gaps and Mismatches
**Objective:** Analyze the mapping to find broken links and inconsistencies.

**Gap Analysis Questions:**
- Do actions read from and write to the same data sources?
- Are there missing connections between actions?
- Do format mismatches exist between components?
- Are there unhandled error paths or failure modes?

**Example Gap:**
- **Action:** `frontend_poll_updates` reads from JSON files
- **Action:** `database_store_message` writes to database
- **Gap:** Polling shows stale data because writes go to database, not JSON files
- **Mitigation:** Align data sources by removing polling or updating polling to read from database

## Quick Reference Checklist

When applying PCC1, use this checklist:

- [ ] **Step 1:** Listed all concrete actions
- [ ] **Step 2:** Mapped each action to specific resources
- [ ] **Step 3:** Identified constraints for each resource
- [ ] **Step 4:** Documented risks and mitigations
- [ ] **Step 5:** Analyzed for gaps and mismatches
- [ ] **Step 6:** Generated gap analysis report

## How PCC1 Reveals Gaps

PCC1 systematically reveals critical gaps by forcing explicit mapping:

1. **Data Source Mismatches:** When one action reads from source A but another writes to source B
2. **Missing Connections:** When output from one action isn't consumed by any other action
3. **Format Incompatibilities:** When data transformations aren't explicitly defined
4. **Unhandled Constraints:** When resource limitations aren't accounted for
5. **Missing Error Handling:** When failure modes aren't addressed

**Example Gap Discovery:**
- **Action 1:** `frontend_poll_updates` reads from JSON files
- **Action 2:** `database_store_message` writes to database
- **PCC1 Finding:** Polling shows stale data because writes go to database, not JSON files
- **Mitigation:** Either remove polling or update polling to read from database

## Integration with PVP

PCC1 is designed to be used within **PVP Step 3 (IDENTIFY GAPS)**. The structured format ensures:
1. Every action is accounted for
2. Every resource is identified  
3. Every constraint is analyzed
4. Gaps are explicitly documented with mitigation strategies

## Benefits

- **Systematic:** Ensures no action or resource is overlooked
- **Clear Documentation:** Creates a record of constraints and mitigations
- **Actionable Output:** Provides specific issues that must be addressed
- **Testable:** Constraints and mitigations can be turned into verification tests

## Related Protocols

- **PVP (Plan Verification Protocol):** Uses PCC1 in step 3 to identify gaps
- **CAP (Constraint-Aware Planning):** Can use PCC1 findings for detailed planning
- **Tara's Testing Protocol:** Can use constraints and risks identified by PCC1 to create targeted tests

## Common Pitfalls & Solutions

### Pitfall 1: Vague Actions
**Symptom:** Actions like "improve performance" or "fix bug" that can't be mapped to resources
**Solution:** Break down into specific, atomic actions with clear boundaries

### Pitfall 2: Missing Resources
**Symptom:** Focusing only on obvious resources (database, API) while ignoring memory, CPU, network
**Solution:** Use resource categories checklist to ensure comprehensive coverage

### Pitfall 3: Ignoring Implicit Constraints
**Symptom:** Documenting only explicit constraints while missing implicit ones (rate limits, compatibility)
**Solution:** Ask "what could go wrong?" for each resource-action pair

### Pitfall 4: Skipping Gap Analysis
**Symptom:** Creating the mapping but not analyzing for inconsistencies
**Solution:** Systematically check data flow between all connected actions

## Examples
See `examples.md` for detailed PCC1 applications to common scenarios.

## Related Skills
- **CAP (Constraint-Aware Planning):** Uses PCC1 findings for detailed implementation planning
- **RED (Requirement Extraction):** Provides requirements that PCC1 validates for technical feasibility
- **PVP (Plan Verification Protocol):** Incorporates PCC1 as its step 3 for gap identification

## Changelog
- **v1.0.0 (2026-01-02):** Correct PCC1 (Preflight Constraint Check Level 1) definition
  - Action → Resource → Constraint → Gap mapping protocol
  - Integration with PVP Step 3
  - Gap analysis and mitigation strategies

---
*Use PCC1 to map actions to resources and identify gaps before implementation. Systematic gap prevention saves rework and ensures data flows correctly.*
