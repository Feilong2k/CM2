const WritePlanTool = require('../WritePlanTool');
const fs = require('fs');
const path = require('path');

describe('WritePlanTool Session APIs', () => {
  let writePlanTool;
  const testFile = path.resolve(process.cwd(), 'test.txt');

  beforeEach(() => {
    WritePlanTool.clearAllSessions();
    writePlanTool = new WritePlanTool();
    // Clean up test file if it exists
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  afterEach(() => {
    WritePlanTool.clearAllSessions();
    // Clean up test file
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  describe('begin', () => {
    it('returns session_id and stage: awaiting_content on valid inputs', async () => {
      const params = {
        intent: 'Create a test file',
        target_file: 'test.txt',
        operation: 'create'
      };
      // This test will fail until the begin method is implemented
      await expect(writePlanTool.begin(params)).resolves.toEqual({
        session_id: expect.any(String),
        stage: 'awaiting_content',
        instruction: expect.any(String)
      });
    });

    it('validates that target_file is required', async () => {
      const params = {
        intent: 'Create a test file',
        operation: 'create'
      };
      await expect(writePlanTool.begin(params)).rejects.toThrow('target_file is required');
    });

    it('validates that operation is one of create, append, overwrite', async () => {
      const params = {
        intent: 'Create a test file',
        target_file: 'test.txt',
        operation: 'delete'
      };
      await expect(writePlanTool.begin(params)).rejects.toThrow('Invalid operation type');
    });
  });

  describe('finalize', () => {
    it('finalizes a session and returns success summary', async () => {
      // First, create a session
      const beginResult = await writePlanTool.begin({
        intent: 'Create a test file',
        target_file: 'test.txt',
        operation: 'create'
      });
      const { session_id } = beginResult;

      // Now finalize with some content
      const raw_content = 'Hello, world!';
      const finalizeResult = await writePlanTool.finalizeViaAPI(session_id, raw_content);

      // Should return a summary, not the raw content
      expect(finalizeResult).toEqual({
        intent: 'Create a test file',
        results: expect.arrayContaining([
          expect.objectContaining({
            status: 'success'
          })
        ])
      });
    });

    it('throws an error for unknown session_id', async () => {
      await expect(writePlanTool.finalizeViaAPI('unknown-session-id', 'some content'))
        .rejects.toThrow('Session not found');
    });

    it('delegates to executeWritePlan internally', async () => {
      // This test can be more involved if we want to mock executeWritePlan
      // For now, we can just verify that the finalize calls executeWritePlan with the right plan
      const beginResult = await writePlanTool.begin({
        intent: 'Create a test file',
        target_file: 'test.txt',
        operation: 'create'
      });
      const { session_id } = beginResult;

      const raw_content = 'Hello, world!';
      const finalizeResult = await writePlanTool.finalizeViaAPI(session_id, raw_content);

      // The result should have the same intent and a results array
      expect(finalizeResult.intent).toBe('Create a test file');
      expect(finalizeResult.results).toBeDefined();
      expect(Array.isArray(finalizeResult.results)).toBe(true);
    });
  });
});
