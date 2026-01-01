const { getPool, closePool } = require('../../db/connection');
const ToolOrchestrator = require('../ToolOrchestrator');
const TraceStoreService = require('../../services/TraceStoreService');

describe('Orchestrator Trace Integration (Roadmap 3.2)', () => {
  let pool;
  let traceService;
  let mockAdapter;
  let mockToolRegistry;

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

  describe('Simple orchestrator loop', () => {
    it('should record llm_call, tool_call, and tool_result in trace_events', async () => {
      const projectId = 'P1';
      const requestId = 'test-request-xyz';

      // 1. Mock adapter that yields a tool call and then a final answer
      mockAdapter = {
        async *callStreaming(messages, tools, options) {
          // First chunk: tool call
          yield {
            content: '',
            tool_calls: [{
              id: 'call_abc123',
              type: 'function',
              function: {
                name: 'FileSystemTool_read_file',
                arguments: JSON.stringify({ path: '/tmp/hello.txt' }),
              },
            }],
          };
          // Second chunk: final answer (no tool calls)
          yield {
            content: 'I have read the file.',
            tool_calls: [],
          };
        },
      };

      // 2. Mock tool registry with a simple tool
      const mockToolResult = {
        success: true,
        result: 'File content: Hello, world!',
      };
      mockToolRegistry = {
        FileSystemTool: {
          read_file: jest.fn().mockResolvedValue(mockToolResult),
        },
      };

      // 3. Spy on TraceStoreService.insertTraceEvent
      const insertSpy = jest.spyOn(traceService, 'insertTraceEvent');

      // 4. Create orchestrator with a non-persisting traceEmitter
      const traceEmitter = jest.fn();

      const orchestrator = new ToolOrchestrator(mockAdapter, mockToolRegistry, {
        maxTurns: 1,
        traceEmitter,
        projectId,
        requestId,
        traceStoreService: traceService,
      });

      // 5. Run the orchestrator with a simple user message
      const messages = [{ role: 'user', content: 'Read the file /tmp/hello.txt' }];
      const tools = []; // Not needed for the mock adapter

      const events = [];
      for await (const event of orchestrator.run(messages, tools)) {
        events.push(event);
      }

      // 6. Verify that insertTraceEvent was called for the three key event types
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'llm_call',
          projectId,
        })
      );
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool_call',
          projectId,
        })
      );
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool_result',
          projectId,
        })
      );

      // 7. Verify the events were actually inserted into the database
      const { rows } = await pool.query(
        `SELECT type FROM trace_events 
         WHERE project_id = $1 
         ORDER BY timestamp ASC`,
        [projectId]
      );
      const dbEventTypes = rows.map(row => row.type);
      expect(dbEventTypes).toContain('llm_call');
      expect(dbEventTypes).toContain('tool_call');
      expect(dbEventTypes).toContain('tool_result');

      // 8. Clean up spy
      insertSpy.mockRestore();
    });
  });
});
