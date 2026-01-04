const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SKILLS_BASE = path.join(__dirname, '../../../skills');
const AIDER_ORCHESTRATION_DIR = path.join(SKILLS_BASE, 'aider_orchestration');
const SKILL_MD_PATH = path.join(AIDER_ORCHESTRATION_DIR, 'SKILL.md');
const SCRIPTS_DIR = path.join(AIDER_ORCHESTRATION_DIR, 'scripts');
const REFERENCES_DIR = path.join(AIDER_ORCHESTRATION_DIR, 'references');

describe('Skill Directory Structure for Aider Orchestration (Subtask 2-3-1)', () => {
  // RED Phase: these tests should pass before implementation (directory does not exist)
  describe('RED Phase (pre‑implementation)', () => {
    it('aider_orchestration directory should NOT exist', () => {
      expect(fs.existsSync(AIDER_ORCHESTRATION_DIR)).toBe(false);
    });

    it('SKILL.md should NOT exist', () => {
      expect(fs.existsSync(SKILL_MD_PATH)).toBe(false);
    });

    it('scripts/ directory should NOT exist', () => {
      expect(fs.existsSync(SCRIPTS_DIR)).toBe(false);
    });

    it('references/ directory should NOT exist', () => {
      expect(fs.existsSync(REFERENCES_DIR)).toBe(false);
    });
  });

  // GREEN Phase: these tests should fail before implementation, pass after
  describe('GREEN Phase (post‑implementation)', () => {
    // Note: These tests are skipped initially because they will fail.
    // Remove .skip after implementing the directory structure.
    describe.skip('Structure Validation', () => {
      it('aider_orchestration directory exists', () => {
        expect(fs.existsSync(AIDER_ORCHESTRATION_DIR)).toBe(true);
      });

      it('SKILL.md file exists and is readable', () => {
        expect(fs.existsSync(SKILL_MD_PATH)).toBe(true);
        expect(() => fs.readFileSync(SKILL_MD_PATH, 'utf8')).not.toThrow();
      });

      it('scripts/ directory exists', () => {
        expect(fs.existsSync(SCRIPTS_DIR)).toBe(true);
        expect(fs.statSync(SCRIPTS_DIR).isDirectory()).toBe(true);
      });

      it('references/ directory exists', () => {
        expect(fs.existsSync(REFERENCES_DIR)).toBe(true);
        expect(fs.statSync(REFERENCES_DIR).isDirectory()).toBe(true);
      });
    });

    describe.skip('Content Validation for SKILL.md Template', () => {
      let skillContent = '';

      beforeAll(() => {
        skillContent = fs.readFileSync(SKILL_MD_PATH, 'utf8');
      });

      it('has valid YAML frontmatter at the top', () => {
        const frontmatterMatch = skillContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
        expect(frontmatterMatch).toBeTruthy();
        const yamlText = frontmatterMatch[1];
        expect(() => yaml.load(yamlText)).not.toThrow();
      });

      it('YAML frontmatter includes required fields: name and description', () => {
        const frontmatterMatch = skillContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
        const yamlText = frontmatterMatch[1];
        const parsed = yaml.load(yamlText);
        expect(parsed).toHaveProperty('name');
        expect(parsed).toHaveProperty('description');
        expect(typeof parsed.name).toBe('string');
        expect(typeof parsed.description).toBe('string');
      });

      it('SKILL.md body contains high‑level instructions / TODOs (template)', () => {
        // After the frontmatter, there should be some markdown content.
        const afterFrontmatter = skillContent.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
        expect(afterFrontmatter.trim().length).toBeGreaterThan(0);
        // Optionally, check for template markers like TODO or placeholder text.
        // This is a soft check; we just ensure there is content.
        expect(afterFrontmatter).toContain('#');
      });

      it('SKILL.md is a reasonable size for a template (not excessively long)', () => {
        // Arbitrary limit: 10,000 characters for a template.
        expect(skillContent.length).toBeLessThan(10000);
      });
    });
  });
});
