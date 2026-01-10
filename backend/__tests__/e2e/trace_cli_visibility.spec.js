/**
 * CLI Trace Visibility Tests (2-2-6)
 * 
 * Goal: Verify trace events appear in CLI output
 * RED Condition: No CLI integration exists
 */

const TraceStoreService = require('../../src/services/TraceStoreService');

describe('CLI Trace Visibility', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log trace events to console when CLI flag enabled', async () => {
    // Arrange: TraceStoreService with CLI logging enabled
    const traceStore = new TraceStoreService({ 
      projectId: 1,
      enableCliLogging: true // New configuration option
    });

    // Act: Emit event
    await traceStore.emit('step_decomposition_started', {
      subtaskId: 1,
      stepCount: 3
    });

    // Assert: Console log called with trace info
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[TRACE]'),
      expect.stringContaining('step_decomposition_started'),
      expect.stringContaining('subtaskId=1')
    );
    // RED: Fails - no CLI logging implementation
  });

  it('should respect verbosity levels', async () => {
    const traceStore = new TraceStoreService({
      projectId: 1,
      enableCliLogging: true,
      verbosity: 'warn' // Only warnings and errors
    });

    // Info event should not log
    await traceStore.emit('step_decomposition_started', { subtaskId: 1 });
    expect(consoleSpy).not.toHaveBeenCalled();

    // Warning event should log
    await traceStore.emit('step_decomposition_warning', {
      subtaskId: 1,
      filePath: 'large.js'
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WARN]'),
      expect.stringContaining('step_decomposition_warning'),
      expect.stringContaining('subtaskId=1')
    );
  });
});