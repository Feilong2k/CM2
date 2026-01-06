const path = require('path');
const SkillLoader = require('../SkillLoader');

/**
 * Design Decision: Parameters Validation
 * 
 * Based on real skills in the system (like skill-creator), parameters appear to be optional.
 * The test should verify:
 * - Skills load successfully without parameters field
 * - If parameters is present, it should be validated as an object
 * - Invalid parameters types should trigger a warning but may still load (with parameters set to null/undefined)
 * 
 * However, note that the current SkillLoader does not validate parameters at all.
 * It only validates name and description. This test suite will define the expected behavior
 * for parameters validation, and initially fail (RED) until Devon implements the validation.
 */

describe('SkillLoader Validation (Subtask 2-3-4)', () => {
  const validationFixturesRoot = path.join(__dirname, 'fixtures', 'validation');

  // Helper to get the fixture path for a given scenario
  const getFixturePath = (scenario) => path.join(validationFixturesRoot, scenario, 'SKILL.md');

  // Test 1: Valid skill with all fields loads successfully
  describe('Test 1: Valid skill with all fields', () => {
    it('should load skill with name, description, and parameters', async () => {
      const validWithParamsRoot = path.join(validationFixturesRoot, 'valid-with-params');
      const skillLoader = new SkillLoader(validWithParamsRoot);
      const metadata = await skillLoader.loadSkillMetadata();

      expect(metadata).toHaveLength(1);
      const skill = metadata[0];
      expect(skill.name).toBe('test-skill-with-params');
      expect(skill.description).toBe('A test skill with parameters');
      expect(skill.frontmatter.parameters).toEqual({
        input_file: { type: 'string', required: true },
        output_format: { type: 'string', default: 'json' }
      });
    });
  });

  // Test 2: Skill without parameters is still valid (parameters optional)
  describe('Test 2: Skill without parameters', () => {
    it('should load skill without parameters field (optional)', async () => {
      const validNoParamsRoot = path.join(validationFixturesRoot, 'valid-no-params');
      const skillLoader = new SkillLoader(validNoParamsRoot);
      const metadata = await skillLoader.loadSkillMetadata();

      expect(metadata).toHaveLength(1);
      const skill = metadata[0];
      expect(skill.name).toBe('test-skill-no-params');
      expect(skill.description).toBe('A test skill without parameters');
      // parameters field may be undefined or missing in frontmatter
      // We just ensure the skill is loaded
    });
  });

  // Test 3: Skill missing name is skipped with warning
  describe('Test 3: Skill missing name', () => {
    it('should skip skill missing name field and log warning', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const missingNameRoot = path.join(validationFixturesRoot, 'missing-name');
      const skillLoader = new SkillLoader(missingNameRoot);
      const metadata = await skillLoader.loadSkillMetadata();

      // The skill with missing name should not be in metadata
      expect(metadata).toHaveLength(0);

      // Verify that a warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing or invalid name/description')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing-name')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  // Test 4: Skill missing description is skipped with warning
  describe('Test 4: Skill missing description', () => {
    it('should skip skill missing description field and log warning', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const missingDescriptionRoot = path.join(validationFixturesRoot, 'missing-description');
      const skillLoader = new SkillLoader(missingDescriptionRoot);
      const metadata = await skillLoader.loadSkillMetadata();

      // The skill with missing description should not be in metadata
      expect(metadata).toHaveLength(0);

      // Verify that a warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing or invalid name/description')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing-description')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  // Test 5: Invalid parameters type is handled gracefully
  describe('Test 5: Invalid parameters type', () => {
    it('should handle invalid parameters type gracefully', async () => {
      // Expected behavior after validation is implemented:
      // - Skill should still be loaded (name and description are valid)
      // - A warning should be logged for invalid parameters
      // - The parameters field should be set to null (or undefined)
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const invalidParamsRoot = path.join(validationFixturesRoot, 'invalid-params-type');
      const skillLoader = new SkillLoader(invalidParamsRoot);
      const metadata = await skillLoader.loadSkillMetadata();

      // The skill should be loaded because name and description are valid
      expect(metadata).toHaveLength(1);
      const skill = metadata[0];
      expect(skill.name).toBe('invalid-params-skill');
      // After validation is implemented, we expect a warning about invalid parameters
      // Check that there is a warning for this specific skill
      const invalidParamsWarning = consoleWarnSpy.mock.calls.find(call =>
        call[0].includes('invalid-params-type') && call[0].includes('invalid parameters')
      );
      expect(invalidParamsWarning).toBeDefined();
      // After validation is implemented, parameters should be set to null
      expect(skill.frontmatter.parameters).toBeNull();

      consoleWarnSpy.mockRestore();
    });
  });

  // Test 6: Empty frontmatter is skipped
  describe('Test 6: Empty frontmatter', () => {
    it('should skip skill with empty frontmatter', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const emptyFrontmatterRoot = path.join(validationFixturesRoot, 'empty-frontmatter');
      const skillLoader = new SkillLoader(emptyFrontmatterRoot);
      const metadata = await skillLoader.loadSkillMetadata();

      // The skill with empty frontmatter should not be in metadata
      expect(metadata).toHaveLength(0);

      // Verify that a warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('no valid frontmatter')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('empty-frontmatter')
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
