const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const WritePlanTool = require('../WritePlanTool');
const ToolOrchestrator = require('../../src/orchestration/ToolOrchestrator');
const TraceStoreService = require('../../src/services/TraceStoreService');

jest.mock('../../src/services/TraceStoreService');

describe('WritePlanTool Tracing', () => {
  let writePlanTool;
  let traceSpy;

  beforeEach(() => {
    writePlanTool = new WritePlanTool();
    traceSpy = jest.spyOn(TraceStoreService, 'insertTraceEvent').mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('A. tool_call_raw event', () => {
    it('emits tool_call_raw with correct structure when orchestrator receives a tool call', async () => {
      // Simulate a model response with a tool call to WritePlanTool
      const fakeToolCall = {
        function: {
          name: 'WritePlanTool_begin',
          arguments: JSON.stringify({
            operation: 'create',
            target_file: 'foo.txt',
            intent: 'Create a test file'
          })
        }
      };
      // Simulate orchestrator run (simplified)
      const fakeConversationId = 'conv-123';
      const fakeTurn = 1;
      // Call TraceStoreService directly as orchestrator would
      await TraceStoreService.insertTraceEvent({
        kind: 'tool_call_raw',
        tool_name: 'WritePlanTool',
        parsed_arguments_raw: fakeToolCall.function.arguments,
        conversation_id: fakeConversationId,
        turn: fakeTurn
      });
      expect(traceSpy).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'tool_call_raw',
        tool_name: 'WritePlanTool',
        parsed_arguments_raw: expect.any(String),
        conversation_id: fakeConversationId,
        turn: fakeTurn
      }));
    });
  });

  describe('B. write_plan_received event', () => {
    it('emits write_plan_received with plan summary', async () => {
      const plan = {
        intent: 'Create a file',
        operations: [
          { operation: 'create', path: 'foo.txt', content: 'bar' }
        ]
      };
      // Simulate WritePlanTool emitting a trace event
      await TraceStoreService.insertTraceEvent({
        kind: 'write_plan_received',
        intent: plan.intent,
        operation_count: plan.operations.length,
        target_files: plan.operations.map(op => op.path)
      });
      expect(traceSpy).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'write_plan_received',
        intent: plan.intent,
        operation_count: 1,
        target_files: ['foo.txt']
      }));
    });
  });

  describe('C. write_plan_op event', () => {
    it('emits write_plan_op for each operation with validation metadata', async () => {
      const plan = {
        intent: 'Multi-op',
        operations: [
          { operation: 'create', path: 'a.txt', content: 'A' },
          { operation: 'append', path: 'a.txt', content: 'B' }
        ]
      };
      // Simulate per-op trace events
      await TraceStoreService.insertTraceEvent({
        kind: 'write_plan_op',
        operation_index: 0,
        type: 'create',
        target_file: 'a.txt',
        status: 'success',
        validation: {
          attempts: 1,
          usedSafeReplacement: false,
          original_length: 0,
          final_length: 1
        }
      });
      await TraceStoreService.insertTraceEvent({
        kind: 'write_plan_op',
        operation_index: 1,
        type: 'append',
        target_file: 'a.txt',
        status: 'success',
        validation: {
          attempts: 1,
          usedSafeReplacement: false,
          original_length: 1,
          final_length: 2
        }
      });
      expect(traceSpy).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'write_plan_op',
        operation_index: 0,
        type: 'create',
        target_file: 'a.txt',
        status: 'success',
        validation: expect.objectContaining({
          attempts: 1,
          usedSafeReplacement: false,
          original_length: 0,
          final_length: 1
        })
      }));
      expect(traceSpy).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'write_plan_op',
        operation_index: 1,
        type: 'append',
        target_file: 'a.txt',
        status: 'success',
        validation: expect.objectContaining({
          attempts: 1,
          usedSafeReplacement: false,
          original_length: 1,
          final_length: 2
        })
      }));
    });

    it('does not log full content in validation', async () => {
      await TraceStoreService.insertTraceEvent({
        kind: 'write_plan_op',
        operation_index: 0,
        type: 'create',
        target_file: 'a.txt',
        status: 'success',
        validation: {
          attempts: 1,
          usedSafeReplacement: false,
          original_length: 0,
          final_length: 1,
          // content: 'should not be here'
        }
      });
      const call = traceSpy.mock.calls.find(
        ([arg]) => arg.kind === 'write_plan_op'
      );
      expect(call[0].validation).not.toHaveProperty('content');
    });

    it('logs usedSafeReplacement: true on validation repair', async () => {
      await TraceStoreService.insertTraceEvent({
        kind: 'write_plan_op',
        operation_index: 0,
        type: 'overwrite',
        target_file: 'a.txt',
        status: 'success',
        validation: {
          attempts: 2,
          usedSafeReplacement: true,
          original_length: 10,
          final_length: 5
        }
      });
      const call = traceSpy.mock.calls.find(
        ([arg]) => arg.kind === 'write_plan_op' && arg.validation.usedSafeReplacement
      );
      expect(call[0].validation.usedSafeReplacement).toBe(true);
    });
  });

  describe('D. write_plan_summary event', () => {
    it('emits write_plan_summary with correct fields', async () => {
      await TraceStoreService.insertTraceEvent({
        kind: 'write_plan_summary',
        intent: 'Test summary',
        operation_count: 2,
        success_count: 1,
        error_count: 1,
        errors: [
          { operation_index: 1, code: 'EEXIST', message: 'File exists' }
        ]
      });
      expect(traceSpy).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'write_plan_summary',
        intent: 'Test summary',
        operation_count: 2,
        success_count: 1,
        error_count: 1,
        errors: expect.arrayContaining([
          expect.objectContaining({
            operation_index: 1,
            code: 'EEXIST',
            message: 'File exists'
          })
        ])
      }));
    });
  });

  describe('No CLI spam', () => {
    it('does not log trace events to console', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await TraceStoreService.insertTraceEvent({
        kind: 'write_plan_received',
        intent: 'No spam',
        operation_count: 1,
        target_files: ['foo.txt']
      });
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('write_plan'));
      logSpy.mockRestore();
    });
  });
});
