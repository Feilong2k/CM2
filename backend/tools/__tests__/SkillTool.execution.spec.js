/**
 * SkillTool Execution Engine Tests (Subtask 2-3-5)
 *
 * These tests define the contract for skill execution.
 * The execution engine should:
 * 1. Execute skill instructions (markdown body)
 * 2. Provide parameters as context
 * 3. Return structured execution results
 *
 * Design Decisions:
 * - Execution trigger: Use `execute: true` flag in executeSkill() to trigger execution
 * - Backward compatibility: execute=false or omitted behaves like current implementation (load only)
 * - Parameter validation: Required params checked before execution
 * - Default values: Optional params get defaults from skill definition
 * - MVP execution: For MVP, "execution" means returning a structured result with params applied
 *   (not interpreting markdown as code)
 */

const { executeSkill } = require('../SkillTool');

describe('SkillTool Execution Engine (Subtask 2-3-5)', () => {
  // Test 1: Execute skill returns structured result
  describe('Test 1: Execute skill returns structured result', () => {
    it('should execute a skill and return execution results', async () => {
      const result = await executeSkill({
        skill_name: 'example-skill',
        parameters: { greeting: 'Hello', count: 3 },
        execute: true, // New flag to trigger execution vs just loading
      });

      expect(result.executed).toBe(true);
      expect(result.skill_name).toBe('example-skill');
      expect(result.execution_result).toBeDefined();
      expect(result.execution_result.success).toBe(true);
    });
  });

  // Test 2: Parameters are accessible during execution
  describe('Test 2: Parameters are accessible during execution', () => {
    it('should provide parameters as context during execution', async () => {
      const result = await executeSkill({
        skill_name: 'example-skill',
        parameters: { greeting: 'Test', count: 2 },
        execute: true,
      });

      // The execution result should reflect the parameters used
      expect(result.execution_result.parameters_received).toEqual({
        greeting: 'Test',
        count: 2,
      });
    });
  });

  // Test 3: Missing required parameters rejected
  describe('Test 3: Missing required parameters rejected', () => {
    it('should reject execution when required parameters are missing', async () => {
      // greeting is required but not provided
      await expect(
        executeSkill({
          skill_name: 'example-skill',
          parameters: { count: 2 }, // missing 'greeting'
          execute: true,
        })
      ).rejects.toThrow(/required parameter.*greeting/i);
    });
  });

  // Test 4: Default parameters applied
  describe('Test 4: Default parameters applied', () => {
    it('should apply default values for optional parameters', async () => {
      const result = await executeSkill({
        skill_name: 'example-skill',
        parameters: { greeting: 'Hello' }, // count not provided, default is 1
        execute: true,
      });

      expect(result.execution_result.parameters_received.count).toBe(1);
    });
  });

  // Test 5: Execute flag false returns definition only (backward compat)
  describe('Test 5: Backward compatibility - execute=false', () => {
    it('should return skill definition without executing when execute=false', async () => {
      const result = await executeSkill({
        skill_name: 'example-skill',
        parameters: { greeting: 'Hello' },
        execute: false,
      });

      // Should behave like current implementation
      expect(result.executed).toBeFalsy();
      expect(result.body).toBeDefined();
      expect(result.frontmatter).toBeDefined();
      expect(result.execution_result).toBeUndefined();
    });
  });

  // Test 6: Execution includes skill body/instructions
  describe('Test 6: Execution includes skill instructions', () => {
    it('should include parsed skill instructions in execution context', async () => {
      const result = await executeSkill({
        skill_name: 'example-skill',
        parameters: { greeting: 'Hello' },
        execute: true,
      });

      // Execution result should indicate what instructions were processed
      expect(result.execution_result.instructions_processed).toBe(true);
      expect(result.body).toContain('# Example Skill');
    });
  });

  // Test 7: Unknown skill still throws error
  describe('Test 7: Unknown skill error unchanged', () => {
    it('should throw error for unknown skill when execute=true', async () => {
      await expect(
        executeSkill({
          skill_name: 'nonexistent-skill',
          parameters: {},
          execute: true,
        })
      ).rejects.toThrow(/not found/i);
    });
  });
});

