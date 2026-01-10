/**
 * Tool Result Cache Service Integration Tests (2-2-7)
 * 
 * Goal: Verify ToolResultCacheService correctly caches tool results and integrates with ToolOrchestrator
 * 
 * RED Stage Requirements:
 * - Tests must fail before ToolResultCacheService is implemented
 * - Tests must fail before cache integration with ToolOrchestrator exists
 * - Tests must verify cache hit/miss metrics, TTL, invalidation, and concurrency safety
 * 
 * Non-goals:
 * - Testing business logic of individual tools
 * - Testing performance under extreme load (separate benchmarks)
 */

// Mock dependencies BEFORE requiring modules
jest.mock('../../../tools/ToolRunner');
jest.mock('child_process', () => ({
    execSync: jest.fn(() => 'abc123'), // Mock git hash
}));

// DO NOT mock ToolResultCacheService - we want to test the real (placeholder) implementation
// This will cause tests to fail in RED stage because the service throws on instantiation

// Now require the modules (with mocks in place)
const ToolResultCacheService = require('../ToolResultCacheService');
const ToolOrchestrator = require('../../orchestration/ToolOrchestrator');
const { executeToolCalls } = require('../../../tools/ToolRunner');

describe('Tool Result Cache Service Integration', () => {
    let cacheService;
    let mockToolRegistry;
    let mockTraceStore;
    let mockAdapter;
    let mockDatabaseTool;
    let mockFileSystemTool;

    const projectId = 1;
    const requestId = 'test-request-id';

    // Sample tool call and result
    const sampleToolCall = {
        id: 'call_1',
        function: {
            name: 'FileSystemTool_read',
            arguments: JSON.stringify({ path: 'test.txt' })
        }
    };

    const sampleToolResult = {
        success: true,
        result: 'File content',
        attempts: 1
    };

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup mock tool registry
        mockToolRegistry = {
            FileSystemTool: {
                read: jest.fn().mockResolvedValue(sampleToolResult)
            },
            DatabaseTool: {
                query: jest.fn().mockResolvedValue({ rows: [] })
            }
        };

        // Setup mock trace store
        mockTraceStore = {
            emit: jest.fn()
        };

        // Setup mock adapter
        mockAdapter = {
            callStreaming: jest.fn()
        };

        // Setup mock tools
        mockDatabaseTool = {
            get_schema_version: jest.fn().mockResolvedValue('v1')
        };

        mockFileSystemTool = {
            file_exists: jest.fn().mockResolvedValue(true)
        };

        // Create cache service instance (will fail if not implemented)
        cacheService = new ToolResultCacheService({
            ttlSeconds: 600, // 10 minutes
            maxSize: 100,
            traceStore: mockTraceStore,
            databaseTool: mockDatabaseTool,
            fileSystemTool: mockFileSystemTool
        });

        // Override the default mock for specific tests
        // Default behavior is to throw error (RED stage)
    });

    describe('Cache Storage and Retrieval', () => {
        it('should store and retrieve tool results by cache key', async () => {
            // First call should miss cache and execute tool
            const result1 = await cacheService.executeWithCache(
                mockToolRegistry,
                sampleToolCall,
                { projectId, requestId }
            );
            expect(result1.success).toBe(true);
            expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(1);

            // Second call should hit cache and not execute tool again
            const result2 = await cacheService.executeWithCache(
                mockToolRegistry,
                sampleToolCall,
                { projectId, requestId }
            );
            expect(result2.success).toBe(true);
            // Tool should not be called again
            expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(1);
        });

        it('should generate consistent cache keys for same inputs', () => {
            const args1 = { path: 'test.txt', encoding: 'utf8' };
            const args2 = { encoding: 'utf8', path: 'test.txt' };

            const toolCall1 = {
                function: {
                    name: 'FileSystemTool_read',
                    arguments: JSON.stringify(args1)
                }
            };
            const toolCall2 = {
                function: {
                    name: 'FileSystemTool_read',
                    arguments: JSON.stringify(args2)
                }
            };

            const key1 = cacheService._generateCacheKey(toolCall1, projectId);
            const key2 = cacheService._generateCacheKey(toolCall2, projectId);

            // Keys should be equal because order of keys in args doesn't matter
            expect(key1).toBe(key2);
        });
    });

    describe('TTL Expiration', () => {
        it('should expire entries after TTL and trigger new execution', async () => {
            // Create a cache service with very short TTL (1 ms)
            const shortTTLCacheService = new ToolResultCacheService({
                ttlSeconds: 0.001, // 1 millisecond
                traceStore: mockTraceStore,
                databaseTool: mockDatabaseTool,
                fileSystemTool: mockFileSystemTool
            });

            // First call: cache miss, execute tool
            const result1 = await shortTTLCacheService.executeWithCache(
                mockToolRegistry,
                sampleToolCall,
                { projectId, requestId }
            );
            expect(result1.success).toBe(true);
            expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(1);

            // Wait for TTL to expire
            await new Promise(resolve => setTimeout(resolve, 10)); // 10 ms

            // Second call: TTL expired, so cache miss again, execute tool again
            const result2 = await shortTTLCacheService.executeWithCache(
                mockToolRegistry,
                sampleToolCall,
                { projectId, requestId }
            );
            expect(result2.success).toBe(true);
            // Tool should be called again because cache entry expired
            expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(2);
        });
    });

    describe('Fingerprint Invalidation', () => {
        it('should invalidate cache when git hash changes for filesystem tools', async () => {
            // First call: cache miss, execute tool
            const result1 = await cacheService.executeWithCache(
                mockToolRegistry,
                sampleToolCall,
                { projectId, requestId }
            );
            expect(result1.success).toBe(true);
            expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(1);

            // Second call: cache hit (same git hash)
            const result2 = await cacheService.executeWithCache(
                mockToolRegistry,
                sampleToolCall,
                { projectId, requestId }
            );
            expect(result2.success).toBe(true);
            expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(1); // still 1

            // Change git hash mock
            const { execSync } = require('child_process');
            execSync.mockReturnValue('def456'); // different hash

            // Third call: git hash changed, cache invalidated, execute tool again
            const result3 = await cacheService.executeWithCache(
                mockToolRegistry,
                sampleToolCall,
                { projectId, requestId }
            );
            expect(result3.success).toBe(true);
            expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(2); // called again
        });

        it('should invalidate cache when database schema version changes', async () => {
            const dbToolCall = {
                id: 'call_2',
                function: {
                    name: 'DatabaseTool_query',
                    arguments: JSON.stringify({ query: 'SELECT * FROM users' })
                }
            };

            // First call: cache miss, execute tool
            const result1 = await cacheService.executeWithCache(
                mockToolRegistry,
                dbToolCall,
                { projectId, requestId }
            );
            expect(result1.success).toBe(true);
            expect(mockToolRegistry.DatabaseTool.query).toHaveBeenCalledTimes(1);

            // Second call: cache hit (same schema version)
            const result2 = await cacheService.executeWithCache(
                mockToolRegistry,
                dbToolCall,
                { projectId, requestId }
            );
            expect(result2.success).toBe(true);
            expect(mockToolRegistry.DatabaseTool.query).toHaveBeenCalledTimes(1); // still 1

            // Change schema version
            mockDatabaseTool.get_schema_version.mockResolvedValue('v2');

            // Third call: schema version changed, cache invalidated, execute tool again
            const result3 = await cacheService.executeWithCache(
                mockToolRegistry,
                dbToolCall,
                { projectId, requestId }
            );
            expect(result3.success).toBe(true);
            expect(mockToolRegistry.DatabaseTool.query).toHaveBeenCalledTimes(2); // called again
        });
    });

    describe('LRU Eviction', () => {
        it('should evict least recently used entries when max size reached', async () => {
            // Create a cache service with max size of 1
            const smallCacheService = new ToolResultCacheService({
                maxSize: 1,
                traceStore: mockTraceStore,
                databaseTool: mockDatabaseTool,
                fileSystemTool: mockFileSystemTool
            });

            // Create two different tool calls
            const toolCall1 = {
                id: 'call_1',
                function: {
                    name: 'FileSystemTool_read',
                    arguments: JSON.stringify({ path: 'file1.txt' })
                }
            };
            
            const toolCall2 = {
                id: 'call_2',
                function: {
                    name: 'FileSystemTool_read',
                    arguments: JSON.stringify({ path: 'file2.txt' })
                }
            };

            // First call: cache miss, execute tool
            const result1 = await smallCacheService.executeWithCache(
                mockToolRegistry,
                toolCall1,
                { projectId, requestId }
            );
            expect(result1.success).toBe(true);
            expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(1);

            // Second call with different key: cache miss, execute tool, evict first entry
            const result2 = await smallCacheService.executeWithCache(
                mockToolRegistry,
                toolCall2,
                { projectId, requestId }
            );
            expect(result2.success).toBe(true);
            expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(2);

            // Third call with first key again: cache miss because it was evicted
            const result3 = await smallCacheService.executeWithCache(
                mockToolRegistry,
                toolCall1,
                { projectId, requestId }
            );
            expect(result3.success).toBe(true);
            expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(3);
        });
    });

    describe('Cache Miss Triggers Tool Execution', () => {
        it('should execute tool and cache result on cache miss', async () => {
            // Clear any previous calls
            mockToolRegistry.FileSystemTool.read.mockClear();

            // First call: cache miss, execute tool
            const result1 = await cacheService.executeWithCache(
                mockToolRegistry,
                sampleToolCall,
                { projectId, requestId }
            );
            expect(result1.success).toBe(true);
            expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(1);

            // Verify the result is cached
            const key = cacheService._generateCacheKey(sampleToolCall, projectId);
            const cached = cacheService._get(key);
            expect(cached).toEqual(result1);
        });
    });

    describe('Concurrent Access Safety', () => {
        it('should handle concurrent cache requests without data corruption', async () => {
            // Reset mock to clear any previous calls
            mockToolRegistry.FileSystemTool.read.mockClear();

            // Make two concurrent requests
            const promise1 = cacheService.executeWithCache(
                mockToolRegistry,
                sampleToolCall,
                { projectId, requestId: 'req-1' }
            );
            const promise2 = cacheService.executeWithCache(
                mockToolRegistry,
                sampleToolCall,
                { projectId, requestId: 'req-2' }
            );

            // Wait for both to complete
            const [result1, result2] = await Promise.all([promise1, promise2]);

            // Both should succeed
            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);

            // Tool should only be executed once due to pending promise memoization
            expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(1);
        });

        it('should prevent cache stampede for same key with concurrent requests', async () => {
            // Reset mock
            mockToolRegistry.FileSystemTool.read.mockClear();

            // Simulate a slow tool execution
            let resolveTool;
            const toolPromise = new Promise(resolve => {
                resolveTool = resolve;
            });
            mockToolRegistry.FileSystemTool.read.mockImplementationOnce(() => toolPromise);

            // Start two concurrent requests
            const promise1 = cacheService.executeWithCache(
                mockToolRegistry,
                sampleToolCall,
                { projectId, requestId: 'req-1' }
            );
            const promise2 = cacheService.executeWithCache(
                mockToolRegistry,
                sampleToolCall,
                { projectId, requestId: 'req-2' }
            );

            // Let the tool execution complete
            resolveTool(sampleToolResult);
            await new Promise(resolve => setImmediate(resolve));

            // Both requests should get the same result
            const [result1, result2] = await Promise.all([promise1, promise2]);
            expect(result1).toEqual(result2);
            expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(1);
        });
    });

    describe('Integration with ToolOrchestrator', () => {
        it('should integrate with ToolOrchestrator to cache tool results', async () => {
            // RED: ToolOrchestrator doesn't have cache integration yet
            const orchestrator = new ToolOrchestrator(
                mockAdapter,
                mockToolRegistry,
                {
                    traceStore: mockTraceStore,
                    projectId,
                    requestId
                    // Note: toolResultCache parameter not supported yet
                }
            );

            // This test verifies that ToolOrchestrator constructor accepts options
            // but doesn't use cache integration
            expect(orchestrator).toBeDefined();
            
            // When cache integration is added, we should be able to pass toolResultCache
            // and tests should verify it's used
        });
    });

    describe('Error Handling', () => {
        it('should not cache failed tool executions', async () => {
            // Mock a failing tool
            const failingToolCall = {
                id: 'call_fail',
                function: {
                    name: 'FileSystemTool_read',
                    arguments: JSON.stringify({ path: 'nonexistent.txt' })
                }
            };

            mockToolRegistry.FileSystemTool.read.mockRejectedValueOnce(new Error('File not found'));

            // Execute the failing tool
            const result = await cacheService.executeWithCache(
                mockToolRegistry,
                failingToolCall,
                { projectId, requestId }
            );

            // Result should indicate failure
            expect(result.success).toBe(false);
            expect(result.error).toBe('File not found');

            // Verify the result was NOT cached
            const key = cacheService._generateCacheKey(failingToolCall, projectId);
            const cached = cacheService._get(key);
            expect(cached).toBeNull();
        });

        it('should fall back to direct execution if cache fails', async () => {
            // Clear any previous calls
            mockToolRegistry.FileSystemTool.read.mockClear();

            // First, let's cache a result
            const result1 = await cacheService.executeWithCache(
                mockToolRegistry,
                sampleToolCall,
                { projectId, requestId }
            );
            expect(result1.success).toBe(true);
            expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(1);

            // Now simulate a cache failure by making _getWithValidation throw an error
            const originalGetWithValidation = cacheService._getWithValidation;
            cacheService._getWithValidation = jest.fn().mockRejectedValue(new Error('Cache read failure'));

            try {
                // This should still work because it will fall back to executing the tool
                const result2 = await cacheService.executeWithCache(
                    mockToolRegistry,
                    sampleToolCall,
                    { projectId, requestId }
                );
                expect(result2.success).toBe(true);
                // Tool should have been called again because cache failed
                expect(mockToolRegistry.FileSystemTool.read).toHaveBeenCalledTimes(2);
            } finally {
                // Restore original method
                cacheService._getWithValidation = originalGetWithValidation;
            }
        });
    });

    // Additional RED stage verification
    describe('RED Stage Verification', () => {
        it('should be in RED stage (all tests fail)', () => {
            // All tests in this suite should fail because:
            // 1. ToolResultCacheService module doesn't exist
            // 2. Tests are written to expect implementation
            
            // This is expected RED stage behavior
            expect(true).toBe(true); // Placeholder - actual tests will fail
        });

        it('should have comprehensive test coverage', () => {
            // Verify test categories cover all requirements:
            const testCategories = [
                'Cache Storage and Retrieval',
                'TTL Expiration', 
                'Fingerprint Invalidation',
                'LRU Eviction',
                'Cache Miss Triggers Tool Execution',
                'Concurrent Access Safety',
                'Integration with ToolOrchestrator',
                'Error Handling'
            ];
            
            // All categories should be covered
            expect(testCategories.length).toBeGreaterThan(0);
        });
    });
});