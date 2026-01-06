/**
 * CLI Controller Prompt-Back Tests (Subtask 2-3-5)
 *
 * These tests define the contract for the 2-second idle timer that
 * prompts Orion to decide whether the write session is finished.
 *
 * Contract for Devon:
 * - createOrionCliController({ http, console, onPromptBack? })
 *   - `onPromptBack` is an optional callback used to inject a prompt
 *     back into the conversation (role: 'user', content: message).
 * - During an active write session:
 *   - If 2 seconds pass without new assistant content and no DONE
 *     has been detected, the controller must call `onPromptBack(message)`.
 *   - If new content arrives, the idle timer resets.
 *   - If DONE is detected before timeout, no prompt-back should fire.
 *   - It may prompt again on subsequent idle periods (2s gaps).
 */

const createOrionCliController = require('../orion-cli-controller');

describe('CLI Controller 2-second idle timer with prompt-back', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  it('should emit prompt-back after 2 seconds of inactivity', async () => {
    const mockPromptCallback = jest.fn();
    const controller = createOrionCliController({
      http: { post: jest.fn() },
      console: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
      onPromptBack: mockPromptCallback,
    });

    controller.startWriteSession({ session_id: 'sess_123' });

    // Simulate some content but no DONE
    await controller.handleAssistantMessage('# Header\n');
    await controller.handleAssistantMessage('Some content...\n');

    // No activity for 2 seconds
    jest.advanceTimersByTime(2000);

    expect(mockPromptCallback).toHaveBeenCalledTimes(1);
    expect(mockPromptCallback).toHaveBeenCalledWith(
      expect.stringMatching(/finished|DONE/i)
    );
  });

  it('should reset timer when new content arrives', async () => {
    const mockPromptCallback = jest.fn();
    const controller = createOrionCliController({
      http: { post: jest.fn() },
      console: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
      onPromptBack: mockPromptCallback,
    });

    controller.startWriteSession({ session_id: 'sess_123' });

    await controller.handleAssistantMessage('# Header\n');

    // Wait 1.5 seconds (not yet 2)
    jest.advanceTimersByTime(1500);
    expect(mockPromptCallback).not.toHaveBeenCalled();

    // More content arrives - timer should reset
    await controller.handleAssistantMessage('More content\n');

    // Wait another 1.5 seconds (3s total, but only 1.5s since last content)
    jest.advanceTimersByTime(1500);
    expect(mockPromptCallback).not.toHaveBeenCalled();

    // Wait final 0.5 seconds (now 2s since last content)
    jest.advanceTimersByTime(500);
    expect(mockPromptCallback).toHaveBeenCalledTimes(1);
  });

  it('should NOT emit prompt if DONE is detected before timeout', async () => {
    const mockPromptCallback = jest.fn();
    const mockHttpPost = jest.fn().mockResolvedValue({ status: 200, data: { success: true } });
    const controller = createOrionCliController({
      http: { post: mockHttpPost },
      console: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
      onPromptBack: mockPromptCallback,
    });

    controller.startWriteSession({ session_id: 'sess_123' });

    await controller.handleAssistantMessage('# Header\n');
    await controller.handleAssistantMessage('Content\n');
    await controller.handleAssistantMessage('DONE\n');

    // Wait 2 seconds
    jest.advanceTimersByTime(2000);

    // Prompt should NOT have been called - DONE was detected
    expect(mockPromptCallback).not.toHaveBeenCalled();
    // finalize should have been called once
    expect(mockHttpPost).toHaveBeenCalled();
  });

  it('should only prompt once per idle period', async () => {
    const mockPromptCallback = jest.fn();
    const controller = createOrionCliController({
      http: { post: jest.fn() },
      console: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
      onPromptBack: mockPromptCallback,
    });

    controller.startWriteSession({ session_id: 'sess_123' });
    await controller.handleAssistantMessage('Content\n');

    // Wait 2 seconds - first prompt
    jest.advanceTimersByTime(2000);
    expect(mockPromptCallback).toHaveBeenCalledTimes(1);

    // Wait another 2 seconds - should prompt again (still no DONE)
    jest.advanceTimersByTime(2000);
    expect(mockPromptCallback).toHaveBeenCalledTimes(2);
  });

  it('prompt message should be clear and actionable', async () => {
    const mockPromptCallback = jest.fn();
    const controller = createOrionCliController({
      http: { post: jest.fn() },
      console: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
      onPromptBack: mockPromptCallback,
    });

    controller.startWriteSession({ session_id: 'sess_123' });
    await controller.handleAssistantMessage('Content\n');

    jest.advanceTimersByTime(2000);

    const promptMessage = mockPromptCallback.mock.calls[0][0];
    // Should be actionable - tell Orion what to do
    expect(promptMessage).toMatch(/DONE/);
    expect(promptMessage).toMatch(/finish|continue/i);
  });
});

describe('CLI Controller prompt-back integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  it('should integrate prompt-back with orion-cli message flow', async () => {
    const injectedMessages = [];
    const mockPromptCallback = (message) => {
      injectedMessages.push({ role: 'user', content: message });
    };

    const controller = createOrionCliController({
      http: { post: jest.fn().mockResolvedValue({ status: 200, data: { success: true } }) },
      console: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
      onPromptBack: mockPromptCallback,
    });

    controller.startWriteSession({ session_id: 'sess_123' });
    await controller.handleAssistantMessage('Partial content\n');

    jest.advanceTimersByTime(2000);

    expect(injectedMessages).toHaveLength(1);
    expect(injectedMessages[0].role).toBe('user');
    expect(injectedMessages[0].content).toMatch(/DONE/);
  });
});

