const { getPool, closePool } = require('../../db/connection');
const HistoryLoaderService = require('../HistoryLoaderService');

describe('HistoryLoaderService Integration', () => {
  let pool;
  let historyService;

  beforeAll(async () => {
    // Ensure we are using the test database
    process.env.NODE_ENV = 'test';
    pool = getPool();
    historyService = new HistoryLoaderService();
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean the chat_messages table before each test
    await pool.query('DELETE FROM chat_messages');
  });

  describe('loadRecentChatHistory', () => {
    const projectId = 'P1';
    const otherProjectId = 'P2';

    it('should return empty array when no history exists', async () => {
      const history = await historyService.loadRecentChatHistory({
        projectId,
        limit: 20,
      });
      expect(history).toEqual([]);
    });

    it('should return up to limit messages for the given projectId', async () => {
      // Insert 25 messages for P1, 5 for P2
      const inserts = [];
      for (let i = 1; i <= 25; i++) {
        inserts.push(
          pool.query(
            `INSERT INTO chat_messages 
             (external_id, sender, content, metadata, created_at) 
             VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${i} seconds')`,
            [
              projectId,
              i % 2 === 0 ? 'user' : 'orion',
              `Message ${i}`,
              JSON.stringify({ seq: i }),
            ]
          )
        );
      }
      for (let i = 1; i <= 5; i++) {
        inserts.push(
          pool.query(
            `INSERT INTO chat_messages 
             (external_id, sender, content, metadata, created_at) 
             VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${i} minutes')`,
            [
              otherProjectId,
              'user',
              `Other ${i}`,
              JSON.stringify({ seq: i }),
            ]
          )
        );
      }
      await Promise.all(inserts);

      const history = await historyService.loadRecentChatHistory({
        projectId,
        limit: 20,
      });

      // Should return exactly 20 messages (the most recent 20 for P1)
      expect(history).toHaveLength(20);
      // All messages should belong to P1
      history.forEach((msg) => {
        expect(msg.external_id).toBe(projectId);
      });
      // Should be in chronological order (oldest first) because we reverse after DESC
      const contents = history.map((msg) => msg.content);
      expect(contents[0]).toBe('Message 20'); // Because we inserted 25 messages, newest is Message 1 (created_at NOW - 1 sec), oldest is Message 25 (NOW - 25 sec).
      // The query orders by created_at DESC, limit 20, then reversed. So we get messages 1-20 reversed -> 20,19,...,1.
      // Actually: let's not rely on exact ordering in test; just ensure they are sorted ascending by created_at.
      // We'll check that timestamps are increasing.
      const timestamps = history.map((msg) => new Date(msg.created_at).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
      }
    });

    it('should return messages in chronological order (oldest to newest)', async () => {
      // Insert 3 messages with known timestamps
      const baseTime = new Date('2025-01-01T00:00:00Z');
      for (let i = 0; i < 3; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        await pool.query(
          `INSERT INTO chat_messages 
           (external_id, sender, content, created_at) 
           VALUES ($1, $2, $3, $4)`,
          [
            projectId,
            'user',
            `Msg ${i}`,
            timestamp.toISOString(),
          ]
        );
      }

      const history = await historyService.loadRecentChatHistory({
        projectId,
        limit: 20,
      });

      expect(history).toHaveLength(3);
      expect(history[0].content).toBe('Msg 0');
      expect(history[1].content).toBe('Msg 1');
      expect(history[2].content).toBe('Msg 2');
    });

    it('should fail loudly when database query fails', async () => {
      // Temporarily replace pool.query to simulate a DB error
      const originalQuery = pool.query;
      const mockError = new Error('Simulated DB failure');
      pool.query = jest.fn().mockRejectedValue(mockError);

      await expect(
        historyService.loadRecentChatHistory({ projectId, limit: 20 })
      ).rejects.toThrow('Simulated DB failure');

      // Restore original query
      pool.query = originalQuery;
    });

    it('should respect the limit parameter', async () => {
      // Insert 10 messages
      for (let i = 1; i <= 10; i++) {
        await pool.query(
          `INSERT INTO chat_messages 
           (external_id, sender, content) 
           VALUES ($1, $2, $3)`,
          [projectId, 'user', `Message ${i}`]
        );
      }

      const history = await historyService.loadRecentChatHistory({
        projectId,
        limit: 5,
      });
      expect(history).toHaveLength(5);
      // Should return the 5 most recent messages (sorted chronologically after reversal)
      // Since we inserted in order, newest is Message 10, oldest is Message 1.
      // With limit 5, we get messages 6,7,8,9,10 reversed? Actually DESC gives 10,9,8,7,6; reverse => 6,7,8,9,10.
      const contents = history.map((msg) => msg.content);
      expect(contents).toEqual(['Message 6', 'Message 7', 'Message 8', 'Message 9', 'Message 10']);
    });
  });
});
