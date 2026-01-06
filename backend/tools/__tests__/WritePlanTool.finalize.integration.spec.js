/**
 * WritePlanTool.finalize.integration.spec.js
 *
 * Goal: Prove that `finalizeViaAPI` performs real file writes via `executeWritePlan`
 *       for create/append/overwrite and surfaces errors correctly.
 *
 * Requirements (Phase 5.1):
 * - [P5-1] finalizeViaAPI calls executeWritePlan for create operation
 * - [P5-2] finalizeViaAPI calls executeWritePlan for overwrite operation
 * - [P5-3] finalizeViaAPI calls executeWritePlan for append operation
 * - [P5-4] Error from executeWritePlan is propagated through finalizeViaAPI
 *
 * Non-goals:
 * - CLI buffering (Phase 3/4)
 * - HTTP API layer (covered by route tests)
 * - Tracing (covered by WritePlanTool.tracing.spec.js)
 *
 * Anti-placeholder strategy:
 * - All tests read actual files after finalize - a stubbed implementation would fail
 * - Tests verify session is deleted after finalize (observable side effect)
 */

const fs = require('fs').promises;
const path = require('path');
const WritePlanTool = require('../WritePlanTool');

describe('WritePlanTool finalizeViaAPI Integration (Real Writes)', () => {
  let tool;
  const testFiles = [];

  // Helper to track test files for cleanup
  const trackFile = (filename) => {
    const filePath = path.resolve(process.cwd(), filename);
    testFiles.push(filePath);
    return filename;
  };

  beforeEach(() => {
    WritePlanTool.clearAllSessions();
    tool = new WritePlanTool();
  });

  afterEach(async () => {
    WritePlanTool.clearAllSessions();
    // Clean up all test files
    for (const filePath of testFiles) {
      try {
        await fs.unlink(filePath);
      } catch (e) {
        // File may not exist if test failed early
      }
    }
    testFiles.length = 0;
  });

  describe('Test: real write on finalize (create)', () => {
    it('creates a real file on disk and removes the session', async () => {
      // Arrange
      const testFile = trackFile('test-phase5-create.txt');
      const content = 'Hello Phase5\n';

      const { session_id } = await tool.begin({
        intent: 'Phase5 create integration test',
        target_file: testFile,
        operation: 'create',
      });

      // Act
      await tool.finalizeViaAPI(session_id, content);

      // Assert: file exists with correct content
      const fileContent = await fs.readFile(testFile, 'utf8');
      expect(fileContent).toBe(content);

      // Assert: session is removed after finalize
      await expect(tool.getStatus(session_id)).rejects.toThrow(
        /Session not found or expired/
      );
    });
  });

  describe('Test: overwrite operation', () => {
    it('overwrites existing file content completely', async () => {
      // Arrange: pre-create file with starting content
      const testFile = trackFile('test-phase5-overwrite.txt');
      const originalContent = 'Original content here\nLine 2\nLine 3\n';
      const newContent = 'OVERWRITE\n';

      await fs.writeFile(testFile, originalContent, 'utf8');

      const { session_id } = await tool.begin({
        intent: 'Phase5 overwrite integration test',
        target_file: testFile,
        operation: 'overwrite',
      });

      // Act
      await tool.finalizeViaAPI(session_id, newContent);

      // Assert: file content is EXACTLY the new content (no original remains)
      const fileContent = await fs.readFile(testFile, 'utf8');
      expect(fileContent).toBe(newContent);
      expect(fileContent).not.toContain('Original');
    });
  });

  describe('Test: append operation', () => {
    it('appends content to existing file while preserving original', async () => {
      // Arrange: pre-create file with starting content
      const testFile = trackFile('test-phase5-append.txt');
      const originalContent = 'Original content\n';
      const appendContent = 'APPEND\n';

      await fs.writeFile(testFile, originalContent, 'utf8');

      const { session_id } = await tool.begin({
        intent: 'Phase5 append integration test',
        target_file: testFile,
        operation: 'append',
      });

      // Act
      await tool.finalizeViaAPI(session_id, appendContent);

      // Assert: file content contains original prefix AND ends with appended content
      const fileContent = await fs.readFile(testFile, 'utf8');
      expect(fileContent).toContain(originalContent);
      expect(fileContent.endsWith(appendContent)).toBe(true);
      expect(fileContent).toBe(originalContent + appendContent);
    });
  });

  describe('Test: error propagation from executeWritePlan', () => {
    it('surfaces executeWritePlan error when create targets existing file', async () => {
      // Arrange: use a path that will cause executeWritePlan to fail
      // For this test, we'll use a file that ALREADY exists to trigger
      // the 'File already exists' error for create operation.
      const testFile = trackFile('test-phase5-error-exists.txt');

      // Pre-create the file so 'create' operation fails
      await fs.writeFile(testFile, 'existing content', 'utf8');

      const { session_id } = await tool.begin({
        intent: 'Phase5 error propagation test',
        target_file: testFile,
        operation: 'create', // 'create' should fail because file exists
      });

      // Act & Assert: error is propagated, not swallowed
      await expect(tool.finalizeViaAPI(session_id, 'new content')).rejects.toThrow(
        /File already exists.*Use operation "overwrite"/
      );
    });

    it('auto-creates file when overwrite targets file that does not exist', async () => {
      // Arrange: target a file that doesn't exist
      const testFile = trackFile('test-phase5-nonexistent-overwrite.txt');

      const { session_id } = await tool.begin({
        intent: 'Phase5 overwrite nonexistent test',
        target_file: testFile,
        operation: 'overwrite', // 'overwrite' now auto-creates if file doesn't exist
      });

      // Act: finalize should succeed (auto-fallback to create)
      const result = await tool.finalizeViaAPI(session_id, 'auto-created content');

      // Assert: file was created successfully
      expect(result.results[0].status).toBe('success');
      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('auto-created content');
    });

    it('surfaces error when append targets file that does not exist', async () => {
      // Arrange: target a file that doesn't exist
      const testFile = 'test-phase5-nonexistent-append.txt';

      const { session_id } = await tool.begin({
        intent: 'Phase5 append nonexistent test',
        target_file: testFile,
        operation: 'append', // 'append' requires file to exist
      });

      // Act & Assert: error is propagated
      await expect(tool.finalizeViaAPI(session_id, 'content')).rejects.toThrow(
        /File does not exist/
      );
    });
  });

  describe('Guard: existing session behavior unchanged', () => {
    // These tests ensure error strings remain stable (regression guard)

    it('throws correct error for unknown session_id', async () => {
      await expect(
        tool.finalizeViaAPI('unknown-session-id', 'content')
      ).rejects.toThrow('Session not found or expired. Please start a new write session.');
    });

    it('throws correct error for empty content', async () => {
      const testFile = trackFile('test-phase5-empty.txt');
      const { session_id } = await tool.begin({
        intent: 'Empty content test',
        target_file: testFile,
        operation: 'create',
      });

      await expect(
        tool.finalizeViaAPI(session_id, '')
      ).rejects.toThrow('Validation failed: content cannot be empty');
    });

    it('throws correct error for whitespace-only content', async () => {
      const testFile = trackFile('test-phase5-whitespace.txt');
      const { session_id } = await tool.begin({
        intent: 'Whitespace content test',
        target_file: testFile,
        operation: 'create',
      });

      await expect(
        tool.finalizeViaAPI(session_id, '   \n\t  ')
      ).rejects.toThrow('Validation failed: content cannot be empty');
    });

    it('throws correct error for expired session', async () => {
      jest.useFakeTimers();

      const testFile = trackFile('test-phase5-expired.txt');
      const { session_id } = await tool.begin({
        intent: 'Expiration test',
        target_file: testFile,
        operation: 'create',
      });

      // Fast-forward 6 minutes (past 5 minute expiration)
      jest.advanceTimersByTime(6 * 60 * 1000);

      await expect(
        tool.finalizeViaAPI(session_id, 'content')
      ).rejects.toThrow('Session has expired (5 minutes). Please start a new write session.');

      jest.useRealTimers();
    });
  });
});


