const { getPool, closePool } = require('../../db/connection');
const TraceStoreService = require('../../services/TraceStoreService');

describe('Trace Persistence Integration', () => {
  let pool;
  let traceService;

  beforeAll(async () => {
    // Ensure we are using the test database
    process.env.NODE_ENV = 'test';
    pool = getPool();
    traceService = new TraceStoreService();
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean the trace_events table before each test
    await pool.query('DELETE FROM trace_events');
  });

  describe('A) Tool call + tool result persistence', () => {
    const projectId = 'P1';
    const requestId = 'test-request-123';
    const toolCallId = 'call_123';
    const toolName = 'FileSystemTool';
    const action = 'read_file';

    const toolCallPayload = {
      projectId,
      source: 'orion',
      type: 'tool_call',
      summary: `Tool call: ${toolName}.${action}`,
      details: {
        tool: toolName,
        action,
        params: { path: '/tmp/test.txt' },
        toolCallId,
      },
      toolName,
      requestId,
      direction: 'outbound',
    };

    const toolResultPayload = {
      projectId,
      source: 'tool',
      type: 'tool_result',
      summary: `Tool result: ${toolName}.${action}`,
      details: {
        tool: toolName,
        action,
        result: {
          success: true,
          content: 'Hello, world!',
          size: 13,
        },
        toolCallId,
      },
      toolName,
      requestId,
      direction: 'inbound',
    };

    it('should persist a tool_call event', async () => {
      // This test will fail until TraceStoreService.insertTraceEvent is implemented
      const inserted = await traceService.insertTraceEvent(toolCallPayload);

      // Verify the returned object contains expected fields
      expect(inserted).toHaveProperty('project_id', projectId);
      expect(inserted).toHaveProperty('type', 'tool_call');
      expect(inserted).toHaveProperty('summary', toolCallPayload.summary);
      expect(inserted).toHaveProperty('timestamp');
      expect(new Date(inserted.timestamp)).toBeInstanceOf(Date);

      // Verify the row exists in the database
      const { rows } = await pool.query(
        'SELECT * FROM trace_events WHERE project_id = $1 AND type = $2',
        [projectId, 'tool_call']
      );
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row.project_id).toBe(projectId);
      expect(row.type).toBe('tool_call');
      expect(row.tool_name).toBe(toolName);
      expect(row.details).toEqual(toolCallPayload.details);
    });

    it('should persist a tool_result event with full result payload', async () => {
      const inserted = await traceService.insertTraceEvent(toolResultPayload);

      expect(inserted).toHaveProperty('project_id', projectId);
      expect(inserted).toHaveProperty('type', 'tool_result');
      expect(inserted.summary).toBe(toolResultPayload.summary);

      const { rows } = await pool.query(
        'SELECT * FROM trace_events WHERE project_id = $1 AND type = $2',
        [projectId, 'tool_result']
      );
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row.details.result).toEqual(toolResultPayload.details.result);
    });

    it('should allow both tool_call and tool_result for the same request', async () => {
      await traceService.insertTraceEvent(toolCallPayload);
      await traceService.insertTraceEvent(toolResultPayload);

      const { rows } = await pool.query(
        'SELECT type FROM trace_events WHERE project_id = $1 ORDER BY timestamp',
        [projectId]
      );
      expect(rows).toHaveLength(2);
      expect(rows[0].type).toBe('tool_call');
      expect(rows[1].type).toBe('tool_result');
    });
  });

  describe('B) Ordering for UI', () => {
    const projectId = 'P1';

    it('should return events in chronological order by timestamp', async () => {
      // Insert three events with a small delay to ensure different timestamps
      const events = [
        {
          projectId,
          source: 'user',
          type: 'user_message',
          summary: 'First message',
        },
        {
          projectId,
          source: 'orion',
          type: 'orion_response',
          summary: 'First response',
        },
        {
          projectId,
          source: 'tool',
          type: 'tool_call',
          summary: 'Tool call',
          toolName: 'TestTool',
        },
      ];

      for (const event of events) {
        await traceService.insertTraceEvent(event);
        // Small delay to ensure timestamp ordering (Postgres timestamp has microsecond precision)
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const { rows } = await pool.query(
        'SELECT type, summary FROM trace_events WHERE project_id = $1 ORDER BY timestamp ASC',
        [projectId]
      );

      expect(rows).toHaveLength(3);
      expect(rows[0].type).toBe('user_message');
      expect(rows[1].type).toBe('orion_response');
      expect(rows[2].type).toBe('tool_call');
    });
  });

  describe('C) Fail‑loud behavior', () => {
    it('should throw when database insertion fails', async () => {
      // Temporarily replace the pool's query method to simulate a DB error
      const originalQuery = pool.query;
      const mockError = new Error('Simulated DB failure');
      pool.query = jest.fn().mockRejectedValue(mockError);

      const event = {
        projectId: 'P1',
        source: 'user',
        type: 'user_message',
        summary: 'Test',
      };

      await expect(traceService.insertTraceEvent(event)).rejects.toThrow(
        'Simulated DB failure'
      );

      // Restore original query method
      pool.query = originalQuery;
    });
  });
});
