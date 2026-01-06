const WritePlanTool = require('../WritePlanTool');

describe('WritePlanTool Session APIs (MVP)', () => {
  let writePlanTool;
  let sessionId;

  beforeEach(() => {
    // Clear all sessions before each test to avoid state leakage
    WritePlanTool.clearAllSessions();
    writePlanTool = new WritePlanTool();
  });

  // Helper to create a session for tests that need it
  const createSession = async (params = {}) => {
    const defaultParams = {
      intent: 'Create a test file',
      target_file: 'test.txt',
      operation: 'create',
    };
    const result = await writePlanTool.begin({ ...defaultParams, ...params });
    return result.session_id;
  };

  describe('begin()', () => {
    it('returns session_id and stage: awaiting_content on valid inputs', async () => {
      const params = {
        intent: 'Create a test file',
        target_file: 'test.txt',
        operation: 'create',
      };
      const result = await writePlanTool.begin(params);
      expect(result).toEqual({
        session_id: expect.any(String),
        stage: 'awaiting_content',
        instruction: expect.any(String),
      });
    });

    it('validates that target_file is required', async () => {
      const params = {
        intent: 'Create a test file',
        operation: 'create',
      };
      await expect(writePlanTool.begin(params)).rejects.toThrow(
        'target_file is required'
      );
    });

    it('validates that operation is one of create, append, overwrite', async () => {
      const params = {
        intent: 'Create a test file',
        target_file: 'test.txt',
        operation: 'delete',
      };
      await expect(writePlanTool.begin(params)).rejects.toThrow(
        'Invalid operation type'
      );
    });

    it('enforces single active session (throws error if another session is active)', async () => {
      // First, create a session
      await writePlanTool.begin({
        intent: 'First session',
        target_file: 'test1.txt',
        operation: 'create',
      });
      // Try to create another session while one is active
      await expect(
        writePlanTool.begin({
          intent: 'Second session',
          target_file: 'test2.txt',
          operation: 'create',
        })
      ).rejects.toThrow(
        'Another write session is already active. Please wait for it to complete.'
      );
    });
  });

  describe('finalizeViaAPI(session_id, content)', () => {
    beforeEach(async () => {
      sessionId = await createSession();
    });

    it('finalizes a session and returns success summary, then removes session', async () => {
      const result = await writePlanTool.finalizeViaAPI(sessionId, 'Hello, world!');
      expect(result).toEqual({
        intent: 'Create a test file',
        results: [
          expect.objectContaining({
            operation_index: 0,
            type: 'create',
            target_file: 'test.txt',
            status: 'success',
            error: null,
          }),
        ],
      });
      // Verify session is removed
      await expect(writePlanTool.getStatus(sessionId)).rejects.toThrow(
        'Session not found or expired. Please start a new write session.'
      );
    });

    it('throws an error for unknown session_id', async () => {
      await expect(
        writePlanTool.finalizeViaAPI('unknown-session-id', 'Hello, world!')
      ).rejects.toThrow(
        'Session not found or expired. Please start a new write session.'
      );
    });

    it('throws expired error after 5 minutes', async () => {
      jest.useFakeTimers();
      WritePlanTool.clearAllSessions(); // Clear any existing sessions
      const tool = new WritePlanTool();
      const { session_id } = await tool.begin({
        intent: 'Create a test file',
        target_file: 'test.txt',
        operation: 'create',
      });

      // fast-forward 6 minutes (5 minutes + 1 minute buffer)
      jest.advanceTimersByTime(6 * 60 * 1000);

      await expect(
        tool.finalizeViaAPI(session_id, 'some content')
      ).rejects.toThrow(
        'Session has expired (5 minutes). Please start a new write session.'
      );

      jest.useRealTimers();
    });

    it('throws validation error for empty content', async () => {
      await expect(
        writePlanTool.finalizeViaAPI(sessionId, '')
      ).rejects.toThrow('Validation failed: content cannot be empty');
    });
  });

  describe('getStatus(session_id)', () => {
    beforeEach(async () => {
      sessionId = await createSession();
    });

    it('returns status for active session', async () => {
      const status = await writePlanTool.getStatus(sessionId);
      expect(status).toMatchObject({
        session_id: sessionId,
        stage: 'awaiting_content',
        created_at: expect.any(String),
        last_activity: expect.any(String),
      });
    });

    it('throws for unknown session_id', async () => {
      await expect(writePlanTool.getStatus('unknown')).rejects.toThrow(
        'Session not found or expired. Please start a new write session.'
      );
    });

    it('throws for expired session', async () => {
      jest.useFakeTimers();
      WritePlanTool.clearAllSessions(); // Clear any existing sessions
      const tool = new WritePlanTool();
      const { session_id } = await tool.begin({
        intent: 'Create a test file',
        target_file: 'test.txt',
        operation: 'create',
      });

      jest.advanceTimersByTime(6 * 60 * 1000);

      await expect(tool.getStatus(session_id)).rejects.toThrow(
        'Session not found or expired. Please start a new write session.'
      );

      jest.useRealTimers();
    });
  });

  describe('deleteSession(session_id)', () => {
    beforeEach(async () => {
      sessionId = await createSession();
    });

    it('deletes existing session', async () => {
      await writePlanTool.deleteSession(sessionId);
      await expect(writePlanTool.getStatus(sessionId)).rejects.toThrow(
        'Session not found or expired. Please start a new write session.'
      );
    });

    it('throws for unknown session_id', async () => {
      await expect(writePlanTool.deleteSession('unknown')).rejects.toThrow(
        'Session not found or expired. Please start a new write session.'
      );
    });
  });
});
