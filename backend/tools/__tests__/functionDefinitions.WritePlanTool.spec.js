const functionDefinitions = require('../functionDefinitions');

describe('functionDefinitions (WritePlanTool integration)', () => {
  // NOTE: WritePlanTool_execute was removed - use WritePlanTool_begin for ALL file writes.
  // This ensures content is streamed outside JSON to avoid truncation issues.

  describe("WritePlanTool_execute is NOT registered (intentionally removed)", () => {
    it("should NOT have WritePlanTool_execute in function definitions", () => {
      const def = functionDefinitions.find(
        (d) => d.function.name === "WritePlanTool_execute"
      );
      expect(def).toBeUndefined();
    });
  });

  describe("WritePlanTool_begin registration", () => {
    it("registers WritePlanTool_begin with correct schema", () => {
      const def = functionDefinitions.find(
        (d) => d.function.name === "WritePlanTool_begin"
      );
      expect(def).toBeDefined();
      expect(def.function.parameters).toBeDefined();
      expect(def.function.parameters.properties).toHaveProperty("target_file");
      expect(def.function.parameters.properties).toHaveProperty("operation");
      expect(def.function.parameters.properties).toHaveProperty("intent");
      expect(def.function.parameters.required).toContain("target_file");
      expect(def.function.parameters.required).toContain("operation");
      // operation enum
      expect(def.function.parameters.properties.operation.enum).toEqual([
        "create",
        "append",
        "overwrite",
      ]);
    });
  });

  describe("WritePlanTool_finalizeViaAPI is NOT registered (intentionally removed)", () => {
    it("should NOT have WritePlanTool_finalizeViaAPI in function definitions", () => {
      // NOTE: WritePlanTool_finalizeViaAPI is intentionally NOT exposed as a tool.
      // The CLI handles finalization via HTTP API after detecting DONE signal.
      const def = functionDefinitions.find(
        (d) => d.function.name === "WritePlanTool_finalizeViaAPI"
      );
      expect(def).toBeUndefined();
    });
  });
});
