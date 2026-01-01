const { getPool } = require('../db/connection');

class HistoryLoaderService {
  constructor({ pool } = {}) {
    this.pool = pool || getPool();
  }

  /**
   * Load recent chat history for a project.
   * @param {Object} options
   * @param {string} options.projectId - Project external ID
   * @param {number} options.limit - Maximum number of messages to return (default 20)
   * @returns {Promise<Array>} Array of chat message rows in chronological order (oldest first)
   * @throws {Error} If database query fails (fail-loud)
   */
  async loadRecentChatHistory({ projectId, limit = 20 }) {
    // Validate required parameters
    if (!projectId) {
      throw new Error('projectId is required');
    }

    const query = `
      SELECT external_id, sender, content, metadata, created_at
      FROM chat_messages
      WHERE external_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [projectId, limit]);

    // Reverse to get chronological order (oldest first)
    const rows = result.rows.reverse();

    // Process metadata: if present but malformed, set to null
    return rows.map(row => ({
      ...row,
      metadata: this._safeParseMetadata(row.metadata),
      created_at: new Date(row.created_at) // Ensure it's a Date object
    }));
  }

  /**
   * Safely parse metadata JSON. Returns null if parsing fails.
   * @param {any} metadata - Raw metadata from database
   * @returns {Object|null} Parsed metadata or null
   */
  _safeParseMetadata(metadata) {
    if (metadata === null || metadata === undefined) {
      return null;
    }

    try {
      // If it's already an object, return it
      if (typeof metadata === 'object') {
        return metadata;
      }

      // If it's a string, try to parse it
      if (typeof metadata === 'string') {
        return JSON.parse(metadata);
      }

      // For any other type, return null
      return null;
    } catch (error) {
      // Malformed JSON or other parsing error
      return null;
    }
  }
}

module.exports = HistoryLoaderService;
