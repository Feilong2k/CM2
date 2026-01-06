/**
 * E2E integration test for MVP write-session path:
 * CLI controller → HTTP API → WritePlanTool session layer
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const createOrionCliController = require('../../../bin/orion-cli-controller');
const WritePlanTool = require('../../tools/WritePlanTool');

// Mock console for assertions
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Test files that need cleanup
const TEST_FILES = ['test-e2e-writeSession.txt', 'large.txt'];

describe('Write Session E2E (MVP)', () => {
  let app;
  let controller;

  beforeAll(() => {
    // Import the Express app (backend/index.js)
    app = require('../../index');
  });

  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();
    // Clear all sessions before each test
    WritePlanTool.clearAllSessions();
    // Clean up test files
    TEST_FILES.forEach((file) => {
      const filePath = path.resolve(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    // Create HTTP adapter that uses supertest to call the in-process app
    // The controller expects { status, data } where data is the response body
    const http = {
      post: (url, body) =>
        request(app)
          .post(url)
          .send(body)
          .then((response) => ({
            status: response.status,
            data: response.body,
          })),
    };
    // Instantiate the controller with mocked console and real HTTP adapter
    controller = createOrionCliController({ http, console: mockConsole });
  });

  afterAll(() => {
    // Final cleanup of test files
    TEST_FILES.forEach((file) => {
      const filePath = path.resolve(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });

  it('Orion CLI + HTTP API + WritePlanTool complete a write session end-to-end (MVP)', async () => {
    // 1. Begin session via HTTP
    const beginResp = await request(app)
      .post('/api/write-session/begin')
      .send({
        intent: 'Create a test file E2E',
        target_file: 'test-e2e-writeSession.txt',
        operation: 'create',
      });

    expect(beginResp.status).toBe(200);
    const { session_id } = beginResp.body;
    expect(session_id).toBeDefined();

    // 2. Start CLI write session
    controller.startWriteSession({ session_id });

    // Verify CLI internal state
    let state = controller.getCliState();
    expect(state.activeWriteSession.sessionId).toBe(session_id);
    expect(state.activeWriteSession.buffer).toBe('');

    // 3. Send assistant messages through the controller
    await controller.handleAssistantMessage('Line 1\n');
    await controller.handleAssistantMessage('Line 2\nDONE\n');

    // 4. Assert the CLI called finalize and session is cleared
    // Since we are using real HTTP adapter, we cannot directly mock the call,
    // but we can verify that the session is removed from backend.
    const statusResp = await request(app)
      .get('/api/write-session/status')
      .query({ session_id });

    // Expect 404 because session was finalized and removed
    expect(statusResp.status).toBe(404);
    expect(statusResp.body.error).toContain('Session not found or expired');

    // CLI internal state should be cleared
    state = controller.getCliState();
    expect(state.activeWriteSession).toBeNull();
  });

  it('E2E: CLI surfaces 10MB limit error via real HTTP API', async () => {
    // 1. Begin session via HTTP
    const beginResp = await request(app)
      .post('/api/write-session/begin')
      .send({
        intent: 'Create a large file',
        target_file: 'large.txt',
        operation: 'create',
      });

    expect(beginResp.status).toBe(200);
    const { session_id } = beginResp.body;

    // 2. Start CLI write session
    controller.startWriteSession({ session_id });

    // 3. Build a large string (10MB + DONE)
    const largeChunk = 'A'.repeat(10 * 1024 * 1024) + '\nDONE\n';
    await controller.handleAssistantMessage(largeChunk);

    // 4. Expect error logged by CLI
    expect(mockConsole.error).toHaveBeenCalledWith(
      'Content too large: Content exceeds 10MB limit. Please reduce file size.'
    );

    // Optional: Verify session is cleared or still active? Not required for this test.
  });
});
