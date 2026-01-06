// Orion CLI Controller (Phase 3.5 MVP)
// Contract: see Tara's tests and Devon's instructions

function createOrionCliController({ http, console, onPromptBack }) {
  // Internal state
  let activeWriteSession = null;
  const promptBackCallback = onPromptBack || null;
  const IDLE_TIMEOUT_MS = 2000; // 2 seconds

  function getCliState() {
    // Return a snapshot for tests
    return {
      activeWriteSession: activeWriteSession
        ? {
            sessionId: activeWriteSession.sessionId,
            buffer: activeWriteSession.buffer,
            idleTimer: activeWriteSession.idleTimer,
          }
        : null,
    };
  }

  function startWriteSession({ session_id }) {
    if (activeWriteSession && activeWriteSession.idleTimer) {
      clearTimeout(activeWriteSession.idleTimer);
    }
    activeWriteSession = {
      sessionId: session_id,
      buffer: "",
      idleTimer: null,
    };
  }

  async function handleAssistantMessage(text) {
    if (!activeWriteSession) {
      // No session: ignore (Phase 3)
      return;
    }

    // Buffer the text
    activeWriteSession.buffer += text;

    // Clear existing idle timer on new content
    if (activeWriteSession.idleTimer) {
      clearTimeout(activeWriteSession.idleTimer);
      activeWriteSession.idleTimer = null;
    }

    // Check for DONE line (exact match, any line)
    const buffer = activeWriteSession.buffer;
    const doneMatch = buffer.match(/^([\s\S]*?)^DONE\r?\n?/m);
    if (doneMatch) {
      let content = doneMatch[1];
      if (!content.endsWith('\n')) content += '\n';
      // Only call finalizeWriteSession once, and do not retry inside finalizeWriteSession
      await finalizeWriteSession(content);
      return;
    }

    // No DONE: start idle timer with max 3 prompts, then auto-finalize
    const MAX_IDLE_PROMPTS = 3;
    let idlePromptCount = 0;
    
    const startIdleTimer = () => {
      if (!activeWriteSession) return;
      
      activeWriteSession.idleTimer = setTimeout(async () => {
        if (!activeWriteSession) return;
        
        idlePromptCount++;
        
        if (idlePromptCount <= MAX_IDLE_PROMPTS) {
          // Prompt the user/LLM
          const message = "If you're finished writing, please write DONE on its own line. Otherwise, continue with your content.";
          if (promptBackCallback) {
            promptBackCallback(message);
          } else {
            console.log(message);
          }
          startIdleTimer();
        } else {
          // After max prompts, auto-finalize with buffered content
          const bufferedContent = activeWriteSession.buffer || '';
          if (bufferedContent.trim().length > 0) {
            console.log("[Auto-finalizing write session - no DONE received]");
            await finalizeWriteSession(bufferedContent);
            console.log("[Content saved but may be truncated. To continue, ask Orion: 'continue writing the file from where you left off']");
          } else {
            console.warn("[No content to write - abandoning session]");
            activeWriteSession = null;
          }
        }
      }, IDLE_TIMEOUT_MS);
    };
    startIdleTimer();
  }

  async function finalizeWriteSession(content) {
    const sessionId = activeWriteSession.sessionId;
    let attempts = 0;
    let success = false;
    let lastError = null;

    // Clear idle timer when finalizing
    if (activeWriteSession && activeWriteSession.idleTimer) {
      clearTimeout(activeWriteSession.idleTimer);
      activeWriteSession.idleTimer = null;
    }

    // Only allow up to 2 attempts total, and only retry on network error (thrown)
    while (attempts < 2 && !success) {
      attempts++;
      let shouldRetry = false;
      try {
        const resp = await http.post("/api/write-session/finalize", {
          session_id: sessionId,
          content,
        });
        if (resp.status === 200) {
          activeWriteSession = null;
          return;
        } else if (resp.status === 413 && resp.data && resp.data.error) {
          console.error(
            "Content too large: " + resp.data.error
          );
          return;
        } else if (resp.status === 400 && resp.data && resp.data.error) {
          console.error(
            "Content validation failed: " + resp.data.error
          );
          return;
        } else {
          console.error(
            "Unexpected error from backend: " +
              (resp.data && resp.data.error ? resp.data.error : resp.status)
          );
          return;
        }
      } catch (err) {
        lastError = err;
        if (attempts === 1) {
          console.warn("Failed to connect to backend, retrying...");
          shouldRetry = true;
        }
      }
      if (!shouldRetry) break;
    }
    // If both attempts failed due to network, do not clear session, just warn
  }

  return {
    startWriteSession,
    handleAssistantMessage,
    getCliState,
  };
}

module.exports = createOrionCliController;
