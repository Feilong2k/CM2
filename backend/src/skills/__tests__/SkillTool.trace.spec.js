/**
 * SkillTool Trace Tests (Subtask 2-3-5 - tracing layer)
 *
 * Objective:
 * - Verify that skill execution emits skill-specific trace events providing visibility into:
 *   - Skill execution start (with name + parameters)
 *   - Skill execution end (with duration and output summary)
 *   - Skill execution failures (not found, missing parameters)
 *   - Output truncation for large bodies
 *
 * Design decisions (contract for Devon):
 * - Add optional `traceEmitter` parameter to `executeSkill(args, traceEmitter?)`.
 * - When `execute: true`, `executeSkill` MUST call `traceEmitter` with:
 *   - type: 'skill_execution_start' before execution
 *   - type: 'skill_execution_end' on success
 *   - type: 'skill_execution_fail' on error
 * - Trace events should follow the structures described in the spec.
 * - Duration must be computed via Date.now() before/after execution.
 * - Output preview must be truncated to 500 chars max, with `output_chars` holding full length.
 */

const path = require('path');
const { executeSkill } = require('../../../tools/SkillTool');

describe('SkillTool tracing for skill execution', () => {
  let traceEvents;
  let traceEmitter;

  beforeEach(() => {
    traceEvents = [];
    traceEmitter = (event) => {
      traceEvents.push(event);
    };
  });

  // Test 1: Skill execution emits start trace
  it('should emit skill_execution_start trace with skill name and parameters', async () => {
    await executeSkill({
      skill_name: 'example-skill',
      parameters: { greeting: 'Hi', count: 1 },
      execute: true,
    }, traceEmitter);

    const startEvent = traceEvents.find(e => e.type === 'skill_execution_start');
    expect(startEvent).toBeDefined();
    expect(startEvent.skill_name).toBe('example-skill');
    expect(startEvent.parameters).toEqual({ greeting: 'Hi', count: 1 });
    expect(typeof startEvent.timestamp).toBe('string');
  });

  // Test 2: Skill execution emits end trace with duration
  it('should emit skill_execution_end trace with duration and output summary', async () => {
    const result = await executeSkill({
      skill_name: 'example-skill',
      parameters: { greeting: 'Hello', count: 2 },
      execute: true,
    }, traceEmitter);

    const endEvent = traceEvents.find(e => e.type === 'skill_execution_end');
    expect(endEvent).toBeDefined();
    expect(endEvent.skill_name).toBe('example-skill');
    expect(typeof endEvent.duration_ms).toBe('number');
    expect(endEvent.duration_ms).toBeGreaterThan(0);

    // For MVP we expect output summary based on the body length (or execution output)
    expect(typeof endEvent.output_chars).toBe('number');
    expect(endEvent.output_chars).toBeGreaterThan(0);
    expect(typeof endEvent.output_preview).toBe('string');
    expect(endEvent.output_preview.length).toBeLessThanOrEqual(500);
  });

  // Test 3: Failed skill execution emits error trace (unknown skill)
  it('should emit skill_execution_fail trace when skill not found', async () => {
    await expect(executeSkill({
      skill_name: 'nonexistent',
      parameters: {},
      execute: true,
    }, traceEmitter)).rejects.toThrow(/not found/i);

    const failEvent = traceEvents.find(e => e.type === 'skill_execution_fail');
    expect(failEvent).toBeDefined();
    expect(failEvent.skill_name).toBe('nonexistent');
    expect(typeof failEvent.error).toBe('string');
    expect(failEvent.error).toMatch(/not found/i);
    expect(typeof failEvent.duration_ms).toBe('number');
  });

  // Test 4: Missing required parameter emits error trace
  it('should emit skill_execution_fail trace when required parameter missing', async () => {
    await expect(executeSkill({
      skill_name: 'example-skill',
      parameters: {},
      execute: true,
    }, traceEmitter)).rejects.toThrow(/required parameter.*greeting/i);

    const failEvent = traceEvents.find(e => e.type === 'skill_execution_fail');
    expect(failEvent).toBeDefined();
    expect(failEvent.skill_name).toBe('example-skill');
    expect(typeof failEvent.error).toBe('string');
    expect(failEvent.error).toMatch(/greeting/i);
  });

  // Test 5: Trace output is truncated for large bodies
  it('should truncate output in trace when body exceeds 500 chars', async () => {
    const result = await executeSkill({
      skill_name: 'large-skill',
      parameters: { greeting: 'Hello' },
      execute: true,
    }, traceEmitter);

    const endEvent = traceEvents.find(e => e.type === 'skill_execution_end');
    expect(endEvent).toBeDefined();
    expect(endEvent.skill_name).toBe('large-skill');
    expect(typeof endEvent.output_chars).toBe('number');
    expect(endEvent.output_chars).toBeGreaterThan(500);

    expect(typeof endEvent.output_preview).toBe('string');
    expect(endEvent.output_preview.length).toBeLessThanOrEqual(500);
  });
});

