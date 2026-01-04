# TDD Test Instructions for 2-3-1: Design Skill Directory Structure

This test plan is scoped to the acceptance criteria for **Subtask 2-3-1** in `Feature2_Skills_Aider_Integration_v5.md`:

> Adopt `backend/Skills/skill-creator/` (Anthropic Skill Creator) as the canonical skill directory and reference structure for the Skills Framework (SKILL.md + `/scripts` + `/references`).

## RED Phase (Tests that should FAIL before implementation)

### Structure Tests (FAIL):
- `backend/Skills/skill-creator/` directory should NOT exist (in a fresh clone before pulling in the Anthropics repo)

### Content Tests (FAIL):
- Attempting to read `backend/Skills/skill-creator/SKILL.md` should fail (file missing)

> These RED tests confirm we are truly in a pre‑implementation state.

## GREEN Phase (Tests that should PASS after implementation)

### Structure Validation (PASS):
- ✅ `backend/Skills/skill-creator/` exists
- ✅ `backend/Skills/skill-creator/SKILL.md` file exists and is readable
- ✅ `backend/Skills/skill-creator/scripts/` directory exists
- ✅ `backend/Skills/skill-creator/references/` directory exists

### Content Validation for SKILL.md Template (PASS):
- ✅ `backend/Skills/skill-creator/SKILL.md` has valid YAML frontmatter at the top (parseable as YAML)
- ✅ Frontmatter includes at least the fields:
  - `name`
  - `description`
- ✅ SKILL.md body contains high‑level instructions / TODOs consistent with a **skill-creation/meta-skill template** (not a project-specific feature)
- ✅ SKILL.md is reasonably sized for a template (e.g., not excessively long; can optionally assert a soft limit if desired)

> These GREEN tests correspond directly to the acceptance criteria: directory structure + example SKILL.md template.

## REFACTOR Phase (Optional Quality Checks)

These checks go beyond the bare acceptance criteria for 2‑3‑1 and are NICE‑TO‑HAVE for quality and future work.

### Template Quality (Optional):
- ✅ YAML frontmatter follows clear, documented conventions (e.g., short `name`, descriptive `description`)
- ✅ Markdown formatting is clean and consistent
- ✅ Template includes guidance or TODO markers for where to add scripts/references

### Structure & Future Integration (Optional):
- ✅ Clear separation: SKILL.md (high‑level entry point) vs `references/` (detailed docs)
- ✅ `scripts/` directory populated with helper scripts consistent with the skill-creator design

> These REFACTOR checks should **not block** 2‑3‑1 if they fail, but they can inform improvements or feed into later subtasks (2‑3‑2 SkillLoader, 2‑3‑5 execution engine).

## Test Execution Order

1. **RED tests** → All should FAIL (pre‑implementation)
2. **Implementation** → Create `backend/skills/aider_orchestration/` structure + SKILL.md template per spec
3. **GREEN tests** → All should PASS (post‑implementation)
4. **Refactor (optional)** → Improve template/structure quality based on REFACTOR checks
5. **Re‑run all** → Ensure no regressions

## Test Tools

- **Automated:** Directory existence checks, file read, YAML parsing
- **Manual:** Content review to confirm SKILL.md looks like a template (high‑level, not project‑specific)

## Success Criteria

- All RED tests fail initially
- All GREEN tests pass after implementation
- 2‑3‑1 acceptance criteria met:
  - Directory structure exists and follows convention
  - Example SKILL.md file is present and usable as a template
- REFACTOR checks can be used to suggest improvements but do not block completion of 2‑3‑1
