---
name: TRUE_DONE
description: Enforce "True Done" protocol - task not done until intended user can use it for intended purpose. Use when marking any task/subtask as completed, reviewing task completion, or accepting deliverables from Devon/Tara. This skill ensures that "done" means actually usable by the intended user for the intended purpose, not just checklist completion.
---

# TRUE_DONE Skill

## The Problem
LLMs often mark tasks as "done" when:
1. All checklist items are ticked
2. Code compiles without errors  
3. Tests pass
4. Documentation written

But the REAL definition of done is:
1. **Intended user** can actually use it
2. For the **intended purpose**
3. With the **intended effect**
4. In the **real context**

## The "True Done" Protocol

A task is ONLY truly done when ALL of these are true:

### 1. Component Works (Basic)
- Code compiles/builds without errors
- Unit tests pass
- Code follows standards/patterns

### 2. Integration Works (Critical)
- Works with other components/systems
- API contracts are satisfied
- Data flows correctly end-to-end
- No breaking changes to existing functionality

### 3. User Can Use It (Essential)
- **Intended user** (e.g., Orion, human, other system) can actually use it
- User interface/API is intuitive and functional
- Documentation/examples exist for real usage
- Error messages are helpful

### 4. Purpose Achieved (Ultimate)
- Achieves the **intended purpose** of the task
- Solves the **actual problem** it was meant to solve
- Delivers **real value** to the user/system

### 5. Context Valid (Real-world)
- Works in **real context**, not just test environment
- Handles edge cases from actual usage
- Performance is acceptable in production context
- Security considerations addressed

## How to Apply TRUE_DONE

### Step 1: Identify the "True User"
Who is the ACTUAL intended user?
- Orion (the orchestrator)?
- Another system/component?
- Human user?
- Some combination?

### Step 2: Define "True Purpose"
What is the ACTUAL intended purpose?
- Not just "build database tool"
- But "enable Orion to migrate databases safely"
- Or "allow users to search knowledge base effectively"

### Step 3: Verify Each Layer

#### Layer 1: Technical Correctness
```yaml
Check:
  - Code compiles: ✓
  - Tests pass: ✓  
  - No lint errors: ✓
  - Follows patterns: ✓
```

#### Layer 2: Integration
```yaml
Check:
  - Connects to dependencies: ✓
  - API contracts satisfied: ✓
  - Data flows correctly: ✓
  - No breaking changes: ✓
```

#### Layer 3: Usability
```yaml
Check:
  - Intended user can use it: ✓
  - Interface is intuitive: ✓
  - Documentation exists: ✓
  - Error handling helpful: ✓
```

#### Layer 4: Purpose Achievement
```yaml
Check:
  - Solves actual problem: ✓
  - Delivers intended value: ✓
  - Meets success criteria: ✓
```

#### Layer 5: Real-world Context
```yaml
Check:
  - Works in production context: ✓
  - Handles edge cases: ✓
  - Performance acceptable: ✓
  - Security addressed: ✓
```

### Step 4: Calculate TRUE_DONE Score

Score each layer (0-20 points):
1. Technical Correctness: __/20
2. Integration: __/20  
3. Usability: __/20
4. Purpose Achievement: __/20
5. Real-world Context: __/20

**Total: __/100**

### Scoring Guidelines:
- 90-100: Truly done (all layers satisfied)
- 70-89: Mostly done (minor usability/integration issues)
- 50-69: Partially done (significant issues in 1-2 layers)
- <50: Not done (fundamental issues)

### Step 5: Provide Actionable Feedback

For each layer scoring <15:
- Identify specific missing elements
- Provide concrete verification steps
- Suggest fixes/improvements

## Examples

### Example 1: Database Migration Tool

**LLM "Done":**
- Tool built ✓
- Tests pass ✓  
- Documentation written ✓
→ "Done!" (but Orion can't actually use it)

**TRUE_DONE Analysis:**
- Layer 1: 20/20 (code works)
- Layer 2: 5/20 (not integrated with Orion's workflow)
- Layer 3: 0/20 (Orion can't use it)
- Layer 4: 0/20 (doesn't solve Orion's migration needs)
- Layer 5: 10/20 (works in isolation)
- **Total: 35/100 → NOT DONE**

**Missing:**
- Integration with Orion's tool system
- Orion-usable interface/API
- Actual migration capability for Orion

### Example 2: WritePlanTool (Good Example)

**TRUE_DONE Analysis:**
- Layer 1: 20/20 (code works)
- Layer 2: 18/20 (well integrated with system)
- Layer 3: 20/20 (Orion can actually use it)
- Layer 4: 20/20 (solves safe file writing problem)
- Layer 5: 18/20 (works in real context, minor edge cases)
- **Total: 96/100 → TRULY DONE**

## Common Failure Patterns

### Pattern 1: "Checklist Completion"
Task marked done when checklist complete, but user can't actually use it.

**Solution:** Always test with actual intended user.

### Pattern 2: "Integration Later"  
Component built but integration deferred.

**Solution:** Integration is PART of "done" - not separate.

### Pattern 3: "Test Environment Only"
Works in tests but not real context.

**Solution:** Test in production-like context.

### Pattern 4: "Documentation Over Substance"
Beautiful docs but broken functionality.

**Solution:** Functionality first, documentation second.

## Verification Checklist

### For EVERY task/subtask completion:

#### ✅ Technical (Layer 1)
- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] Code follows established patterns
- [ ] No obvious bugs in basic functionality

#### ✅ Integration (Layer 2)  
- [ ] Works with dependent components
- [ ] API contracts satisfied
- [ ] Data flows correctly end-to-end
- [ ] No breaking changes to existing systems

#### ✅ Usability (Layer 3)
- [ ] **Intended user can actually use it** (TEST THIS!)
- [ ] Interface/API is intuitive
- [ ] Error messages are helpful
- [ ] Basic documentation/examples exist

#### ✅ Purpose (Layer 4)
- [ ] Solves the actual problem statement
- [ ] Delivers intended value
- [ ] Meets all success criteria
- [ ] User would say "this works for me"

#### ✅ Context (Layer 5)
- [ ] Works in realistic usage context
- [ ] Handles common edge cases
- [ ] Performance acceptable for use case
- [ ] Security considerations addressed

## Implementation in Workflow

### In TDD Cycle:
1. **Red (Tara):** Write tests for TRUE_DONE criteria
2. **Green (Devon):** Implement to satisfy TRUE_DONE
3. **Refactor (Devon):** Improve TRUE_DONE aspects
4. **Review (Tara):** Verify TRUE_DONE is achieved
5. **Orion Review:** Final TRUE_DONE validation

### In Database Status Updates:
When marking subtask as `completed`:
- Run TRUE_DONE analysis
- Include TRUE_DONE score in review section
- Only mark as `completed` if score ≥ 90

## The Core Principle

**"Done" = "The intended user can use it for the intended purpose"**

Anything less is **NOT DONE**.

## Quick Reference

### When to Use This Skill:
- Marking any task/subtask as completed
- Reviewing deliverables from Devon/Tara  
- Accepting work as "done"
- Planning integration/testing strategies

### Questions to Always Ask:
1. "Who is the INTENDED user?"
2. "What is the INTENDED purpose?"
3. "Can the intended user ACTUALLY use it for that purpose?"
4. "Does it work in the REAL context?"

### Red Flags:
- "Integration can be done later"
- "The user just needs to..." (but they can't)
- "It works in tests" (but not real usage)
- "Documentation explains how to use it" (but it's broken)

## Remember

**TRUE_DONE is not perfection.**  
It's **actual usability** by the **intended user** for the **intended purpose**.

A 90% TRUE_DONE score with real usability is better than 100% checklist completion with zero usability.

