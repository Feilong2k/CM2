# Future Design: Robust Patterns for Long Writes via Tools

## Problem Summary

In practice, `FileSystemTool_write_to_file` works well for:
- Normal-sized files
- Moderately long content
- Complex characters (quotes, backslashes, markdown)

The fragility appears when we try to have the model send **very long markdown documents (1000+ lines, heavy formatting)** directly as JSON arguments in a single tool_call. In those cases:
- The model often produces malformed or truncated JSON for the `content` field
- `safeParseArgs` exhausts its repair strategies and falls back to `{}`
- The write tool then fails with `path and content are required`

This is not a limitation of the filesystem or the write implementation, but of **asking the model to serialize huge blobs of text into strict JSON arguments.**

## Pattern A: Chunked Writes (Append Mode)

**Idea:** Split large documents into smaller, safe chunks and write/append them over multiple tool calls.

### API Concept

Extend the file tool to support a `mode` parameter:

```jsonc
{
  "path": ".../my_doc.md",
  "content": "chunk of text",
  "mode": "write" | "append" // default: write
}
```

### Behavior

- First call uses `mode: "write"` to create/overwrite the file
- Subsequent calls use `mode: "append"` to add additional sections

### Benefits

- Each chunk is small enough that JSON encoding + repair is reliable
- We stay compatible with the existing tool_call mechanism
- Orion (or the skill) can control chunk boundaries (e.g. per section/heading)

### Considerations

- Need to ensure correct ordering and idempotency
- The skill should guide the model to emit coherent chunks (not mid-sentence cuts)

## Pattern B: Save from Last Assistant Message (Out-of-Band Content)

**Idea:** Use tool_calls only for **metadata**, not the entire document. Let the model stream the full document as normal assistant text, then call a tool that saves that last message to disk.

### API Concept

Introduce a new tool, e.g.:

```jsonc
{
  "path": ".../my_doc.md",
  "source": "last_assistant_message"
}
```

Tool implementation:
- Looks up the content of the most recent assistant message
- Writes that content to `path` (or appends, depending on design)

### Benefits

- JSON arguments remain **small and simple** (no huge `content` field)
- The model does what it’s best at: streaming natural text
- Avoids `safeParseArgs` complexity for giant argument strings

### Considerations

- Requires the orchestrator/tool layer to have access to recent message history
- The protocol must be clearly documented in the skill so the model knows to:
  1. Produce the full document as normal text
  2. Only then call the "save last message" tool

## Why This Belongs in the Future Plan

These patterns are not strictly necessary for MVP, since:
- Most current use cases involve medium-sized files
- Chunking manually (as the user did) already works

However, as we:
- Generate longer skills (SKILL.md + references)
- Produce long-form learning materials
- Capture richer internal docs via Orion

…we will increasingly hit the JSON/tool_call limits.

Implementing **Pattern A (append mode)** and/or **Pattern B (save from last message)** will make the platform **much more robust** for long document generation while keeping a clean separation between:
- Natural-language generation (LLM side)
- File I/O and persistence (tool side).

