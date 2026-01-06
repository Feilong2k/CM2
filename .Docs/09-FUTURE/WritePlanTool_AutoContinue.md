# WritePlanTool Auto-Continue Feature

## Overview

Automatically detect when LLM output is truncated (no DONE received) and prompt Orion to continue writing, appending to the same file.

## Problem Statement

When writing large documents, the LLM may hit output token limits (e.g., 8000 tokens) and stop mid-content without sending the `DONE` signal. Currently, this results in:
1. Auto-finalize saves partial content
2. User must manually ask Orion to continue
3. User must know to request an append operation

## Proposed Solution

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. WritePlanTool_begin called                                   │
│    → Store target_file, operation in session                    │
│                                                                  │
│ 2. Content streams from LLM                                     │
│    → Buffer content in CLI controller                           │
│                                                                  │
│ 3. Idle timeout triggers (no DONE received)                     │
│    → Auto-finalize: save buffered content                       │
│    → Detect: truncation likely (content saved, no DONE)         │
│                                                                  │
│ 4. Auto-continue logic:                                         │
│    a. Inject message to Orion:                                  │
│       "Your output was truncated at line X. Please continue     │
│        from where you left off. End with DONE when complete."   │
│                                                                  │
│    b. Automatically call WritePlanTool_begin with:              │
│       - Same target_file                                        │
│       - operation: "append"                                     │
│       - intent: "Continue from truncation"                      │
│                                                                  │
│ 5. Repeat until DONE is received or max continuations reached   │
└─────────────────────────────────────────────────────────────────┘
```

### State Machine

```
┌──────────────┐    begin()    ┌──────────────────┐
│    IDLE      │──────────────►│ AWAITING_CONTENT │
└──────────────┘               └────────┬─────────┘
       ▲                                │
       │                    ┌───────────┴───────────┐
       │                    │                       │
       │               DONE received           Timeout (no DONE)
       │                    │                       │
       │                    ▼                       ▼
       │           ┌────────────────┐    ┌──────────────────┐
       │           │   FINALIZED    │    │ TRUNCATED_SAVED  │
       │           │   (complete)   │    │ (partial)        │
       │           └────────────────┘    └────────┬─────────┘
       │                    │                     │
       │                    │            Auto-inject "continue"
       │                    │            + auto-begin(append)
       │                    │                     │
       └────────────────────┴─────────────────────┘
```

## Implementation Details

### 1. Extend Session State

```javascript
// In orion-cli-controller.js
activeWriteSession = {
  sessionId: session_id,
  buffer: "",
  idleTimer: null,
  // NEW fields for auto-continue:
  targetFile: null,        // Store from begin() result
  operation: null,         // 'create' | 'overwrite' | 'append'
  continuationCount: 0,    // Track how many times we've continued
  receivedDone: false,     // Track if DONE was received
};
```

### 2. Store Target File from Begin

```javascript
// When WritePlanTool_begin returns, extract target_file
if (event.type === 'tool_result' && event.tool === 'WritePlanTool' && event.action === 'begin') {
  cliController.startWriteSession({
    session_id: event.result.session_id,
    target_file: event.params.target_file,  // NEW
    operation: event.params.operation,       // NEW
  });
}
```

### 3. Auto-Continue Logic

```javascript
// In CLI controller, when auto-finalize triggers:
async function handleAutoFinalize(bufferedContent) {
  const session = activeWriteSession;
  const MAX_CONTINUATIONS = 3;
  
  // Save what we have
  await finalizeWriteSession(bufferedContent);
  
  // Check if we should auto-continue
  if (!session.receivedDone && session.continuationCount < MAX_CONTINUATIONS) {
    session.continuationCount++;
    
    // Inject continuation message to agent
    await injectMessageToAgent(
      `Your file output was truncated. The content so far has been saved to "${session.targetFile}". ` +
      `Please continue writing from where you left off using WritePlanTool_begin with ` +
      `target_file="${session.targetFile}" and operation="append". ` +
      `End with DONE on its own line when the file is complete.`
    );
    
    // The agent will receive this message and should call WritePlanTool_begin(append)
    // which will start a new session and continue the flow
  } else if (session.continuationCount >= MAX_CONTINUATIONS) {
    console.log(`[Auto-continue limit reached (${MAX_CONTINUATIONS}). File may be incomplete.]`);
  }
}
```

### 4. Message Injection

```javascript
// New method needed in orion-cli.js
async function injectMessageToAgent(message) {
  // Option A: Push to agent's message history and trigger new turn
  // Option B: Have agent expose a method for injecting system/user messages
  
  // Simplest approach: call processTaskStreaming with the continuation prompt
  for await (const event of this.agent.processTaskStreaming(message)) {
    // Handle events as usual
  }
}
```

### 5. Wire Up onPromptBack

```javascript
// In orion-cli.js init()
this.cliController = createOrionCliController({
  http: { post: ... },
  console: { log: ..., error: ..., warn: ... },
  onPromptBack: async (message) => {
    // Inject as a user message and process
    await this.injectAndProcess(message);
  },
  onAutoFinalize: async (session) => {
    // Called when auto-finalize happens without DONE
    if (session.continuationCount < MAX_CONTINUATIONS) {
      await this.triggerContinuation(session);
    }
  },
});
```

## Configuration

```javascript
const AUTO_CONTINUE_CONFIG = {
  enabled: true,
  maxContinuations: 3,          // Max auto-continue attempts
  continuationDelayMs: 1000,    // Delay before injecting continue message
  includeLineCount: true,       // Tell Orion how many lines were saved
};
```

## Edge Cases

| Case | Handling |
|------|----------|
| Empty buffer on auto-finalize | Don't continue, abandon session |
| Max continuations reached | Save what we have, warn user |
| Orion doesn't understand | Falls back to manual continue |
| Network failure during append | Same retry logic as regular finalize |
| Circular continuation | Detect same content repeated, abort |

## Testing Requirements

### Unit Tests

```javascript
describe('Auto-continue feature', () => {
  it('should detect truncation when no DONE received');
  it('should inject continuation message after auto-finalize');
  it('should track continuation count');
  it('should respect max continuations limit');
  it('should not continue if buffer is empty');
  it('should use append operation for continuation');
});
```

### Integration Tests

```javascript
describe('Auto-continue integration', () => {
  it('should complete a document that exceeds token limit');
  it('should properly append content to existing file');
  it('should handle multiple continuations');
});
```

## Estimated Effort

| Task | Time |
|------|------|
| Extend session state | 15 min |
| Store target file from begin | 15 min |
| Implement auto-continue logic | 30 min |
| Wire up message injection | 30 min |
| Write unit tests | 30 min |
| Integration testing | 30 min |
| **Total** | **~2.5 hours** |

## Dependencies

- WritePlanTool append operation (✅ exists)
- CLI controller session state (✅ exists)
- Message injection to agent (needs implementation)

## Success Criteria

1. Large documents (>8000 tokens) complete successfully
2. Auto-continue is transparent to user
3. Max 3 continuation attempts
4. Clear logging of continuation events
5. Fallback to manual continue if auto fails

## Future Enhancements

1. **Smart continuation** - Include last few lines in prompt so Orion knows exactly where to continue
2. **Progress tracking** - Show "Part 1/3 saved, continuing..."
3. **Configurable limits** - Allow user to set max_tokens and max_continuations
4. **Resume from failure** - If CLI crashes, resume from saved partial content

---

*Created: 2026-01-06*
*Status: Future Enhancement*
*Priority: Medium*
*Estimated Effort: 2.5 hours*

