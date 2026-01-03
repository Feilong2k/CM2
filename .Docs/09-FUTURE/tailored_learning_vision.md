# Tailored Learning Vision: Project-Based, Skill-Guided Education

## Core Belief

I strongly believe that **tailored learning** is the best way to bring out a human's full potential. The goal is not just to dump knowledge, but to:

- Match the **way we teach** to how a specific person thinks and works
- Use **projects** instead of abstract theory as the primary learning vehicle
- Make progress **measurable**, so both human and AI can see growth over time
- Continuously adapt the plan using the same skills and probes we use for software work (PCC, CAP, RED, etc.)

## High-Level Concept

In the future, Orion (or similar agents) should be able to:

1. **Model the learner**
   - Maintain a lightweight **User Interaction Profile** per person/project capturing:
     - Preferred planning depth vs. speed
     - Tolerance for ambiguity vs. desire for explicit checklists
     - Communication style (high-level vs. low-level, exploratory vs. decisive)
   - Use this as **context**, just like a skill, so teaching style is personalized.

2. **Define learning as projects, not chapters**
   - Example goals:
     - "Go from 0 → understanding modern AI model types and how to use them"
     - "Learn how continuous-thought / CTM-style models operate and can be applied"
     - "Acquire the math needed to understand or adapt new AI architectures"
   - For each goal, design a **sequence of concrete projects**, e.g.:
     - Train a simple classifier
     - Fine-tune a small transformer
     - Build a toy diffusion sampler
     - Re-implement attention math in a notebook

3. **Use PCC / CAP / RED on the learning plan itself**
   - **RED** (Requirements / Expectations Definition):
     - Clarify what "knowing AI models" means for *this* learner (use vs. build vs. research).
     - Surface constraints (time, math background, coding comfort).
   - **CAP** (Constraint-Aware Planning) on the curriculum:
     - Step 1: List concrete learning projects
     - Step 2: Identify resources (courses, papers, repos, notebooks)
     - Steps 3–7: Find gaps, map dependencies, integrate with real work, define validation.
   - **PCC1** (Preflight Constraint Check) on each project:
     - Ensure actions, resources, constraints, and gaps are explicitly identified before starting.

4. **Make progress measurable**
   - Define clear, observable signals per project:
     - Math: can solve a class of problems within accuracy/time thresholds
     - Models: can implement/use a model from scratch or adapt an existing one
     - Language: can write/speak on a topic with bounded error rates
   - Log these as **performance data** (per topic, per difficulty level) so the AI can:
     - Decide what to revisit
     - When to increase difficulty
     - When to introduce new concepts

5. **Iterate the teaching loop**
   - Present a chunk → learner attempts → system evaluates → adapt next chunk
   - Use the same self-improving loop as with skills:
     - Create a mini-skill/plan for the learner
     - Test it (via exercises/projects)
     - Save successful patterns
     - Retrieve and refine them for future learning goals

## Why This Matters

This vision extends the "Self-Improving AI Platform" idea from *technical capabilities* to **human learning and growth**:

- Orion doesn’t just become a better coder or planner; it becomes a better **teacher and teammate**.
- Learning paths are:
  - **Personalized** to how the person thinks and works
  - **Project-based**, grounded in real, meaningful tasks
  - **Measured**, so improvement is visible and compounding

In this model, every serious learning goal (math, language, AI models, architecture, etc.) becomes a **first-class project** with:
- A skill-guided curriculum
- Clear milestones
- Feedback loops
- And a personal interaction style that makes it easier to remember, understand, and apply.

This is the long-term direction: a platform where AI doesn’t just perform tasks, but also continuously **builds up the humans** it works with by teaching in the way that fits them best.

