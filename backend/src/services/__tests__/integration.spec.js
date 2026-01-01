const { getPool, closePool } = require('../../db/connection');
const MessageStoreService = require('../MessageStoreService');
const TraceStoreService = require('../TraceStoreService');

describe('Integration Tests (DATABASE_URL_TEST)', () => {
  let messageService;
  let traceService;
  let pool;

  beforeAll(async () => {
    // Ensure we are using the test database
    process.env.NODE_ENV = 'test';
    pool = getPool();
    messageService = new MessageStoreService();
    traceService = new TraceStoreService();
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean both tables before each test
    await pool.query('DELETE FROM chat_messages');
    await pool.query('DELETE FROM trace_events');
  });

  describe('MessageStoreService integration', () => {
    it('should increase chat_messages count by 1 after insertMessage', async () => {
      // Get initial count
      const initialResult = await pool.query('SELECT COUNT(*) FROM chat_messages');
      const initialCount = parseInt(initialResult.rows[0].count, 10);

      // Insert a message
      await messageService.insertMessage({
        projectExternalId: 'P1',
        sender: 'user',
        content: 'Integration test',
        metadata: { test: true },
      });

      // Get new count
      const newResult = await pool.query('SELECT COUNT(*) FROM chat_messages');
      const newCount = parseInt(newResult.rows[0].count, 10);

      expect(newCount).toBe(initialCount + 1);
    });
  });

  describe('TraceStoreService integration', () => {
    it('should increase trace_events count by 1 after insertTraceEvent', async () => {
      // Get initial count
      const initialResult = await pool.query('SELECT COUNT(*) FROM trace_events');
      const initialCount = parseInt(initialResult.rows[0].count, 10);
      console.log('initialCount', initialCount);

      // Insert a trace event
      await traceService.insertTraceEvent({
        projectId: 'P1',
        source: 'orion',
        type: 'integration_test',
        summary: 'Integration test event',
      });

      // Get new count
      const newResult = await pool.query('SELECT COUNT(*) FROM trace_events');
      const newCount = parseInt(newResult.rows[0].count, 10);
      console.log('newCount', newCount);
      
      const allRows = await pool.query('SELECT * FROM trace_events ORDER BY id');
      console.log('rows', allRows.rows.map(r => ({ id: r.id, project_id: r.project_id, type: r.type, summary: r.summary })));

      expect(newCount).toBe(initialCount + 1);
    });
  });
});
