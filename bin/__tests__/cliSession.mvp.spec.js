/**
 * MVP CLI Write Session Orchestration Tests (Tara Phase 3)
 * 
 * Assumes a controller interface:
 *   - startWriteSession({ session_id })
 *   - handleAssistantMessage(text)
 *   - getCliState()
 *   - HTTP client is mocked
 *   - Console output is captured/mocked
 */

describe('CLI Write Session Orchestration (MVP)', () => {
  let controller;
  let mockHttp;
  let mockConsole;
  const SESSION_ID = 'sess-123';

  beforeEach(() => {
    jest.resetModules();
    jest.useRealTimers();
    // Mock HTTP client and console output
    mockHttp = {
      post: jest.fn(),
    };
    mockConsole = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    // Import controller with injected mocks (assume Devon exposes this seam)
    controller = require('../orion-cli-controller')({
      http: mockHttp,
      console: mockConsole,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Entering a write session', () => {
    it('CLI enters write session mode when WritePlanTool_begin succeeds', () => {
      controller.startWriteSession({ session_id: SESSION_ID });
      const state = controller.getCliState();
      expect(state.activeWriteSession.sessionId).toBe(SESSION_ID);
      expect(state.activeWriteSession.buffer).toBe('');
      expect(state.activeWriteSession.idleTimer).toBeNull();
    });
  });

  describe('Buffering assistant content', () => {
    it('CLI buffers assistant text while session is active', () => {
      controller.startWriteSession({ session_id: SESSION_ID });
      controller.handleAssistantMessage('Line 1\n');
      controller.handleAssistantMessage('Line 2\n');
      const state = controller.getCliState();
      expect(state.activeWriteSession.buffer).toBe('Line 1\nLine 2\n');
      expect(mockHttp.post).not.toHaveBeenCalled();
    });
  });

  describe('DONE detection and finalize call', () => {
    it('CLI detects DONE and calls finalize with buffered content', async () => {
      controller.startWriteSession({ session_id: SESSION_ID });
      controller.handleAssistantMessage('Line 1\nLine 2\n');
      mockHttp.post.mockResolvedValueOnce({ status: 200, data: { success: true } });
      await controller.handleAssistantMessage('Line 3\nDONE\n');
      // Buffer should not include DONE
      expect(mockHttp.post).toHaveBeenCalledWith(
        '/api/write-session/finalize',
        { session_id: SESSION_ID, content: 'Line 1\nLine 2\nLine 3\n' }
      );
      const state = controller.getCliState();
      expect(state.activeWriteSession).toBeNull();
    });
  });

  describe('Idle timer fallback when DONE is missing', () => {
    it('CLI starts idle timer and prompts for DONE when no DONE is present', () => {
      jest.useFakeTimers();
      controller.startWriteSession({ session_id: SESSION_ID });
      controller.handleAssistantMessage('Partial content...\n');
      // No finalize call yet
      expect(mockHttp.post).not.toHaveBeenCalled();
      // Fast-forward 2 seconds
      jest.advanceTimersByTime(2000);
      // Should prompt for DONE
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('If you\'re finished, reply DONE on its own line')
      );
      // No finalize call yet
      expect(mockHttp.post).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('Size limit error from backend', () => {
    it('CLI surfaces 10MB limit error from finalize API', async () => {
      controller.startWriteSession({ session_id: SESSION_ID });
      // Simulate large content ending with DONE
      const largeContent = 'A'.repeat(10 * 1024 * 1024) + '\nDONE\n';
      mockHttp.post.mockResolvedValueOnce({
        status: 413,
        data: { error: 'Content exceeds 10MB limit. Please reduce file size.' }
      });
      await controller.handleAssistantMessage(largeContent);
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Content too large')
      );
      // Session should be cleared or remain active per contract (assert at least error is shown)
    });
  });

  describe('Network error and retry logic', () => {
    it('CLI retries finalize on network failure up to 2 times', async () => {
      controller.startWriteSession({ session_id: SESSION_ID });
      // First call: network error, second call: success
      mockHttp.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ status: 200, data: { success: true } });
      await controller.handleAssistantMessage('Some content\nDONE\n');
      expect(mockHttp.post).toHaveBeenCalledTimes(2);
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to connect to backend')
      );
      const state = controller.getCliState();
      expect(state.activeWriteSession).toBeNull();
    });
  });

  describe('Validation error (400) surfaced to user', () => {
    it('CLI displays validation errors from finalize API', async () => {
      controller.startWriteSession({ session_id: SESSION_ID });
      mockHttp.post.mockResolvedValueOnce({
        status: 400,
        data: { error: 'Validation failed: content cannot be empty' }
      });
      await controller.handleAssistantMessage('DONE\n');
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Content validation failed')
      );
    });
  });
});
