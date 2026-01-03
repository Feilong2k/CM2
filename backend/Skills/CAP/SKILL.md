---
name: "Planning using CAP"
description: "Constraint-Aware Planning skill for analyzing and planning technical implementations on a feature, task and subtask levels"
version: "1.0.0"
type: "skill"
decision_triggers:
  - "Planning any technical implementation (database migrations, API changes, system integrations)"
  - "Analyzing complex tasks with multiple dependencies"
  - "Reviewing existing plans for completeness and feasibility"
  - "Preparing implementation specifications for developers"
  - "Creating test plans that need to cover all constraints"
dependencies: ["PCC1"]
last_updated: "2026-01-02"
---

# CAP (Constraint-Aware Planning) Skill

## Overview
**CAP** (Constraint-Aware Planning) is a systematic protocol for analyzing and planning technical implementations. It ensures all constraints, dependencies, and integration points are identified before execution, reducing rework and improving success rates.

## The 7-Step CAP Protocol

### Step 1: List Concrete Actions Needed
**Objective:** Break down the task into specific, actionable items.

**Guidelines:**
- Use imperative verbs (create, update, delete, modify, test, deploy)
- Make each action independently testable
- Avoid ambiguous terms like "improve" or "enhance" - be specific

**Example:**
Instead of "Improve database performance," specify:
1. Create indexes on frequently queried columns
2. Rewrite inefficient queries using EXPLAIN analysis
3. Configure connection pooling with appropriate settings

### Step 2: Identify Resources Each Action Touches
**Objective:** Map each action to specific resources it affects.

**Resource Categories:**
- **Database:** Tables, columns, indexes, constraints, views
- **API:** Endpoints, request/response schemas, authentication
- **Files:** Configuration files, scripts, documentation
- **Services:** External dependencies, third-party APIs
- **Infrastructure:** Servers, containers, networking, storage

**Example for "Create indexes":**
- Tables: `users`, `orders`, `products`
- Columns: `email`, `created_at`, `status`
- Performance: Query execution plans, disk space

### Step 3: Identify Gaps & Map Data Flow
**Objective:** Map the detailed data flow between actions and resources to identify missing steps and mismatches.

**Procedure:**
1. **Run PCC1 (Action → Resource → Constraint → Gap):** CAP Step 3 uses PCC1 to dive deeper with systematic mapping:
   - **Takes each action from Step 1** (the concrete actions list)
   - **Applies PCC1's full protocol** to each action:
     - **listing Atomic Actions:** list out the atomic actions in each action from step 1
     - **Map Resources:** Identify all resources each action touches (data sources, infrastructure, dependencies, configuration)
     - **Identify Constraints:** For each resource, document specific constraints (technical, operational, security, business)
     - **Analyze Gaps:** Look for mismatches between actions (e.g., Action A reads from source X, Action B writes to source Y)
   - **Produces detailed constraint analysis** (disk space, locking, monitoring needs)
   - **Identifies specific gaps** (missing rollback, monitoring, etc.)
   
   *See PCC1 skill at `backend/Skills/PCC1/SKILL.md` for complete protocol.*
   
2. **Create CAP Data Flow Map:** Based on the PCC1 findings, build a high-level data flow diagram showing:
   - **Sources:** Where data originates (APIs, databases, user input, etc.)
   - **Transforms:** What processing or changes occur (validation, conversion, enrichment, etc.)
   - **Destinations:** Where data ends up (storage, APIs, user interfaces, etc.)
   
3. **Identify Gaps:** Analyze the flow for:
   - Broken links (missing connections between steps)
   - Missing storage steps (data that isn't persisted when needed)
   - Format mismatches (data transformations that aren't explicitly defined)
   - Unhandled error paths (exceptions, network failures, validation errors)
   - Data source mismatches (actions reading/writing from different sources)

**Example for "Create indexes":**
1. **PCC1 Mapping:**
   - **Actions:** Create index on `users.email`
   - **Resources:** `users` table, `email` column, disk space, query planner, database connection pool
   - **Constraints:** 
     - Disk space must be available
     - Table may be locked during index creation
     - Query planner statistics need updating
   - **Gaps:** No monitoring of index usage, no rollback procedure
2. **CAP Data Flow Map:**
   - Source: Existing `users` table without index
   - Transform: DDL `CREATE INDEX` command, disk allocation, index build
   - Destination: New index on `users.email`, updated query planner statistics
3. **Gaps Identified:**
   - Missing: No rollback script if index creation fails
   - Missing: No monitoring of index usage post-creation
   - Mismatch: Index creation may lock table, blocking writes (need to check for concurrent index creation)
   - Constraint: Disk space must be checked before execution

### Step 4: Map Dependencies Between Actions
**Objective:** Create a dependency graph showing what must happen in what order.

**Dependency Types:**
- **Hard dependencies:** Action B cannot start until Action A completes
- **Soft dependencies:** Action B is easier if Action A completes first
- **Parallel actions:** Can run simultaneously
- **Resource conflicts:** Actions that compete for the same resource

**Example Dependency Map:**
1. Analyze query patterns → 2. Identify columns to index → 3. Test index creation → 4. Deploy indexes → 5. Monitor performance

### Step 5: Check Integration with Existing Systems
**Objective:** Ensure the plan works with current infrastructure and processes.

**Integration Points:**
- **CI/CD pipelines:** Will automated tests catch issues?
- **Monitoring systems:** Are metrics in place to detect problems?
- **Backup/restore procedures:** Do they account for new resources?
- **Security scanning:** Will new code pass security checks?
- **Documentation:** Where will changes be documented?

**Example Integration Checks:**
- Verify index creation won't break existing migration rollbacks
- Ensure monitoring dashboards include new performance metrics
- Confirm security scanning tools handle new database objects

### Step 6: Validate Completeness Against Goal
**Objective:** Ensure the plan fully addresses the original requirement.

**Validation Questions:**
- Does this plan solve the stated problem completely?
- Are all edge cases and failure modes addressed?
- What assumptions are we making? Are they valid?
- What's the rollback plan if something goes wrong?
- How will we know when we're done and successful?

**Example Validation:**
Original goal: "Reduce user login query time from 500ms to <100ms"
Validation: Plan includes indexes, query optimization, and performance monitoring to measure success.

### Step 7: Define Test Specifications
**Objective:** Create specific, measurable tests for each action.

**Test Requirements:**
- **Unit tests:** For individual components
- **Integration tests:** For interactions between components
- **Performance tests:** For speed and resource usage
- **Regression tests:** To ensure existing functionality still works
- **Acceptance criteria:** Clear conditions for "done"

**Example Test Specifications:**
1. Test that new indexes reduce query time by at least 80%
2. Verify index creation doesn't lock tables for more than 30 seconds
3. Confirm rollback procedure removes indexes without data loss
4. Validate monitoring alerts trigger when index usage drops below threshold

## Quick Reference Checklist

When applying CAP, use this checklist:

- [ ] **Step 1:** Listed all concrete actions with specific verbs
- [ ] **Step 2:** Identified all resources each action touches
- [ ] **Step 3:** Identified gaps and mapped data flow (PCC1 resource mapping, CAP flow, gap analysis)
- [ ] **Step 4:** Mapped dependencies between actions (hard/soft/parallel)
- [ ] **Step 5:** Checked integration with existing systems and processes
- [ ] **Step 6:** Validated plan completeness against original goal
- [ ] **Step 7:** Defined test specifications for verification

## Common Pitfalls & Solutions

### Pitfall 1: Skipping Step 3 (Data Flow Mapping)
**Symptom:** Broken data pipelines, missing storage, format mismatches
**Solution:** Always map the data flow end-to-end using PCC1 and CAP flow mapping.

### Pitfall 2: Ignoring Step 5 (Integration)
**Symptom:** Works locally but breaks in production
**Solution:** Test in staging environment that mirrors production.

### Pitfall 3: Vague Step 7 (Test Specifications)
**Symptom:** Can't prove the implementation worked
**Solution:** Define measurable success criteria before starting.

## Examples
See `examples.md` for detailed CAP applications to common scenarios.

## Related Skills & Dependencies
- **RED:** For requirement analysis before planning (`backend/Skills/RED/SKILL.md`)
- **PCC1:** For detailed action-resource-constraint-gap mapping (used in CAP Step 3) (`backend/Skills/PCC1/SKILL.md`)
  - **Usage:** CAP Step 3 invokes PCC1 protocol for systematic gap analysis
  - **Integration:** When applying CAP, automatically consider PCC1 findings

## Changelog
- **v1.0.0 (2026-01-02):** Initial CAP skill definition
  - 7-step protocol with detailed guidelines
  - Examples and common pitfalls
  - Integration with RED and PCC1 skills

---
*Use CAP whenever planning technical work. The 20 minutes spent planning saves 2 hours of debugging.*
