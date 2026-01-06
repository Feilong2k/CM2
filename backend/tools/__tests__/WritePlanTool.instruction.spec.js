/**
 * WritePlanTool.begin() Instruction Message Tests (Subtask 2-3-5)
 *
 * These tests define the contract for the instruction message returned
 * by WritePlanTool.begin(). The instruction is sent back to the LLM so
 * it knows how to stream content into the active write session.
 *
 * Contract for Devon:
 * - begin({ target_file, operation, intent }) MUST return an object that includes:
 *   - session_id: string
 *   - stage: 'awaiting_content'
 *   - instruction: string (non-empty)
 * - instruction text MUST:
 *   - Tell the LLM to stream/write content for the target file
 *   - Mention a DONE signal (e.g. "DONE" on its own line) to finish
 *   - Discourage extra explanation (e.g. "no explanation", "immediately", "directly")
 */

const WritePlanTool = require('../WritePlanTool');

describe('WritePlanTool.begin() instruction message', () => {
  let tool;

  beforeEach(() => {
    WritePlanTool.clearAllSessions();
    tool = new WritePlanTool();
  });

  it('should include instruction field in return value', async () => {
    const result = await tool.begin({
      target_file: 'test.md',
      operation: 'create',
      intent: 'Test file',
    });

    expect(result).toHaveProperty('instruction');
    expect(typeof result.instruction).toBe('string');
    expect(result.instruction.length).toBeGreaterThan(0);
  });

  it('instruction should mention streaming content', async () => {
    const result = await tool.begin({
      target_file: 'test.md',
      operation: 'create',
      intent: 'Test file',
    });

    const text = result.instruction.toLowerCase();
    // Should indicate that the model should write/stream content
    expect(text).toMatch(/content|stream|write/);
  });

  it('instruction should mention DONE signal', async () => {
    const result = await tool.begin({
      target_file: 'test.md',
      operation: 'create',
      intent: 'Test file',
    });

    // DONE should appear clearly in the instruction
    expect(result.instruction).toMatch(/DONE/);
  });

  it('instruction should discourage explanation', async () => {
    const result = await tool.begin({
      target_file: 'test.md',
      operation: 'create',
      intent: 'Test file',
    });

    const text = result.instruction.toLowerCase();
    // Instruction should push the model to write content directly, not explain
    expect(text).toMatch(/no explanation|immediately|directly/);
  });
});

