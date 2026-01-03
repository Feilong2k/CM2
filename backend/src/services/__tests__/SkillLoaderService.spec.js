const SkillLoaderService = require('../SkillLoaderService');

describe('SkillLoaderService', () => {
  let service;

  beforeEach(() => {
    // Use default base path (backend/Skills)
    service = new SkillLoaderService();
  });

  describe('generateSkillsPromptSection', () => {
    it('should include only top-level skills (type="skill") and exclude Subskill (PCC1)', () => {
      const section = service.generateSkillsPromptSection();

      // The section should contain CAP and RED (top-level skills)
      expect(section).toContain('CAP');
      expect(section).toContain('Constraint-Aware Planning');

      expect(section).toContain('RED');
      expect(section).toContain('Requirement Extraction and Decomposition');

      // It should NOT include PCC1 (a subskill) in the visible list.
      // Note: PCC1 might be mentioned in the body of CAP, but it should not appear as a separate skill entry.
      // We assume that the summary list does not contain a line for PCC1.
      // We'll check that the section does not contain a line that starts with '## PCC1' or similar.
      // But to be safe, we can check that the section does not contain 'PCC1 Skill' (as in the skill header).
      expect(section).not.toContain('## PCC1 Skill');
      // Alternatively, we can check that the section does not contain a line that starts with '**PCC1**' (the summary line).
      expect(section).not.toContain('**PCC1**');
    });

    it('should show only name and description, not full protocol bodies', () => {
      const section = service.generateSkillsPromptSection();

      // For CAP: check that the summary line is present (name and description)
      expect(section).toContain('CAP');
      expect(section).toContain('Constraint-Aware Planning');

      // But the full body (with step-by-step details) should not be in the generated section.
      // The current implementation returns the entire body, so this test will fail until fixed.
      // We check for a phrase that is unique to the full body of CAP and not in the summary.
      expect(section).not.toContain('The 7-Step CAP Protocol');

      // Similarly for RED: we need to know a phrase from its full body.
      // Since we don't have the RED SKILL.md, we can assume it has a similar structure.
      // Let's check that the section does not contain a phrase that is likely in the full body.
      // We'll check for 'The 5-Step RED Protocol' (if that exists) or just a generic 'Step'.
      // Alternatively, we can check that the section does not contain a markdown header for steps.
      // We'll use a more generic check: the section should not contain 'Step 1:' (which is in the body).
      expect(section).not.toContain('Step 1:');
    });

    it('should respect skillNames filter when provided', () => {
      // When we filter by ['CAP'], we should only see CAP, not RED.
      const section = service.generateSkillsPromptSection(['CAP']);

      expect(section).toContain('CAP');
      expect(section).not.toContain('RED');
    });
  });
});
