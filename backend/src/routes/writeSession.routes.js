const express = require('express');
const WritePlanTool = require('../../tools/WritePlanTool');

const router = express.Router();
const writePlanTool = new WritePlanTool();

/**
 * POST /api/write-session/begin
 * Input JSON: { intent, target_file, operation }
 */
router.post('/begin', async (req, res) => {
  try {
    const { intent, target_file, operation } = req.body;

    // Validation (also done in WritePlanTool, but we can pre-validate for clearer errors)
    if (!target_file) {
      return res.status(400).json({ error: 'target_file is required' });
    }
    if (!['create', 'overwrite', 'append'].includes(operation)) {
      return res.status(400).json({ error: 'Invalid operation type' });
    }

    const result = await writePlanTool.begin({ intent, target_file, operation });
    return res.status(200).json(result);
  } catch (error) {
    // Map known errors to HTTP status codes
    if (error.message === 'target_file is required') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Invalid operation type') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Another write session is already active. Please wait for it to complete.') {
      return res.status(409).json({ error: error.message });
    }
    // Any other error is considered internal
    console.error('Error in /begin:', error);
    return res.status(500).json({ error: 'An internal error occurred. Please try again.' });
  }
});

/**
 * POST /api/write-session/finalize
 * Input JSON: { session_id, content }
 */
router.post('/finalize', async (req, res) => {
  try {
    const { session_id, content } = req.body;

    // 10MB size limit (in bytes) – enforce before calling WritePlanTool
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (Buffer.byteLength(content, 'utf8') > MAX_SIZE) {
      return res.status(413).json({
        error: 'Content exceeds 10MB limit. Please reduce file size.',
      });
    }

    const result = await writePlanTool.finalizeViaAPI(session_id, content);
    return res.status(200).json(result);
  } catch (error) {
    // Map known errors
    if (error.message === 'Session not found or expired. Please start a new write session.') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('expired')) {
      // The expired error from WritePlanTool includes 'expired'
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Validation failed: content cannot be empty') {
      return res.status(400).json({ error: error.message });
    }
    // For other validation failures, treat as 400.
    if (error.message.startsWith('Validation failed:')) {
      return res.status(400).json({ error: error.message });
    }
    // Any other error is considered internal
    console.error('Error in /finalize:', error);
    return res.status(500).json({ error: 'An internal error occurred. Please try again.' });
  }
});

/**
 * GET /api/write-session/status
 * Query param: session_id
 */
router.get('/status', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ error: 'session_id query parameter is required' });
    }

    const result = await writePlanTool.getStatus(session_id);
    return res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Session not found or expired. Please start a new write session.') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error in /status:', error);
    return res.status(500).json({ error: 'An internal error occurred. Please try again.' });
  }
});

/**
 * DELETE /api/write-session
 * Input JSON: { session_id }
 */
router.delete('/', async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    await writePlanTool.deleteSession(session_id);
    return res.status(200).json({ message: 'Session deleted' });
  } catch (error) {
    if (error.message === 'Session not found or expired. Please start a new write session.') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error in DELETE /:', error);
    return res.status(500).json({ error: 'An internal error occurred. Please try again.' });
  }
});

module.exports = router;
