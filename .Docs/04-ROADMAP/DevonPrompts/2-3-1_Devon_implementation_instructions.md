# Devon Implementation Instructions: Subtask 2-3-1

## Goal
Adopt `backend/Skills/skill-creator/` (Anthropic Skill Creator) as the canonical skill directory and reference structure for the Skills Framework.

## Current State (RED Phase)
- ✅ Tara's tests for 2-3-1 exist (pointing at `backend/Skills/skill-creator/`)
- ❌ In a fresh clone (before pulling in the Anthropics repo), `backend/Skills/skill-creator/` may not exist

## Implementation Steps

### 1. Ensure skill-creator directory is present

1. Confirm that the Anthropics `skills` repo (or the relevant subset) has been pulled in and copied so that the following structure exists:

```text
backend/Skills/skill-creator/
├── SKILL.md
├── scripts/
└── references/
```

2. If the directory is missing, follow the documented process to:
   - Clone the Anthropics `skills` repo,
   - Checkout the agreed commit,
   - Copy `skills/skill-creator/` into `backend/Skills/skill-creator/`.

### 2. Verify SKILL.md frontmatter

1. Open `backend/Skills/skill-creator/SKILL.md`.
2. Verify that the YAML frontmatter at the top:
   - Parses as valid YAML (no syntax errors),
   - Includes at least the fields:
     - `name`
     - `description`.
3. Do **not** change the content unless absolutely necessary; this is a reference skill from Anthropics and should remain as intact as possible.

### 3. Verify scripts/ and references/ structure

1. Confirm that `backend/Skills/skill-creator/scripts/` exists and contains the expected helper scripts (e.g., `init_skill.py`, `package_skill.py`, `quick_validate.py`).
2. Confirm that `backend/Skills/skill-creator/references/` exists and contains reference docs (e.g., `workflows.md`, `output-patterns.md`).
3. Ensure this structure matches the progressive disclosure pattern:
   - SKILL.md is the high-level entry point.
   - `scripts/` holds reusable automation.
   - `references/` holds detailed documentation.

## Validation Criteria

After implementation/verification, ensure:
- ✅ `backend/Skills/skill-creator/` exists with `SKILL.md`, `scripts/`, and `references/`.
- ✅ `SKILL.md` has valid YAML frontmatter with at least `name` and `description`.
- ✅ `scripts/` and `references/` directories are present and consistent with the skill-creator design.

These criteria correspond directly to the acceptance criteria in the v5 spec for 2-3-1.

## Quality Requirements (Optional)

- **YAML:** No syntax errors; frontmatter clearly documents the skill's purpose.
- **Markdown:** SKILL.md content is readable and structured (headings, lists, etc.).
- **Structure:** Directory layout matches upstream Anthropics `skill-creator` layout.

These are recommended checks but should not block 2-3-1 if the basic structure and frontmatter are intact.

## After Implementation

1. Confirm Tara's 2-3-1 tests pass (see `.Docs/04-ROADMAP/TaraPrompts/2-3-1_Tara_TDD_test_instructions.md`).
2. Communicate to Adam/Orion that `backend/Skills/skill-creator/` is the canonical reference skill for the Skills Framework.
3. Proceed to 2-3-2 (SkillLoader) using this directory as the primary test target.

## Success Metrics

- Tara's 2-3-1 tests pass (RED → GREEN transition according to the updated plan).
- `backend/Skills/skill-creator/` is present and treated as the canonical skill directory.
- SkillLoader tasks (2-3-2) can safely assume this structure for initial integration tests.
