const { getPool, closePool } = require('../../db/connection');
const TraceStoreService = require('../TraceStoreService');

describe('TraceStoreService', () => {
  let service;
  let pool;

  beforeAll(async () => {
    // Ensure we are using the test database
    process.env.NODE_ENV = 'test';
    pool = getPool();
    service = new TraceStoreService();
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean the trace_events table before each test
    await pool.query('DELETE FROM trace_events');
  });

  describe('insertTraceEvent', () => {
    const validTraceEvent = {
      projectId: 'P1',
      source: 'orion',
      type: 'tool_call',
      summary: 'Tool called: FileSystemTool',
      details: { tool: 'FileSystemTool', action: 'write' },
      direction: 'outbound',
      toolName: 'FileSystemTool',
      requestId: 'req-123',
      error: null,
      metadata: { model: 'deepseek-reasoner' },
      phaseIndex: 1,
      cycleIndex: 1,
    };

    it('should insert a trace event with the correct project_id', async () => {
      const result = await service.insertTraceEvent(validTraceEvent);

      expect(result).toHaveProperty('project_id', 'P1');
      expect(result).toHaveProperty('type', 'tool_call');
      expect(result).toHaveProperty('summary', 'Tool called: FileSystemTool');
      expect(result).toHaveProperty('timestamp');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should insert a trace event with minimal required fields', async () => {
      const minimalEvent = {
        projectId: 'P1',
        source: 'user',
        type: 'user_message',
        summary: 'User said hello',
      };
      const result = await service.insertTraceEvent(minimalEvent);

      expect(result.project_id).toBe('P1');
      expect(result.type).toBe('user_message');
      expect(result.summary).toBe('User said hello');
    });

    it('should throw when missing required fields', async () => {
      const invalidEvent = {
        // missing projectId, source, type, summary
        details: {},
      };
      await expect(service.insertTraceEvent(invalidEvent)).rejects.toThrow(
        'Missing required fields: projectId, source, type, summary are required'
      );
    });

    it('should throw on database error (forced by invalid table)', async () => {
      // Mock the pool's query method to simulate a DB error
      const mockError = new Error('DB error');
      const originalQuery = service.pool.query;
      service.pool.query = jest.fn().mockRejectedValue(mockError);
      await expect(service.insertTraceEvent(validTraceEvent)).rejects.toThrow('DB error');
      service.pool.query = originalQuery;
    });
  });
});
