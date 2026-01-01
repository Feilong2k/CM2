const { getPool, closePool } = require('../../db/connection');
const MessageStoreService = require('../MessageStoreService');

// Mock the console.error to keep test output clean
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe('MessageStoreService', () => {
  let service;
  let pool;

  beforeAll(async () => {
    // Ensure we are using the test database
    process.env.NODE_ENV = 'test';
    pool = getPool();
    service = new MessageStoreService();
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean the chat_messages table before each test
    await pool.query('DELETE FROM chat_messages');
  });

  describe('insertMessage', () => {
    const validMessage = {
      projectExternalId: 'P1',
      sender: 'user',
      content: 'Hello, world!',
      metadata: { key: 'value' }
    };

    it('should insert a message with the correct external_id', async () => {
      const result = await service.insertMessage(validMessage);

      expect(result).toHaveProperty('external_id', 'P1');
      expect(result).toHaveProperty('sender', 'user');
      expect(result).toHaveProperty('content', 'Hello, world!');
      expect(result).toHaveProperty('created_at');
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should allow multiple rows with the same external_id', async () => {
      await service.insertMessage(validMessage);
      await service.insertMessage(validMessage);

      const { rows } = await pool.query('SELECT COUNT(*) as count FROM chat_messages');
      expect(parseInt(rows[0].count, 10)).toBe(2);
    });

    it('should accept valid senders: user, orion, system', async () => {
      const senders = ['user', 'orion', 'system'];
      for (const sender of senders) {
        const message = { ...validMessage, sender };
        const result = await service.insertMessage(message);
        expect(result.sender).toBe(sender);
      }
    });

    it('should throw for invalid sender', async () => {
      const invalidMessage = { ...validMessage, sender: 'invalid' };
      await expect(service.insertMessage(invalidMessage)).rejects.toThrow(
        'Invalid sender: invalid. Must be one of user, orion, system'
      );
    });

    it('should throw on database error (forced by invalid table)', async () => {
      // Mock the pool's query method to simulate a DB error
      const mockError = new Error('DB error');
      const originalQuery = service.pool.query;
      service.pool.query = jest.fn().mockRejectedValue(mockError);
      await expect(service.insertMessage(validMessage)).rejects.toThrow('DB error');
      service.pool.query = originalQuery;
    });
  });
});
