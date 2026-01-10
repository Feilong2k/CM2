const crypto = require('crypto');
const { execSync } = require('child_process');

/**
 * Cache entry structure
 */
class CacheEntry {
  constructor(value, timestamp, fingerprint) {
    this.value = value;        // Cached tool result
    this.timestamp = timestamp; // Date.now()
    this.fingerprint = fingerprint; // Git hash or DB schema version
    this.accessTime = timestamp;   // For LRU tracking
  }
}

/**
 * Tool Result Cache Service
 * 
 * Caches tool results with TTL, fingerprint-based invalidation, and LRU eviction.
 */
class ToolResultCacheService {
  constructor(options = {}) {
    // Configuration
    this.ttlSeconds = options.ttlSeconds || 600; // 10 minutes default
    this.maxSize = options.maxSize || 100;
    this.traceStore = options.traceStore; // For emitting trace events
    this.databaseTool = options.databaseTool; // For getting DB schema version
    this.fileSystemTool = options.fileSystemTool; // For checking git hash
    
    // Storage
    this.cache = new Map(); // key -> CacheEntry
    this.accessOrder = []; // Array of keys for LRU tracking
    
    // Concurrency control: map from cache key to promise of pending execution
    this.pendingPromises = new Map();
  }
  
  /**
   * Main public method - called by ToolOrchestrator
   * @param {Object} toolRegistry - registry of tool implementations
   * @param {Object} toolCall - tool call object with function name and arguments
   * @param {Object} context - execution context with projectId, requestId, etc.
   * @returns {Promise<Object>} tool result
   */
  async executeWithCache(toolRegistry, toolCall, context) {
    const projectId = context.projectId;
    const cacheKey = this._generateCacheKey(toolCall, projectId);
    
    // 1. Check for existing pending promise
    let pending = this.pendingPromises.get(cacheKey);
    if (pending) {
      this._emitTrace('cache_pending', { toolCall, cacheKey });
      return await pending;
    }
    
    // 2. Create a new pending promise placeholder synchronously
    let resolvePending, rejectPending;
    const pendingPromise = new Promise((resolve, reject) => {
      resolvePending = resolve;
      rejectPending = reject;
    });
    this.pendingPromises.set(cacheKey, pendingPromise);
    
    try {
      // 3. Try to get from cache, handling errors
      let cached;
      try {
        cached = await this._getWithValidation(cacheKey, toolCall);
      } catch (error) {
        // Log cache read error and treat as miss
        this._emitTrace('cache_error', { toolCall, cacheKey, error: error.message });
        cached = null;
      }
      
      if (cached !== null) {
        this._emitTrace('cache_hit', { toolCall, cacheKey });
        resolvePending(cached);
        return cached;
      }
      
      // 4. Cache miss
      this._emitTrace('cache_miss', { toolCall, cacheKey });
      const result = await this._executeAndCache(toolRegistry, toolCall, context, cacheKey);
      resolvePending(result);
      return result;
    } catch (error) {
      rejectPending(error);
      throw error;
    } finally {
      // 5. Remove the pending promise
      this.pendingPromises.delete(cacheKey);
    }
  }
  
  /**
   * Execute tool and cache result
   */
  async _executeAndCache(toolRegistry, toolCall, context, cacheKey) {
    const result = await this._executeTool(toolRegistry, toolCall, context);
    
    // Only cache successful results
    if (result.success) {
      await this._set(cacheKey, result, toolCall);
    }
    
    return result;
  }
  
  /**
   * Execute a tool using ToolRunner (or direct registry call)
   */
  async _executeTool(toolRegistry, toolCall, context) {
    // For now, simulate ToolRunner execution
    // In real integration, this would call ToolRunner.executeToolCalls
    const { function: func } = toolCall;
    const [toolName, action] = func.name.split('_');
    const args = JSON.parse(func.arguments);
    
    const toolImpl = toolRegistry[toolName];
    if (!toolImpl || !toolImpl[action]) {
      throw new Error(`Tool ${toolName}.${action} not found in registry`);
    }
    
    try {
      const result = await toolImpl[action](args);
      return {
        success: true,
        result,
        attempts: 1
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        attempts: 1
      };
    }
  }
  
  /**
   * Generate cache key from tool call and project ID
   */
  _generateCacheKey(toolCall, projectId) {
    const { function: func } = toolCall;
    const toolName = func.name.split('_')[0]; // e.g., "FileSystemTool"
    const action = func.name.split('_')[1];   // e.g., "read"
    const args = JSON.parse(func.arguments);
    
    // Create stable hash (order-insensitive for objects)
    const argsHash = this._hashObject(args);
    
    return `${projectId}:${toolName}:${action}:${argsHash}`;
  }
  
  /**
   * Create consistent hash for objects regardless of key order
   */
  _hashObject(obj) {
    const sorted = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('md5').update(sorted).digest('hex');
  }
  
  /**
   * Get current fingerprint for a tool
   */
  async _getCurrentFingerprint(toolName) {
    if (toolName.includes('FileSystemTool')) {
      // Get current git hash for filesystem operations
      return this._getGitHash();
    } else if (toolName.includes('DatabaseTool')) {
      // Get current DB schema version
      if (this.databaseTool && this.databaseTool.get_schema_version) {
        return await this.databaseTool.get_schema_version();
      }
      return 'default';
    }
    return 'default'; // For tools without fingerprint requirements
  }
  
  /**
   * Get git hash of current repository
   */
  _getGitHash() {
    try {
      return execSync('git rev-parse HEAD').toString().trim();
    } catch (error) {
      // Fallback to file modification times if git not available
      return Date.now().toString(); // Simplified fallback
    }
  }
  
  /**
   * Retrieve from cache with TTL and fingerprint validation
   */
  async _getWithValidation(key, toolCall) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check TTL
    const now = Date.now();
    if (now - entry.timestamp > this.ttlSeconds * 1000) {
      this.cache.delete(key);
      this._removeFromAccessOrder(key);
      this._emitTrace('cache_expired', { key, reason: 'TTL' });
      return null;
    }
    
    // Check fingerprint
    const currentFingerprint = await this._getCurrentFingerprint(toolCall.function.name);
    if (entry.fingerprint !== currentFingerprint) {
      this.cache.delete(key);
      this._removeFromAccessOrder(key);
      this._emitTrace('cache_invalidated', { key, reason: 'fingerprint', oldFingerprint: entry.fingerprint, newFingerprint: currentFingerprint });
      return null;
    }
    
    // Update LRU access time
    entry.accessTime = now;
    this._updateAccessOrder(key);
    
    return entry.value;
  }
  
  /**
   * Store result in cache
   */
  async _set(key, value, toolCall) {
    // Get fingerprint for this tool
    const fingerprint = await this._getCurrentFingerprint(toolCall.function.name);
    
    const entry = new CacheEntry(value, Date.now(), fingerprint);
    
    // Check size and evict if needed
    if (this.cache.size >= this.maxSize) {
      const lruKey = this.accessOrder.shift();
      this.cache.delete(lruKey);
      this._emitTrace('cache_eviction', { key: lruKey, reason: 'LRU' });
    }
    
    this.cache.set(key, entry);
    this.accessOrder.push(key);
  }
  
  /**
   * Update access order for LRU
   */
  _updateAccessOrder(key) {
    // Move key to end (most recently used)
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }
  }
  
  /**
   * Remove key from access order
   */
  _removeFromAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
  
  /**
   * Emit trace event if traceStore is available
   */
  _emitTrace(eventType, details) {
    if (this.traceStore && this.traceStore.emit) {
      this.traceStore.emit({
        type: eventType,
        timestamp: new Date().toISOString(),
        details: {
          ...details,
          cacheSize: this.cache.size,
          maxSize: this.maxSize,
          ttlSeconds: this.ttlSeconds
        }
      });
    }
  }
  
  // Public methods for testing
  _get(key) {
    const entry = this.cache.get(key);
    return entry ? entry.value : null;
  }
  
  _delete(key) {
    const existed = this.cache.delete(key);
    if (existed) {
      this._removeFromAccessOrder(key);
    }
    return existed;
  }
  
  // For testing: clear cache
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.pendingPromises.clear();
  }
  
  // For testing: get stats
  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlSeconds: this.ttlSeconds,
      hitRate: 0 // Not tracked for simplicity
    };
  }
}

module.exports = ToolResultCacheService;
