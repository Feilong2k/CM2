---
name: "RED"
description: "Requirement Extraction and Decomposition skill for analyzing ambiguous or complex requirements and breaking them down into testable, actionable components"
version: "1.0.0"
type: "skill"
decision_triggers:
  - "Analyzing ambiguous or complex requirements that lack clarity"
  - "Breaking down user stories into technical tasks"
  - "Clarifying business rules and acceptance criteria"
  - "Preparing for estimation or planning sessions"
  - "Translating non-technical requests into technical specifications"
dependencies: []
last_updated: "2026-01-02"
---

# RED (Requirement Extraction and Decomposition) Skill

## Overview
**RED** (Requirement Extraction and Decomposition) is a systematic protocol for analyzing ambiguous or complex requirements and breaking them down into testable, actionable components. It transforms vague requests into clear specifications.

## The 5-Step RED Protocol

### Step 1: Extract Core Requirements
**Objective:** Identify the fundamental needs behind the request.

**Techniques:**
- Ask "why" until you reach the root need
- Separate wants from needs
- Identify the primary user and their goal
- Distinguish between functional and non-functional requirements

**Example:**
Request: "We need a dashboard"
Extracted requirements:
1. Primary need: Monitor system health in real-time
2. User: Operations team
3. Goal: Quickly identify and respond to incidents
4. Non-functional: Must update every 30 seconds, support 10+ concurrent users

### Step 2: Decompose into Components
**Objective:** Break down requirements into smaller, manageable parts.

**Decomposition Methods:**
- **Functional decomposition:** By feature or capability
- **Data decomposition:** By data entities and relationships
- **User journey decomposition:** By user steps and interactions
- **Technical decomposition:** By system components and layers

**Example Decomposition:**
"Monitor system health" decomposes to:
1. **Data collection:** Metrics from servers, databases, applications
2. **Data processing:** Aggregation, anomaly detection, trend analysis
3. **Visualization:** Charts, graphs, status indicators
4. **Alerting:** Notifications for threshold breaches
5. **Configuration:** Settings for metrics, thresholds, users

### Step 3: Identify Constraints and Assumptions
**Objective:** Document limitations and underlying assumptions.

**Constraint Categories:**
- **Technical:** Platform limitations, performance requirements
- **Business:** Budget, timeline, resource availability
- **Regulatory:** Compliance requirements (GDPR, HIPAA, etc.)
- **Operational:** Maintenance windows, deployment constraints

**Assumption Categories:**
- **User behavior:** How users will interact with the system
- **Data characteristics:** Volume, velocity, variety of data
- **External dependencies:** Availability of third-party services
- **Future changes:** Anticipated growth or changes

**Example Constraints & Assumptions:**
- Constraint: Must work with existing PostgreSQL database
- Constraint: Dashboard must load in under 3 seconds
- Assumption: Users will access dashboard 10-20 times per day
- Assumption: Metric data will be available via existing monitoring API

### Step 4: Define Acceptance Criteria
**Objective:** Create specific, testable conditions for success.

**Criteria Requirements:**
- **Measurable:** Quantifiable where possible (response time < 2s)
- **Testable:** Can be verified through testing or inspection
- **Clear:** Unambiguous and understandable by all stakeholders
- **Relevant:** Directly related to the requirement

**Example Acceptance Criteria:**
For "real-time system monitoring":
1. Dashboard displays current system status within 30 seconds of data collection
2. Users can filter by server, time range, and metric type
3. System alerts trigger within 60 seconds of threshold breach
4. Dashboard supports 10 concurrent users without performance degradation
5. All data visualizations include timestamps and data source identifiers

### Step 5: Validate Decomposition
**Objective:** Ensure the decomposed requirements fully address the original need.

**Validation Questions:**
- Does this decomposition cover all aspects of the original requirement?
- Are there any gaps or missing components?
- Do the acceptance criteria align with business goals?
- Can each component be independently developed and tested?
- Are dependencies between components clearly identified?

**Example Validation:**
Original: "We need a dashboard"
Validation: Decomposition includes data collection, processing, visualization, alerting, and configuration - covering all aspects of a complete monitoring dashboard.

## Quick Reference Checklist

When applying RED, use this checklist:

- [ ] **Step 1:** Extracted core requirements (needs vs wants, user, goal)
- [ ] **Step 2:** Decomposed into manageable components (functional, data, technical)
- [ ] **Step 3:** Identified constraints (technical, business, regulatory) and assumptions
- [ ] **Step 4:** Defined acceptance criteria (measurable, testable, clear)
- [ ] **Step 5:** Validated decomposition covers original requirement

## Common Pitfalls & Solutions

### Pitfall 1: Jumping to Solutions in Step 1
**Symptom:** Defining how before understanding what
**Solution:** Focus on the problem, not the solution. Ask "what problem are we solving?" not "how should we build it?"

### Pitfall 2: Over-decomposition in Step 2
**Symptom:** Creating hundreds of tiny tasks that lose context
**Solution:** Decompose to the level where components are independently testable, but still meaningful.

### Pitfall 3: Vague Acceptance Criteria in Step 4
**Symptom:** "It works" or "user is happy" as criteria
**Solution:** Use the SMART framework: Specific, Measurable, Achievable, Relevant, Time-bound.

### Pitfall 4: Ignoring Constraints in Step 3
**Symptom:** Beautiful design that violates compliance requirements
**Solution:** Document constraints early and validate against them throughout.

## Examples
See `examples.md` for detailed RED applications to common scenarios.

## Related Skills
- **CAP:** For planning implementation of decomposed requirements
- **PCC1:** For checking protocol compliance of resulting implementations

## Changelog
- **v1.0.0 (2026-01-02):** Initial RED skill definition
  - 5-step protocol for requirement analysis
  - Techniques for decomposition and validation
  - Common pitfalls and solutions

---
*Use RED to turn vague requests into clear specifications. Good decomposition prevents rework and ensures alignment.*
