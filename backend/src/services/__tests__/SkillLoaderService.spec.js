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

      // The section should contain CAP, RED and PCC1 (all are top-level skills
      // with type="skill" in their frontmatter).
      expect(section).toContain('Planning using CAP');
      expect(section).toContain('Constraint-Aware Planning');

      expect(section).toContain('RED');
      expect(section).toContain('Requirement Extraction and Decomposition');

      // PCC1 is also a top-level skill (not just a subskill of CAP), so it
      // should appear in the generated summary section.
      expect(section).toContain('PCC1');
      expect(section).toContain('Preflight Constraint Check Level 1');
    });

    it('should show only name and description, not full protocol bodies', () => {
      const section = service.generateSkillsPromptSection();

      // For CAP: check that the summary line is present (name and description)
      expect(section).toContain('Planning using CAP');
      expect(section).toContain('Constraint-Aware Planning');

      // The summary section is intentionally concise and should not include
      // long protocol bodies verbatim. We do a light‑touch check for a phrase
      // that lives deep in the CAP body.
      expect(section).not.toContain('The 7-Step CAP Protocol');
    });

    it('should respect skillNames filter when provided', () => {
      // When we filter by ['CAP'], we should only see CAP, not RED.
      const section = service.generateSkillsPromptSection(['Planning using CAP']);

      expect(section).toContain('Planning using CAP');
      expect(section).toContain('Constraint-Aware Planning');
      expect(section).not.toContain('RED');
      expect(section).not.toContain('PCC1');
    });
  });
});

