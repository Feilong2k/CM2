const { getPool } = require('../db/connection');

class TraceStoreService {
  constructor({ pool, projectId } = {}) {
    this.pool = pool || getPool();
    this.projectId = projectId || null;
  }

  /**
   * Convenience wrapper used by higher-level services to emit semantic trace events.
   *
   * For now we only implement the minimal mapping required by ContextBuilder tests.
   */
  async emit(eventName, payload = {}) {
    const resolvedProjectId = payload.projectId || this.projectId;
    if (!resolvedProjectId) {
      throw new Error('TraceStoreService.emit: projectId is required');
    }

    switch (eventName) {
      case 'context_build_started': {
        const { stepId } = payload;
        return this.insertTraceEvent({
          projectId: resolvedProjectId,
          source: 'ContextBuilder',
          type: 'context_build_started',
          summary: `Context build started for step ${stepId}`,
          details: { stepId },
        });
      }

      case 'context_build_completed': {
        const { stepId, targetFile, contextFileCount, agentType } = payload;
        return this.insertTraceEvent({
          projectId: resolvedProjectId,
          source: 'ContextBuilder',
          type: 'context_build_completed',
          summary: `Context build completed for step ${stepId}`,
          details: { stepId, targetFile, contextFileCount, agentType },
        });
      }

      default:
        // Keep simple for now: unknown events are ignored.
        return;
    }
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

  // Static for Tara's tests
  static async insertTraceEvent(event) {
    // This is a no-op for production, but Tara's tests will mock this method.
    // Do nothing here.
  }
}

module.exports = TraceStoreService;
