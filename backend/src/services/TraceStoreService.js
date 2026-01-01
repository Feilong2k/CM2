const { getPool } = require('../db/connection');

class TraceStoreService {
  constructor({ pool } = {}) {
    this.pool = pool || getPool();
  }

  async insertTraceEvent({
    projectId,
    source,
    type,
    summary,
    details = {},
    direction = null,
    toolName = null,
    requestId = null,
    error = null,
    metadata = null,
    phaseIndex = null,
    cycleIndex = null,
  }) {
    // Validate required fields
    if (!projectId || !source || !type || !summary) {
      throw new Error('Missing required fields: projectId, source, type, summary are required');
    }

    const query = `
      INSERT INTO trace_events (
        project_id, source, type, summary, details,
        direction, tool_name, request_id, error, metadata,
        phase_index, cycle_index
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING project_id, type, summary, timestamp;
    `;
    const values = [
      projectId,
      source,
      type,
      summary,
      details,
      direction,
      toolName,
      requestId,
      error,
      metadata,
      phaseIndex,
      cycleIndex,
    ];

    try {
      const result = await this.pool.query(query, values);
      const row = result.rows[0];
      // Ensure timestamp is a Date object
      if (row.timestamp && !(row.timestamp instanceof Date)) {
        row.timestamp = new Date(row.timestamp);
      }
      return row;
    } catch (error) {
      // Fail loud: rethrow the error
      throw error;
    }
  }
}

module.exports = TraceStoreService;
