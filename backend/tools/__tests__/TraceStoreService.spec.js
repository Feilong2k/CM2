/**
 * TraceStoreService Event Handling Tests (2-2-6)
 * 
 * Goal: Verify TraceStoreService handles all 8 event types
 * RED Condition: Currently only handles 2 events
 */

const TraceStoreService = require('../../src/services/TraceStoreService');

describe('TraceStoreService Event Handling', () => {
  let traceStore;
  let mockPool;

  beforeEach(() => {
    mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [{}] })
    };
    traceStore = new TraceStoreService({ pool: mockPool, projectId: 1 });
  });

  const testEvents = [
    {
      name: 'step_decomposition_started',
      payload: { stepId: 101, subtaskId: 1, stepCount: 3 },
      shouldStore: true // RED: Should be stored, but currently not stored
    },
    {
      name: 'step_decomposition_completed', 
      payload: { subtaskId: 1, createdCount: 3 },
      shouldStore: true // RED: Should be stored, but currently not stored
    },
    {
      name: 'step_decomposition_failed',
      payload: { subtaskId: 1, error: 'DB error', stack: '...' },
      shouldStore: true // RED: Should be stored, but currently not stored
    },
    {
      name: 'step_decomposition_warning',
      payload: { subtaskId: 1, filePath: 'large.js', size: 6000000 },
      shouldStore: true // RED: Should be stored, but currently not stored
    },
    {
      name: 'context_build_started',
      payload: { stepId: 101 },
      shouldStore: true // Already implemented
    },
    {
      name: 'context_build_completed',
      payload: { stepId: 101, targetFile: 'test.js' },
      shouldStore: true // Already implemented
    },
    {
      name: 'context_build_failed',
      payload: { stepId: 101, error: 'File missing' },
      shouldStore: true // RED: Should be stored, but currently not stored
    },
    {
      name: 'context_build_warning', 
      payload: { stepId: 101, filePath: 'large.js' },
      shouldStore: true // RED: Should be stored, but currently not stored
    }
  ];

  testEvents.forEach(({ name, payload, shouldStore }) => {
    it(`should ${shouldStore ? '' : 'not '}store ${name} event`, async () => {
      // Act
      await traceStore.emit(name, payload);
      
      // Assert
      if (shouldStore) {
        expect(mockPool.query).toHaveBeenCalled();
      } else {
        // RED: Events not handled won't call pool.query
        // Implementation needed to make this pass
        expect(mockPool.query).not.toHaveBeenCalled();
      }
    });
  });

  it('should store events with correct metadata when handled', async () => {
    // Arrange: Use an event that should be stored (context_build_started)
    const eventName = 'context_build_started';
    const payload = { stepId: 201 };

    // Act
    await traceStore.emit(eventName, payload);

    // Assert: Database insert was called with correct parameters
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO trace_events'),
      expect.arrayContaining([
        1, // projectId
        'ContextBuilder', // source
        'context_build_started', // type
        expect.stringContaining('Context build started for step 201'), // summary
        expect.objectContaining({ stepId: 201 }), // details
        expect.anything(), // direction (null)
        expect.anything(), // toolName (null)
        expect.anything(), // requestId (null)
        expect.anything(), // error (null)
        expect.anything(), // metadata (null)
        expect.anything(), // phaseIndex (null)
        expect.anything()  // cycleIndex (null)
      ])
    );
  });
});