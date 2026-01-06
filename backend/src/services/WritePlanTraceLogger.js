const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'write_plan_trace.ndjson');

class WritePlanTraceLogger {
  static async log(event) {
    try {
      // Ensure timestamp and basic shape
      const enriched = {
        timestamp: new Date().toISOString(),
        ...event,
      };

      // Ensure logs directory exists
      await fs.promises.mkdir(LOG_DIR, { recursive: true });

      const line = JSON.stringify(enriched) + '\n';
      await fs.promises.appendFile(LOG_FILE, line, 'utf8');
    } catch (e) {
      // Optional: silently ignore, or use console.error in debug builds
    }
  }
}

module.exports = WritePlanTraceLogger;
