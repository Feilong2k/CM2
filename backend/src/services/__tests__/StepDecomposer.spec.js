// StepDecomposer.spec.js — JSON Schema validation tests for 2-2-3, extended for 2-2-5

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const StepDecomposer = require('../StepDecomposer');

const schemaPath = path.join(__dirname, '../../../step_decomposition_schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });

describe('StepDecomposer (2-2-5 contract)', () => {
  let decomposer;
  let mockDatabaseTool;
  let mockFileSystemTool;
  let mockTraceStore;

  const projectId = 'P1';
  const subtaskId = '2-2-5-test';

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

  // ==================== 2.1 Happy path — creates N steps and returns IDs ====================
  describe('Happy path — creates N steps and returns IDs', () => {
    it('should create 2 steps and return their IDs with trace events', async () => {
      const decompositionJson = {
        steps: [
          {
            step_number: 1,
            step_type: 'implementation',
            file_path: 'src/test_impl.js',
            instructions: 'Implement feature X',
            assigned_to: 'DevonAider',
            context_files: ['tests/test_impl.spec.js'],
          },
          {
            step_number: 2,
            step_type: 'test',
            file_path: 'tests/test_impl.spec.js',
            instructions: 'Write unit tests for feature X',
            assigned_to: 'TaraAider',
            context_files: ['src/test_impl.js'],
          },
        ],
      };

      // Mock file existence for all files
      mockFileSystemTool.file_exists.mockResolvedValue(true);
      // Mock database returns
      mockDatabaseTool.create_step
        .mockResolvedValueOnce({ id: 101 })
        .mockResolvedValueOnce({ id: 102 });

      const result = await decomposer.decompose(subtaskId, decompositionJson);

      expect(result).toEqual({
        success: true,
        stepIds: [101, 102],
      });

      // Verify file existence checks
      expect(mockFileSystemTool.file_exists).toHaveBeenCalledTimes(4); // 2 steps * (file_path + context_files)
      expect(mockFileSystemTool.file_exists).toHaveBeenCalledWith('src/test_impl.js');
      expect(mockFileSystemTool.file_exists).toHaveBeenCalledWith('tests/test_impl.spec.js');
      expect(mockFileSystemTool.file_exists).toHaveBeenCalledWith('tests/test_impl.spec.js'); // second step's file_path
      expect(mockFileSystemTool.file_exists).toHaveBeenCalledWith('src/test_impl.js'); // second step's context_files

      // Verify database calls
      expect(mockDatabaseTool.create_step).toHaveBeenCalledTimes(2);
      expect(mockDatabaseTool.create_step).toHaveBeenCalledWith({
        project_id: 'P1',
        subtask_id: subtaskId,
        step_number: 1,
        step_type: 'implementation',
        file_path: 'src/test_impl.js',
        instructions: 'Implement feature X',
        assigned_to: 'DevonAider',
        context_files: ['tests/test_impl.spec.js'],
      });
      expect(mockDatabaseTool.create_step).toHaveBeenCalledWith({
        project_id: 'P1',
        subtask_id: subtaskId,
        step_number: 2,
        step_type: 'test',
        file_path: 'tests/test_impl.spec.js',
        instructions: 'Write unit tests for feature X',
        assigned_to: 'TaraAider',
        context_files: ['src/test_impl.js'],
      });

      // Verify trace events
      expect(mockTraceStore.emit).toHaveBeenCalledWith('step_decomposition_started', {
        subtaskId,
        stepCount: 2,
      });
      expect(mockTraceStore.emit).toHaveBeenCalledWith('step_decomposition_completed', {
        subtaskId,
        createdCount: 2,
      });
    });
  });

  // ==================== 2.2 Validation errors ====================
  describe('Validation errors', () => {
    it('should reject missing steps property', async () => {
      const payload = {};
      await expect(decomposer.decompose(subtaskId, payload))
        .rejects.toThrow(/Step decomposition schema validation failed/);
      expect(mockDatabaseTool.create_step).not.toHaveBeenCalled();
    });

    it('should reject empty steps array', async () => {
      const payload = { steps: [] };
      await expect(decomposer.decompose(subtaskId, payload))
        .rejects.toThrow(/Step decomposition schema validation failed/);
      expect(mockDatabaseTool.create_step).not.toHaveBeenCalled();
    });

    it('should reject missing file_path in a step', async () => {
      const payload = {
        steps: [
          {
            step_number: 1,
            step_type: 'test',
            instructions: 'Do X',
            assigned_to: 'TaraAider',
            context_files: [],
          },
        ],
      };
      await expect(decomposer.decompose(subtaskId, payload))
        .rejects.toThrow(/Step decomposition schema validation failed/);
      expect(mockDatabaseTool.create_step).not.toHaveBeenCalled();
    });

    it('should reject missing instructions in a step', async () => {
      const payload = {
        steps: [
          {
            step_number: 1,
            step_type: 'test',
            file_path: 'src/test.js',
            assigned_to: 'TaraAider',
            context_files: [],
          },
        ],
      };
      await expect(decomposer.decompose(subtaskId, payload))
        .rejects.toThrow(/Step decomposition schema validation failed/);
      expect(mockDatabaseTool.create_step).not.toHaveBeenCalled();
    });

    it('should reject missing assigned_to in a step', async () => {
      const payload = {
        steps: [
          {
            step_number: 1,
            step_type: 'test',
            file_path: 'src/test.js',
            instructions: 'Do X',
            context_files: [],
          },
        ],
      };
      await expect(decomposer.decompose(subtaskId, payload))
        .rejects.toThrow(/Step decomposition schema validation failed/);
      expect(mockDatabaseTool.create_step).not.toHaveBeenCalled();
    });

    it('should reject missing context_files in a step', async () => {
      const payload = {
        steps: [
          {
            step_number: 1,
            step_type: 'test',
            file_path: 'src/test.js',
            instructions: 'Do X',
            assigned_to: 'TaraAider',
          },
        ],
      };
      await expect(decomposer.decompose(subtaskId, payload))
        .rejects.toThrow(/Step decomposition schema validation failed/);
      expect(mockDatabaseTool.create_step).not.toHaveBeenCalled();
    });

    it('should reject invalid step_type enum', async () => {
      const payload = {
        steps: [
          {
            step_number: 1,
            step_type: 'invalid_type',
            file_path: 'src/test.js',
            instructions: 'Do X',
            assigned_to: 'TaraAider',
            context_files: [],
          },
        ],
      };
      await expect(decomposer.decompose(subtaskId, payload))
        .rejects.toThrow(/Step decomposition schema validation failed/);
      expect(mockDatabaseTool.create_step).not.toHaveBeenCalled();
    });

    it('should reject invalid assigned_to enum', async () => {
      const payload = {
        steps: [
          {
            step_number: 1,
            step_type: 'test',
            file_path: 'src/test.js',
            instructions: 'Do X',
            assigned_to: 'InvalidAider',
            context_files: [],
          },
        ],
      };
      await expect(decomposer.decompose(subtaskId, payload))
        .rejects.toThrow(/Step decomposition schema validation failed/);
      expect(mockDatabaseTool.create_step).not.toHaveBeenCalled();
    });
  });

  // ==================== 2.3 File existence errors (unit level) ====================
  describe('File existence errors', () => {
    it('should reject if file_path does not exist', async () => {
      const decompositionJson = {
        steps: [
          {
            step_number: 1,
            step_type: 'test',
            file_path: 'src/missing.js',
            instructions: 'Do X',
            assigned_to: 'TaraAider',
            context_files: [],
          },
        ],
      };
      mockFileSystemTool.file_exists.mockResolvedValue(false);

      await expect(decomposer.decompose(subtaskId, decompositionJson))
        .rejects.toThrow(/Missing context file: src\/missing\.js/);
      expect(mockDatabaseTool.create_step).not.toHaveBeenCalled();
      expect(mockTraceStore.emit).toHaveBeenCalledWith('step_decomposition_failed', expect.objectContaining({
        subtaskId,
        filePath: 'src/missing.js',
      }));
    });

    it('should reject if a context_file does not exist', async () => {
      const decompositionJson = {
        steps: [
          {
            step_number: 1,
            step_type: 'test',
            file_path: 'src/test.js',
            instructions: 'Do X',
            assigned_to: 'TaraAider',
            context_files: ['src/missing_context.js'],
          },
        ],
      };
      // Mock file_exists: first call for file_path returns true, second for context file returns false
      mockFileSystemTool.file_exists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await expect(decomposer.decompose(subtaskId, decompositionJson))
        .rejects.toThrow(/Missing context file: src\/missing_context\.js/);
      expect(mockDatabaseTool.create_step).not.toHaveBeenCalled();
      expect(mockTraceStore.emit).toHaveBeenCalledWith('step_decomposition_failed', expect.objectContaining({
        subtaskId,
        filePath: 'src/missing_context.js',
      }));
    });

    it('should not call database if any file is missing', async () => {
      const decompositionJson = {
        steps: [
          {
            step_number: 1,
            step_type: 'test',
            file_path: 'src/test.js',
            instructions: 'Do X',
            assigned_to: 'TaraAider',
            context_files: ['src/context1.js', 'src/context2.js'],
          },
        ],
      };
      // First two files exist, third does not
      mockFileSystemTool.file_exists
        .mockResolvedValueOnce(true)   // file_path
        .mockResolvedValueOnce(true)   // context1
        .mockResolvedValueOnce(false); // context2

      await expect(decomposer.decompose(subtaskId, decompositionJson)).rejects.toThrow();
      expect(mockDatabaseTool.create_step).not.toHaveBeenCalled();
    });
  });

  // ==================== 2.4 Trace events (unit level) ====================
  describe('Trace events', () => {
    it('should emit step_decomposition_started and step_decomposition_completed on success', async () => {
      const decompositionJson = {
        steps: [
          {
            step_number: 1,
            step_type: 'test',
            file_path: 'src/test.js',
            instructions: 'Do X',
            assigned_to: 'TaraAider',
            context_files: [],
          },
        ],
      };
      mockFileSystemTool.file_exists.mockResolvedValue(true);
      mockDatabaseTool.create_step.mockResolvedValue({ id: 123 });

      await decomposer.decompose(subtaskId, decompositionJson);

      expect(mockTraceStore.emit).toHaveBeenCalledWith('step_decomposition_started', {
        subtaskId,
        stepCount: 1,
      });
      expect(mockTraceStore.emit).toHaveBeenCalledWith('step_decomposition_completed', {
        subtaskId,
        createdCount: 1,
      });
    });

    it('should emit step_decomposition_failed on validation error', async () => {
      const decompositionJson = { steps: [] }; // invalid

      await expect(decomposer.decompose(subtaskId, decompositionJson)).rejects.toThrow();

      expect(mockTraceStore.emit).toHaveBeenCalledWith('step_decomposition_failed', expect.objectContaining({
        subtaskId,
        error: expect.stringContaining('Step decomposition schema validation failed'),
      }));
    });

    it('should emit step_decomposition_failed on file existence error', async () => {
      const decompositionJson = {
        steps: [
          {
            step_number: 1,
            step_type: 'test',
            file_path: 'src/missing.js',
            instructions: 'Do X',
            assigned_to: 'TaraAider',
            context_files: [],
          },
        ],
      };
      mockFileSystemTool.file_exists.mockResolvedValue(false);

      await expect(decomposer.decompose(subtaskId, decompositionJson)).rejects.toThrow();

      expect(mockTraceStore.emit).toHaveBeenCalledWith('step_decomposition_failed', expect.objectContaining({
        subtaskId,
        filePath: 'src/missing.js',
      }));
    });
  });

  // ==================== Original schema validation tests (kept for compatibility) ====================
  describe('JSON Schema Validation (original 2-2-3 tests)', () => {
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
  });
});
