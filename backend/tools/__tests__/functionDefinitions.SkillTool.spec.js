const functionDefinitions = require('../functionDefinitions');

describe('functionDefinitions (SkillTool integration)', () => {
  // Check that SkillTool_execute is registered
  describe('SkillTool_execute registration', () => {
    it('registers SkillTool_execute with correct schema', () => {
      const def = functionDefinitions.find(d => d.function && d.function.name === 'SkillTool_execute');
      // If not found, this test will fail (RED phase)
      expect(def).toBeDefined();
      expect(def.function.parameters).toBeDefined();
      expect(def.function.parameters.properties).toHaveProperty('skill_name');
      expect(def.function.parameters.properties).toHaveProperty('parameters');
    });

    it('has required skill_name parameter', () => {
      const def = functionDefinitions.find(d => d.function && d.function.name === 'SkillTool_execute');
      if (!def) {
        // If the definition is not found, skip the rest of the test
        console.log('SkillTool_execute not found in functionDefinitions, skipping.');
        return;
      }
      expect(def.function.parameters.required).toContain('skill_name');
    });
  });
});
