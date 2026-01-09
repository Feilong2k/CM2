// StepDecomposer.spec.js — JSON Schema validation tests for 2-2-3

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const StepDecomposer = require('../StepDecomposer');

const schemaPath = path.join(__dirname, '../../../step_decomposition_schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });

describe('StepDecomposer JSON Schema Validation (2-2-3)', () => {
  let decomposer;
  let mockDatabaseTool;
  let mockFileSystemTool;
  let mockTraceStore;

  const projectId = 'P1';
  const subtaskId = '2-2-3';

  // Helper to validate with ajv directly (for error message checks)
  const validate = ajv.compile(schema);

  beforeEach(() => {
    mockDatabaseTool = { create_step: jest.fn() };
    mockFileSystemTool = { file_exists: jest.fn() };
    mockTraceStore = { emit: jest.fn() };
    decomposer = new StepDecomposer({
      databaseTool: mockDatabaseTool,
      fileSystemTool: mockFileSystemTool,
      traceStore: mockTraceStore,
      projectId,
    });
  });

  // 1. Valid Payloads
  it('accepts a fully valid payload (all required fields, correct types)', async () => {
    const valid = {
      steps: [
        {
          step_number: 1,
          step_type: 'test',
          file_path: 'src/test.js',
          instructions: 'Do X',
          assigned_to: 'TaraAider',
          context_files: ['src/impl.js'],
        },
      ],
    };
    mockFileSystemTool.file_exists.mockResolvedValue(true);
    mockDatabaseTool.create_step.mockResolvedValue({ id: 1 });
    await expect(decomposer.decompose(subtaskId, valid)).resolves.toHaveProperty('success', true);
    expect(validate(valid)).toBe(true);
  });

  it('accepts valid payload with optional fields omitted', async () => {
    const valid = {
      steps: [
        {
          step_number: 1,
          step_type: 'implementation',
          file_path: 'src/test.js',
          instructions: 'Do Y',
          assigned_to: 'DevonAider',
          context_files: [],
        },
      ],
    };
    mockFileSystemTool.file_exists.mockResolvedValue(true);
    mockDatabaseTool.create_step.mockResolvedValue({ id: 2 });
    await expect(decomposer.decompose(subtaskId, valid)).resolves.toHaveProperty('success', true);
    expect(validate(valid)).toBe(true);
  });

  // 2. Missing Required Fields
  [
    ['steps', { }],
    ['file_path', { steps: [{ step_number: 1, step_type: 'test', instructions: 'X', assigned_to: 'TaraAider', context_files: [] }] }],
    ['instructions', { steps: [{ step_number: 1, step_type: 'test', file_path: 'src.js', assigned_to: 'TaraAider', context_files: [] }] }],
    ['assigned_to', { steps: [{ step_number: 1, step_type: 'test', file_path: 'src.js', instructions: 'X', context_files: [] }] }],
    ['step_type', { steps: [{ step_number: 1, file_path: 'src.js', instructions: 'X', assigned_to: 'TaraAider', context_files: [] }] }],
    ['context_files', { steps: [{ step_number: 1, step_type: 'test', file_path: 'src.js', instructions: 'X', assigned_to: 'TaraAider' }] }],
  ].forEach(([field, payload]) => {
    it(`rejects missing required field: ${field}`, async () => {
      await expect(decomposer.decompose(subtaskId, payload)).rejects.toThrow();
      expect(validate(payload)).toBe(false);
    });
  });

  // 3. Wrong Types
  [
    ['steps as string', { steps: 'not-an-array' }],
    ['step_number as string', { steps: [{ step_number: 'one', step_type: 'test', file_path: 'src.js', instructions: 'X', assigned_to: 'TaraAider', context_files: [] }] }],
    ['context_files as object', { steps: [{ step_number: 1, step_type: 'test', file_path: 'src.js', instructions: 'X', assigned_to: 'TaraAider', context_files: {} }] }],
  ].forEach(([desc, payload]) => {
    it(`rejects wrong type: ${desc}`, async () => {
      await expect(decomposer.decompose(subtaskId, payload)).rejects.toThrow();
      expect(validate(payload)).toBe(false);
    });
  });

  // 4. Invalid Enum Values
  [
    ['step_type', { steps: [{ step_number: 1, step_type: 'foo', file_path: 'src.js', instructions: 'X', assigned_to: 'TaraAider', context_files: [] }] }],
    ['assigned_to', { steps: [{ step_number: 1, step_type: 'test', file_path: 'src.js', instructions: 'X', assigned_to: 'BarAider', context_files: [] }] }],
  ].forEach(([field, payload]) => {
    it(`rejects invalid enum value for ${field}`, async () => {
      await expect(decomposer.decompose(subtaskId, payload)).rejects.toThrow();
      expect(validate(payload)).toBe(false);
    });
  });

  // 5. Extra/Unknown Fields
  it('rejects extra fields if schema is strict', async () => {
    const payload = {
      steps: [
        {
          step_number: 1,
          step_type: 'test',
          file_path: 'src/test.js',
          instructions: 'Do X',
          assigned_to: 'TaraAider',
          context_files: [],
          extra_field: 'should not be here',
        },
      ],
      extra_top: 123,
    };
    await expect(decomposer.decompose(subtaskId, payload)).rejects.toThrow();
    expect(validate(payload)).toBe(false);
  });

  // 6. Invalid Nested Structures
  it('rejects context_files as array of objects', async () => {
    const payload = {
      steps: [
        {
          step_number: 1,
          step_type: 'test',
          file_path: 'src/test.js',
          instructions: 'Do X',
          assigned_to: 'TaraAider',
          context_files: [{ path: 'src/impl.js' }],
        },
      ],
    };
    await expect(decomposer.decompose(subtaskId, payload)).rejects.toThrow();
    expect(validate(payload)).toBe(false);
  });

  // 7. Error Message Clarity
  it('provides clear error messages for invalid payloads', async () => {
    const payload = { steps: 'not-an-array' };
    try {
      await decomposer.decompose(subtaskId, payload);
    } catch (err) {
      expect(err.message).toMatch(/steps/);
      expect(err.message.length).toBeGreaterThan(5);
    }
  });

  // 8. Schema Drift Detection
  it('fails if schema file hash changes (drift detection)', () => {
    const expectedHash = 'cb831fff381082c8c4a02248fa5a00a49dbcc57fc9ead9dba38a527af19097d5';
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(JSON.stringify(schema)).digest('hex');
    expect(hash).toBe(expectedHash);
  });

  // 9. Example Payloads (add as needed from docs)
  // it('accepts valid example from docs', async () => {
  //   const example = ...;
  //   mockFileSystemTool.file_exists.mockResolvedValue(true);
  //   mockDatabaseTool.create_step.mockResolvedValue({ id: 1 });
  //   await expect(decomposer.decompose(subtaskId, example)).resolves.toHaveProperty('success', true);
  //   expect(validate(example)).toBe(true);
  // });
});