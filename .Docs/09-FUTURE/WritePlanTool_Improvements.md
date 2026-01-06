# WritePlanTool Future Improvements

## Overview

This document captures critiques and planned improvements for the WritePlanTool session protocol, based on real-world usage and architectural review.

---

## Current State (as of 2026-01-06)

### What Works
- ✅ Streaming protocol solves JSON truncation
- ✅ DONE signal for session completion
- ✅ Instruction in tool return guides LLM
- ✅ Auto-finalize saves work after timeout
- ✅ Local session routing (no HTTP dependency in CLI)
- ✅ Session lifecycle logging

### Operations Supported
- `create` - Create new file (fails if exists)
- `overwrite` - Replace entire file
- `append` - Add to end of file

---

## Improvement 1: Robust DONE Marker

### Problem
Current DONE detection looks for `DONE\n` on its own line. Edge cases can fail:
- `DONE` at end without newline
- `done` (lowercase)
- `DONE.` (with punctuation)
- Content that legitimately contains "DONE" on its own line

### Solution
Use a more unique, session-specific marker.

### Implementation

```javascript
// In WritePlanTool.begin()
const endMarker = `__END_WRITE_${sessionId}__`;
return {
  session_id: sessionId,
  stage: 'awaiting_content',
  instruction: `Start streaming content now. No explanation. When finished, write ${endMarker} on its own line.`,
  end_marker: endMarker,
};

// In CLI controller, detect the unique marker instead of "DONE"
const endMarkerPattern = /__END_WRITE_sess_[a-z0-9_]+__/;
if (endMarkerPattern.test(line)) {
  await finalizeWriteSession(buffer);
}
```

### Benefits
- Unique per session - no false positives
- Case-sensitive matching
- Won't conflict with file content

### Effort: 30 minutes

---

## Improvement 2: Context in Truncation Message

### Problem
Current truncation message says:
```
[Content saved but may be truncated. To continue, ask Orion: 'continue writing the file from where you left off']
```

User has to remember what file and where. Orion might not remember context.

### Solution
Include specific context in the message.

### Implementation

```javascript
// In CLI controller auto-finalize
const lineCount = bufferedContent.split('\n').length;
console.log(`[Content saved to: ${session.targetFile} (${lineCount} lines)]`);
console.log(`[Appears truncated. To continue, say: "Continue writing ${session.targetFile} from line ${lineCount}"]`);
```

### Requirements
- Store `targetFile` in session state (currently not tracked in CLI controller)
- Pass it from `begin()` result

### Effort: 15 minutes

---

## Improvement 3: Insert and Replace Operations

### Problem
Current operations only support:
- Create entire file
- Overwrite entire file  
- Append to end

Cannot:
- Insert content at specific line
- Replace specific section
- Find and replace patterns

### Solution
Add `patch` operation with granular edits.

### New Operation: `patch`

```javascript
WritePlanTool_begin({
  target_file: 'src/component.tsx',
  operation: 'patch',
  intent: 'Add new method to class',
  patch_spec: {
    type: 'insert_after_line',
    line: 45,
    // or
    type: 'replace_lines',
    start_line: 20,
    end_line: 30,
    // or
    type: 'replace_pattern',
    pattern: '/TODO: implement/',
    flags: 'g',
  }
});
```

### Implementation Steps

1. **Extend `begin()` to accept `patch_spec`**
2. **Store patch context in session**
3. **Modify `finalizeViaAPI()` to apply patches**:
   - Read existing file
   - Apply patch operation
   - Write result

### Patch Types

| Type | Description | Parameters |
|------|-------------|------------|
| `insert_after_line` | Insert content after line N | `line: number` |
| `insert_before_line` | Insert content before line N | `line: number` |
| `replace_lines` | Replace lines start-end | `start_line, end_line` |
| `replace_pattern` | Regex find/replace | `pattern, flags` |
| `prepend` | Add to start of file | (none) |

### Effort: 2-3 hours

---

## Improvement 4: Auto-Continue (Separate Document)

See: [WritePlanTool_AutoContinue.md](./WritePlanTool_AutoContinue.md)

### Summary
- Detect truncation (no DONE + auto-finalize)
- Inject continuation message to Orion
- Auto-start append session
- Repeat until DONE received

### Effort: 2.5 hours

---

## Improvement 5: Atomic Multi-File Operations

### Problem
If a task requires creating multiple related files:
1. Create `component.tsx` ✅
2. Create `component.spec.ts` ❌ (fails)
3. Create `component.css` (never started)

Result: Partial state, inconsistent codebase.

### Solution
Transaction-like behavior with rollback.

### Implementation

```javascript
WritePlanTool_begin_transaction({
  intent: 'Create component with tests',
  files: [
    { target_file: 'component.tsx', operation: 'create' },
    { target_file: 'component.spec.ts', operation: 'create' },
    { target_file: 'component.css', operation: 'create' },
  ],
  atomic: true,  // All or nothing
});

// Each file gets its own streaming session
// On any failure, rollback all written files
```

### Rollback Mechanism
- Track files written in transaction
- On failure, delete/restore original files
- Use temp files during write, rename on commit

### Complexity
- Need transaction state across multiple sessions
- Rollback requires backup of overwritten files
- More complex error handling

### Effort: 4-6 hours

---

## Improvement 6: Content Validation Hooks

### Problem
Whatever is buffered gets written, even if invalid:
- Invalid JSON/YAML syntax
- Incomplete SQL migrations
- Malformed code

### Solution
Validation hooks before write.

### Implementation

```javascript
// In finalizeViaAPI()
const validators = {
  '.json': validateJSON,
  '.yaml': validateYAML,
  '.yml': validateYAML,
  '.sql': validateSQL,
  '.js': validateJS,
  '.ts': validateTS,
};

const ext = path.extname(targetFile);
if (validators[ext]) {
  const validation = await validators[ext](content);
  if (!validation.valid) {
    throw new Error(`Validation failed for ${ext}: ${validation.error}`);
  }
}
```

### Validation Types

| Extension | Validation | Library |
|-----------|------------|---------|
| `.json` | JSON.parse | Built-in |
| `.yaml` | YAML parse | js-yaml |
| `.sql` | Syntax check | pg-query-parser |
| `.js/.ts` | AST parse | @babel/parser |
| `.md` | Optional lint | remark |

### Configuration

```javascript
const VALIDATION_CONFIG = {
  enabled: true,
  strict: false,  // Warn vs fail
  extensions: ['.json', '.yaml', '.sql'],
};
```

### Effort: 2-3 hours

---

## Improvement 7: Incomplete Content Detection

### Problem
Auto-finalize can save content that's clearly incomplete:
```markdown
## Section 3
This is the beginning of a very important point about—
```

### Solution
Detect incomplete endings and handle appropriately.

### Detection Heuristics

```javascript
function detectIncomplete(content) {
  const lastLine = content.trim().split('\n').pop();
  
  // Ends mid-sentence (no terminal punctuation)
  if (!/[.!?:;]$/.test(lastLine) && lastLine.length > 10) {
    return { incomplete: true, reason: 'mid-sentence' };
  }
  
  // Ends with opening bracket/brace
  if (/[\[{(]$/.test(lastLine)) {
    return { incomplete: true, reason: 'unclosed-bracket' };
  }
  
  // Markdown: ends with header but no content
  if (/^#+\s/.test(lastLine)) {
    return { incomplete: true, reason: 'empty-section' };
  }
  
  return { incomplete: false };
}
```

### Options When Incomplete

1. **Add marker**: Append `<!-- CONTENT TRUNCATED -->`
2. **Rename file**: Save as `file.incomplete.md`
3. **Prompt user**: "Content appears incomplete. Save anyway?"
4. **Auto-continue**: Trigger continuation flow

### Effort: 1 hour

---

## Priority Matrix

| Improvement | Impact | Effort | Priority |
|-------------|--------|--------|----------|
| Robust DONE marker | Medium | 30 min | **High** |
| Context in truncation | Medium | 15 min | **High** |
| Incomplete detection | Medium | 1 hour | **High** |
| Insert/Replace ops | High | 2-3 hrs | **Medium** |
| Auto-continue | High | 2.5 hrs | **Medium** |
| Content validation | Medium | 2-3 hrs | **Low** |
| Atomic multi-file | Low | 4-6 hrs | **Low** |

---

## Implementation Order Recommendation

### Phase 1: Quick Wins (1-2 hours total)
1. Robust DONE marker (30 min)
2. Context in truncation message (15 min)
3. Incomplete content detection (1 hour)

### Phase 2: Core Improvements (5 hours total)
4. Auto-continue feature (2.5 hours)
5. Insert/Replace operations (2-3 hours)

### Phase 3: Advanced Features (6-9 hours total)
6. Content validation hooks (2-3 hours)
7. Atomic multi-file operations (4-6 hours)

---

## Related Documents

- [WritePlanTool_AutoContinue.md](./WritePlanTool_AutoContinue.md) - Detailed auto-continue spec
- [WritePlanTool_MVP_Implementation.md](../04-ROADMAP/DevonPrompts/2-3-11_WritePlanTool_MVP_Implementation.md) - Original MVP spec

---

*Created: 2026-01-06*
*Status: Future Enhancements*
*Total Estimated Effort: ~15 hours*

