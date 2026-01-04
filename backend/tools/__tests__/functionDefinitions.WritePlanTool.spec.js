const functionDefinitions = require('../functionDefinitions');

describe('functionDefinitions (WritePlanTool integration)', () => {
  // Check that WritePlanTool_execute is registered
  describe('WritePlanTool_execute registration', () => {
    it('registers WritePlanTool_execute with correct schema', () => {
      const def = functionDefinitions.find(d => d.function.name === 'WritePlanTool_execute');
      // If not found, this test will fail (RED phase)
      expect(def).toBeDefined();
      expect(def.function.parameters).toBeDefined();
      expect(def.function.parameters.properties).toHaveProperty('operation');
      expect(def.function.parameters.properties).toHaveProperty('path');
      expect(def.function.parameters.properties).toHaveProperty('content');
      expect(def.function.parameters.properties).toHaveProperty('validate_existence');
    });

    it('has required operation, path, and content parameters', () => {
      const def = functionDefinitions.find(d => d.function.name === 'WritePlanTool_execute');
      if (!def) {
        console.log('WritePlanTool_execute not found in functionDefinitions, skipping.');
        return;
      }
      expect(def.function.parameters.required).toContain('operation');
      expect(def.function.parameters.required).toContain('path');
      expect(def.function.parameters.required).toContain('content');
    });

    it('operation is an enum of create, append, overwrite', () => {
      const def = functionDefinitions.find(d => d.function.name === 'WritePlanTool_execute');
      if (!def) {
        console.log('WritePlanTool_execute not found in functionDefinitions, skipping.');
        return;
      }
      expect(def.function.parameters.properties.operation.enum).toEqual(['create', 'append', 'overwrite']);
    });

    it('validate_existence is optional boolean', () => {
      const def = functionDefinitions.find(d => d.function.name === 'WritePlanTool_execute');
      if (!def) {
        console.log('WritePlanTool_execute not found in functionDefinitions, skipping.');
        return;
      }
      expect(def.function.parameters.properties.validate_existence.type).toBe('boolean');
      // It should not be in required array
      expect(def.function.parameters.required).not.toContain('validate_existence');
    });
  });
});
