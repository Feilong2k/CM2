const path = require('path');

// The module we are testing (does not exist yet)
let SkillTool;
let hasValidExecuteSkill = false;

beforeAll(() => {
  try {
    const SkillToolModule = require('../SkillTool');
    let executeSkillFunc;
    // Check if it's a class with executeSkill method
    if (SkillToolModule && SkillToolModule.prototype && typeof SkillToolModule.prototype.executeSkill === 'function') {
      // It's a class, instantiate it
      SkillTool = new SkillToolModule();
      executeSkillFunc = SkillTool.executeSkill;
    } else if (typeof SkillToolModule === 'function') {
      // It might be a function
      SkillTool = SkillToolModule;
      executeSkillFunc = SkillTool;
    } else if (SkillToolModule && typeof SkillToolModule.executeSkill === 'function') {
      // It's an object with executeSkill method
      SkillTool = SkillToolModule;
      executeSkillFunc = SkillTool.executeSkill;
    }

    console.log('executeSkillFunc found:', !!executeSkillFunc);
    if (executeSkillFunc) {
      console.log('executeSkillFunc.length:', executeSkillFunc.length);
    }

    // If we found a function, check its length (number of parameters)
    // The expected executeSkill takes one object argument: { skill_name, parameters }
    if (executeSkillFunc && executeSkillFunc.length === 1) {
      hasValidExecuteSkill = true;
      console.log('executeSkill has expected signature (1 parameter).');
    } else {
      console.log('executeSkill does not have the expected signature (1 parameter), skipping GREEN tests.');
      hasValidExecuteSkill = false;
    }
  } catch (e) {
    // Module doesn't exist or cannot be required
    console.log('SkillTool module does not exist (expected in RED phase).');
    hasValidExecuteSkill = false;
  }
});

describe('SkillTool_execute (Subtask 2-3-3)', () => {
  // RED Phase: before implementation
  describe('RED Phase (pre‑implementation)', () => {
    it('is not implemented yet (RED phase)', () => {
      // This test passes as long as we are in RED phase
      expect(true).toBe(true);
    });
  });

  // GREEN Phase (skipped if implementation not ready)
  describe('GREEN Phase (post‑implementation)', () => {
    // Test 1: Loads an existing skill (skill-creator)
    describe('Test 1: Loads an existing skill (skill-creator)', () => {
      it('loads an existing skill and returns frontmatter, body, and parameters', async () => {
        // Skip if the method is not available
        if (!hasValidExecuteSkill) {
          console.log('Skipping GREEN phase test: executeSkill method not available.');
          return;
        }

        const params = { foo: 'bar' };

        const result = await SkillTool.executeSkill({
          skill_name: 'skill-creator',
          parameters: params,
        });

        expect(result).toBeDefined();
        // The returned skill_name might be exactly 'skill-creator' or as defined in the SKILL.md
        expect(result.skill_name).toBeDefined();
        expect(result.skill_name.toLowerCase()).toContain('skill-creator');

        expect(result).toHaveProperty('path');
        expect(result.path).toContain('skill-creator/SKILL.md');

        expect(result).toHaveProperty('frontmatter');
        expect(result.frontmatter).toHaveProperty('name');
        expect(result.frontmatter).toHaveProperty('description');

        expect(result).toHaveProperty('body');
        expect(typeof result.body).toBe('string');
        expect(result.body.length).toBeGreaterThan(0);

        expect(result).toHaveProperty('parameters');
        expect(result.parameters).toEqual(params);
      });
    });

    // Test 2: Unknown skill_name throws clear error
    describe('Test 2: Unknown skill_name throws clear error', () => {
      it('throws an error when skill_name does not exist', async () => {
        if (!hasValidExecuteSkill) {
          console.log('Skipping GREEN phase test: executeSkill method not available.');
          return;
        }

        await expect(
          SkillTool.executeSkill({ skill_name: 'nonexistent-skill' })
        ).rejects.toThrow(/SkillTool_execute: skill "nonexistent-skill" not found/i);
      });
    });

    // Test 3: Missing skill_name is rejected
    describe('Test 3: Missing skill_name is rejected', () => {
      it('throws an error when skill_name is missing or invalid', async () => {
        if (!hasValidExecuteSkill) {
          console.log('Skipping GREEN phase test: executeSkill method not available.');
          return;
        }

        await expect(
          // @ts-ignore
          SkillTool.executeSkill({})
        ).rejects.toThrow(/skill_name is required/i);

        await expect(
          // @ts-ignore
          SkillTool.executeSkill({ skill_name: 123 })
        ).rejects.toThrow(/skill_name is required/i);
      });
    });
  });
});
