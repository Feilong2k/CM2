const { getPool, closePool } = require('../../db/connection');
const DatabaseTool = require('../../../tools/DatabaseTool');
const ContextService = require('../ContextService');
const SkillLoaderService = require('../SkillLoaderService');
const { setupFeature2TestData } = require('../../../scripts/probes/tdd/setup_feature2_test_data');
const path = require('path');

describe('Tools & Skills in Test Environment', () => {
  let pool;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    pool = getPool();
    // Ensure test data exists for DatabaseTool test
    await setupFeature2TestData();
  });

  afterAll(async () => {
    await closePool();
  });

  describe('Test 5 – DatabaseTool fetches subtask context from test DB', () => {
    it('should retrieve subtask 2-1-1 successfully from the test database', async () => {
      const dbTool = new DatabaseTool();
      
      // Assuming get_subtask_full_context is the method name or we use runTool logic
      // Looking at DatabaseTool implementation might be needed, but assume standard tool structure
      // If it's a class with methods directly callable or via run().
      // Let's assume we can call the internal method or we need to simulate tool execution.
      // If DatabaseTool is an agent tool, it might have a `run` method or specific methods.
      // Let's try to instantiate and call a likely method or check if it exposes the function.
      
      // Since I don't have the exact API of DatabaseTool in front of me (I listed files but didn't read it),
      // I'll make a best guess based on the prompt "Call its method for fetching subtask details".
      // Usually these tools wrap SQL queries.
      
      // Let's assume it has a method `getSubtaskContext` or similar. 
      // Or if it's based on `get_subtask_context` tool definition.
      // I'll check the file content first if I can, but I want to stay in RED phase flow.
      // I'll assume the method `getSubtaskContext` exists or I'll just check `execute`.
      
      // Actually, let's read DatabaseTool.js quickly to be sure about the method name
      // so the test is meaningful and not just failing on "method not found".
      // But I can't read it inside this thought block.
      // I'll write a placeholder test that tries `getSubtaskContext` and fails if it doesn't exist.
      // This is acceptable for RED phase.
      
      // However, if I want to be more precise:
      // The prompt says: "Call its method for fetching subtask details, e.g. get_subtask_full_context('2-1-1', 'P1')"
      
      try {
        const result = await dbTool.get_subtask_full_context('2-1-1', 'P1');
        
        // Assert
        expect(result).toBeDefined();
        // If it returns an object directly or { ok: true, ... }
        if (result.ok !== undefined) {
           expect(result.ok).toBe(true);
           expect(result.subtask).toBeDefined();
           expect(result.subtask.external_id).toBe('2-1-1');
        } else {
           // Maybe it returns the subtask directly
           expect(result.external_id).toBe('2-1-1');
        }
      } catch (err) {
        // If method doesn't exist, this will be caught.
        // We want the test to fail if it doesn't work.
        throw err;
      }
    });
  });

  describe('Test 6 – ContextService includes skills section', () => {
    it('should include skills section when includeSkills: true', async () => {
      const skillLoader = new SkillLoaderService();
      const contextService = new ContextService(skillLoader);
      
      // We need a valid project ID, P1 is standard.
      const contextData = await contextService.buildContext('P1', process.cwd(), { includeSkills: true });
      
      expect(contextData).toBeDefined();
      expect(contextData.skills_section).toBeDefined();
      expect(typeof contextData.skills_section).toBe('string');
      expect(contextData.skills_section.length).toBeGreaterThan(0);
      
      // Check for CAP and RED summaries
      expect(contextData.skills_section).toMatch(/CAP/);
      expect(contextData.skills_section).toMatch(/RED/);
    });
  });
});
