const { getPool } = require('../db/connection');

const VALID_SENDERS = ['user', 'orion', 'system'];

class MessageStoreService {
  constructor({ pool } = {}) {
    this.pool = pool || getPool();
  }

  async insertMessage({ projectExternalId, sender, content, metadata }) {
    // Validate sender
    if (!VALID_SENDERS.includes(sender)) {
      throw new Error(`Invalid sender: ${sender}. Must be one of user, orion, system`);
    }

    const query = `
      INSERT INTO chat_messages (external_id, sender, content, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING external_id, sender, content, created_at;
    `;
    const values = [projectExternalId, sender, content, metadata || null];

    try {
      const result = await this.pool.query(query, values);
      const row = result.rows[0];
      // Ensure created_at is a Date object (Postgres returns a string, but pool might convert)
      if (row.created_at && !(row.created_at instanceof Date)) {
        row.created_at = new Date(row.created_at);
      }
      return row;
    } catch (error) {
      // Fail loud: rethrow the error
      throw error;
    }
  }
}

module.exports = MessageStoreService;
