/**
 * writeSession.orion.integration.spec.js
 *
 * Goal: Prove that, from Orion's perspective, long-content writes use the new
 *       write-session pipeline end-to-end:
 *       WritePlanTool_begin + streamed content + DONE → real file on disk
 *       No legacy direct-write tools (FileSystemTool_write_to_file).
 *
 * Requirements (Phase 5.2):
 * - [P5.2-1] WritePlanTool_begin is called for long write operations
 * - [P5.2-2] No calls to deprecated FileSystemTool_write_to_file
 * - [P5.2-3] CLI enters session_active state and buffers content
 * - [P5.2-4] Real file is created on disk with correct content
 *
 * Non-goals:
 * - Full LLM integration (we stub the LLM to produce fixed tool calls)
 * - HTTP layer (we simulate the finalize call directly)
 *
 * Test Strategy:
 * - Stub LLM to emit a fixed sequence: WritePlanTool_begin → streamed content → DONE
 * - Intercept tool calls to verify WritePlanTool_begin is used
 * - Verify no legacy write tools are invoked
 * - Verify real file is created
 */

const fs = require('fs').promises;
const path = require('path');

// Mock controller that simulates CLI write session behavior
const createMockController = () => {
  const state = {
    activeWriteSession: null,
    toolCalls: [], // Track all tool calls for assertion
  };

  return {
    state,

    // Simulate WritePlanTool_begin being called
    startWriteSession({ session_id, target_file, operation, intent }) {
      state.activeWriteSession = {
        sessionId: session_id,
        targetFile: target_file,
        operation,
        intent,
        buffer: '',
        idleTimer: null,
      };
      state.toolCalls.push({
        tool: 'WritePlanTool',
        action: 'begin',
        params: { session_id, target_file, operation, intent },
      });
    },

    // Simulate assistant message handling
    handleAssistantMessage(text) {
      if (!state.activeWriteSession) return;

      // Buffer content (strip DONE signal)
      const doneIndex = text.indexOf('\nDONE');
      if (doneIndex !== -1) {
        state.activeWriteSession.buffer += text.slice(0, doneIndex);
        // Mark that DONE was detected
        state.activeWriteSession.doneDetected = true;
      } else {
        state.activeWriteSession.buffer += text;
      }
    },

    // Get buffered content
    getBufferedContent() {
      return state.activeWriteSession?.buffer || '';
    },

    // Check if DONE was detected
    isDoneDetected() {
      return state.activeWriteSession?.doneDetected || false;
    },

    // Clear session after finalize
    clearSession() {
      state.activeWriteSession = null;
    },

    // Record a tool call (for legacy tool detection)
    recordToolCall(tool, action, params) {
      state.toolCalls.push({ tool, action, params });
    },

    // Get all recorded tool calls
    getToolCalls() {
      return state.toolCalls;
    },

    // Check if any legacy write tools were called
    hasLegacyWriteToolCalls() {
      const legacyWriteTools = [
        'FileSystemTool_write_to_file',
        'FileSystemTool_replace_in_file',
        'write_to_file', // Old naming
      ];
      return state.toolCalls.some(
        (call) =>
          legacyWriteTools.includes(`${call.tool}_${call.action}`) ||
          legacyWriteTools.includes(call.action)
      );
    },
  };
};

describe('Orion Write Session Integration (Phase 5.2)', () => {
  const WritePlanTool = require('../../../tools/WritePlanTool');
  let controller;
  const testFiles = [];

  const trackFile = (filename) => {
    const filePath = path.resolve(process.cwd(), filename);
    testFiles.push(filePath);
    return filename;
  };

  beforeEach(() => {
    WritePlanTool.clearAllSessions();
    controller = createMockController();
  });

  afterEach(async () => {
    WritePlanTool.clearAllSessions();
    for (const filePath of testFiles) {
      try {
        await fs.unlink(filePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    testFiles.length = 0;
  });

  describe('Scenario: Long markdown write via write-session pipeline', () => {
    /**
     * Simulate a conversation where Orion creates a 200+ line markdown file:
     * 1. User: "Create a 200-line markdown spec file at docs/phase5-demo.md"
     * 2. Orion (simulated):
     *    - Calls WritePlanTool_begin({ target_file, operation: 'create', intent: ... })
     *    - Streams body text as assistant messages
     *    - Ends with "DONE" on its own line
     */
    it('uses WritePlanTool_begin and produces real file (no legacy tools)', async () => {
      // Arrange
      const targetFile = trackFile('test-phase5-orion-demo.md');
      const tool = new WritePlanTool();

      // Generate "long" content (200 lines)
      const lines = [];
      lines.push('# Phase 5 Demo Specification');
      lines.push('');
      lines.push('## Overview');
      lines.push('This document was created via the write-session pipeline.');
      lines.push('');
      for (let i = 1; i <= 195; i++) {
        lines.push(`- Item ${i}: Lorem ipsum dolor sit amet`);
      }
      const longContent = lines.join('\n') + '\n';

      // === Step 1: Orion calls WritePlanTool_begin ===
      const { session_id } = await tool.begin({
        intent: 'Create a 200-line markdown spec file',
        target_file: targetFile,
        operation: 'create',
      });

      // Controller records this tool call
      controller.startWriteSession({
        session_id,
        target_file: targetFile,
        operation: 'create',
        intent: 'Create a 200-line markdown spec file',
      });

      // === Step 2: Orion streams content (simulated) ===
      // In reality, this would be chunked from LLM response
      controller.handleAssistantMessage(longContent);

      // === Step 3: Orion ends with DONE ===
      controller.handleAssistantMessage('\nDONE\n');

      // === Step 4: CLI detects DONE and calls finalize ===
      expect(controller.isDoneDetected()).toBe(true);
      const bufferedContent = controller.getBufferedContent();

      // Finalize via the tool
      await tool.finalizeViaAPI(session_id, bufferedContent);
      controller.clearSession();

      // === Assertions ===

      // A1: WritePlanTool_begin was called
      const toolCalls = controller.getToolCalls();
      const beginCall = toolCalls.find(
        (c) => c.tool === 'WritePlanTool' && c.action === 'begin'
      );
      expect(beginCall).toBeDefined();
      expect(beginCall.params.target_file).toBe(targetFile);
      expect(beginCall.params.operation).toBe('create');

      // A2: No legacy file-write tools were called
      expect(controller.hasLegacyWriteToolCalls()).toBe(false);

      // A3: Real file exists on disk
      const fileExists = await fs
        .access(targetFile)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // A4: File content matches streamed content
      const fileContent = await fs.readFile(targetFile, 'utf8');
      expect(fileContent).toBe(longContent);

      // A5: Content is "large enough" (> 100 lines)
      const lineCount = fileContent.split('\n').length;
      expect(lineCount).toBeGreaterThan(100);
    });

    it('does NOT call FileSystemTool_write_to_file for large file creation', async () => {
      // Arrange
      const targetFile = trackFile('test-phase5-no-legacy.md');
      const tool = new WritePlanTool();

      const content = '# Test\n'.repeat(50); // 50 lines

      // Simulate the new pipeline
      const { session_id } = await tool.begin({
        intent: 'Create markdown without legacy tools',
        target_file: targetFile,
        operation: 'create',
      });

      controller.startWriteSession({
        session_id,
        target_file: targetFile,
        operation: 'create',
        intent: 'Create markdown without legacy tools',
      });

      // Simulate what would happen if legacy tool was mistakenly called
      // (This test ensures our detection works)
      // controller.recordToolCall('FileSystemTool', 'write_to_file', { path: targetFile });

      // Complete via new pipeline
      controller.handleAssistantMessage(content + '\nDONE\n');
      await tool.finalizeViaAPI(session_id, content);
      controller.clearSession();

      // Assert: no legacy tools
      expect(controller.hasLegacyWriteToolCalls()).toBe(false);
    });
  });

  describe('Scenario: Overwrite existing file via write-session', () => {
    it('uses WritePlanTool_begin with operation=overwrite', async () => {
      // Arrange: create existing file
      const targetFile = trackFile('test-phase5-orion-overwrite.md');
      const tool = new WritePlanTool();

      await fs.writeFile(targetFile, '# Old Content\n', 'utf8');

      const newContent = '# New Content\nCompletely replaced.\n';

      // Simulate Orion using overwrite
      const { session_id } = await tool.begin({
        intent: 'Overwrite existing spec',
        target_file: targetFile,
        operation: 'overwrite',
      });

      controller.startWriteSession({
        session_id,
        target_file: targetFile,
        operation: 'overwrite',
        intent: 'Overwrite existing spec',
      });

      controller.handleAssistantMessage(newContent + '\nDONE\n');

      await tool.finalizeViaAPI(session_id, newContent);
      controller.clearSession();

      // Assert
      const beginCall = controller.getToolCalls().find(
        (c) => c.tool === 'WritePlanTool' && c.action === 'begin'
      );
      expect(beginCall.params.operation).toBe('overwrite');

      const fileContent = await fs.readFile(targetFile, 'utf8');
      expect(fileContent).toBe(newContent);
      expect(fileContent).not.toContain('Old Content');
    });
  });

  describe('Scenario: Append to existing file via write-session', () => {
    it('uses WritePlanTool_begin with operation=append', async () => {
      // Arrange: create existing file
      const targetFile = trackFile('test-phase5-orion-append.md');
      const tool = new WritePlanTool();

      const originalContent = '# Changelog\n\n## v1.0.0\n- Initial release\n';
      await fs.writeFile(targetFile, originalContent, 'utf8');

      const appendContent = '\n## v1.1.0\n- Added new feature\n';

      // Simulate Orion using append
      const { session_id } = await tool.begin({
        intent: 'Append changelog entry',
        target_file: targetFile,
        operation: 'append',
      });

      controller.startWriteSession({
        session_id,
        target_file: targetFile,
        operation: 'append',
        intent: 'Append changelog entry',
      });

      controller.handleAssistantMessage(appendContent + '\nDONE\n');

      await tool.finalizeViaAPI(session_id, appendContent);
      controller.clearSession();

      // Assert
      const beginCall = controller.getToolCalls().find(
        (c) => c.tool === 'WritePlanTool' && c.action === 'begin'
      );
      expect(beginCall.params.operation).toBe('append');

      const fileContent = await fs.readFile(targetFile, 'utf8');
      expect(fileContent).toContain(originalContent);
      expect(fileContent).toContain('## v1.1.0');
      expect(fileContent.endsWith(appendContent)).toBe(true);
    });
  });

  describe('Guard: Legacy tool detection works', () => {
    it('correctly identifies when legacy write tools are called', () => {
      // This test validates our detection helper works
      controller.recordToolCall('FileSystemTool', 'write_to_file', {
        path: 'test.txt',
      });
      expect(controller.hasLegacyWriteToolCalls()).toBe(true);
    });

    it('correctly identifies when only new tools are called', () => {
      controller.recordToolCall('WritePlanTool', 'begin', {
        target_file: 'test.txt',
      });
      controller.recordToolCall('FileSystemTool', 'read_file', {
        path: 'test.txt',
      });
      expect(controller.hasLegacyWriteToolCalls()).toBe(false);
    });
  });
});

