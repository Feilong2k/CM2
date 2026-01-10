const { getPool } = require('../db/connection');

class TraceStoreService {
  constructor({ pool, projectId, enableCliLogging = false, verbosity = 'info' } = {}) {
    this.pool = pool || getPool();
    this.projectId = projectId || null;
    this.enableCliLogging = enableCliLogging;
    this.verbosity = verbosity; // 'debug', 'info', 'warn', 'error'
  }

  /**
   * Map event types to log levels for verbosity filtering.
   */
  _getEventLevel(eventName) {
    if (eventName.includes('warning')) return 'warn';
    if (eventName.includes('failed')) return 'error';
    return 'info'; // started, completed, etc.
  }

  /**
   * Determine if the event should be logged based on current verbosity.
   */
  _shouldLog(eventName) {
    const level = this._getEventLevel(eventName);
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(this.verbosity);
    const eventIndex = levels.indexOf(level);
    return eventIndex >= currentIndex;
  }

  /**
   * Log to console if CLI logging is enabled and verbosity permits.
   */
  _logToConsole(eventName, payload) {
    if (!this.enableCliLogging) return;
    if (!this._shouldLog(eventName)) return;

    const level = this._getEventLevel(eventName);
    const levelTag = level !== 'info' ? `[${level.toUpperCase()}] ` : '';
    const traceTag = '[TRACE]';
    const firstArg = levelTag + traceTag;
    const payloadString = Object.entries(payload)
      .map(([key, value]) => {
        const val = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `${key}=${val}`;
      })
      .join(' ');
    console.log(firstArg, eventName, payloadString);
  }

  /**
   * Convenience wrapper used by higher-level services to emit semantic trace events.
   */
  async emit(eventName, payload = {}) {
    const resolvedProjectId = payload.projectId || this.projectId;
    if (!resolvedProjectId) {
      throw new Error('TraceStoreService.emit: projectId is required');
    }

    // Log to console if enabled
    this._logToConsole(eventName, payload);

    let eventData;
    switch (eventName) {
      case 'step_decomposition_started': {
        const { subtaskId, stepCount } = payload;
        eventData = {
          projectId: resolvedProjectId,
          source: 'StepDecomposer',
          type: 'step_decomposition_started',
          summary: `Step decomposition started for subtask ${subtaskId}`,
          details: { subtaskId, stepCount },
        };
        break;
      }
      case 'step_decomposition_completed': {
        const { subtaskId, createdCount } = payload;
        eventData = {
          projectId: resolvedProjectId,
          source: 'StepDecomposer',
          type: 'step_decomposition_completed',
          summary: `Step decomposition completed for subtask ${subtaskId}, created ${createdCount} steps`,
          details: { subtaskId, createdCount },
        };
        break;
      }
      case 'step_decomposition_failed': {
        const { subtaskId, error, stack } = payload;
        eventData = {
          projectId: resolvedProjectId,
          source: 'StepDecomposer',
          type: 'step_decomposition_failed',
          summary: `Step decomposition failed for subtask ${subtaskId}`,
          details: { subtaskId, error, stack },
          error: error,
        };
        break;
      }
      case 'step_decomposition_warning': {
        const { subtaskId, filePath, size } = payload;
        eventData = {
          projectId: resolvedProjectId,
          source: 'StepDecomposer',
          type: 'step_decomposition_warning',
          summary: `Step decomposition warning for subtask ${subtaskId}: large file ${filePath} (${size} bytes)`,
          details: { subtaskId, filePath, size },
        };
        break;
      }
      case 'context_build_started': {
        const { stepId } = payload;
        eventData = {
          projectId: resolvedProjectId,
          source: 'ContextBuilder',
          type: 'context_build_started',
          summary: `Context build started for step ${stepId}`,
          details: { stepId },
        };
        break;
      }
      case 'context_build_completed': {
        const { stepId, targetFile, contextFileCount, agentType } = payload;
        eventData = {
          projectId: resolvedProjectId,
          source: 'ContextBuilder',
          type: 'context_build_completed',
          summary: `Context build completed for step ${stepId}`,
          details: { stepId, targetFile, contextFileCount, agentType },
        };
        break;
      }
      case 'context_build_failed': {
        const { stepId, error } = payload;
        eventData = {
          projectId: resolvedProjectId,
          source: 'ContextBuilder',
          type: 'context_build_failed',
          summary: `Context build failed for step ${stepId}`,
          details: { stepId, error },
          error: error,
        };
        break;
      }
      case 'context_build_warning': {
        const { stepId, filePath } = payload;
        eventData = {
          projectId: resolvedProjectId,
          source: 'ContextBuilder',
          type: 'context_build_warning',
          summary: `Context build warning for step ${stepId}: large file ${filePath}`,
          details: { stepId, filePath },
        };
        break;
      }
      default:
        // Unknown event - ignore but log to console if enabled
        return;
    }

    // Insert into database
    return this.insertTraceEvent(eventData);
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
