/**
 * Demo script for ToolResultCacheService
 * 
 * This script demonstrates how the cache works and creates a log file
 * that you can view to see cache hits/misses.
 */

const fs = require('fs');
const path = require('path');
const ToolResultCacheService = require('../src/services/ToolResultCacheService');

// Create a log file for cache events
const logFile = path.join(__dirname, 'cache_demo.log');
console.log(`Cache events will be logged to: ${logFile}`);

// Clear previous log
if (fs.existsSync(logFile)) {
  fs.unlinkSync(logFile);
}

// Custom trace store that writes to log file and console
class LogTraceStore {
  emit(event) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} [${event.type}] ${JSON.stringify(event.details, null, 2)}\n`;
    
    // Write to file
    fs.appendFileSync(logFile, logEntry, 'utf8');
    
    // Also log to console for immediate feedback
    console.log(`[Trace] ${event.type}:`, event.details?.toolCall?.function?.name || event.details?.reason || '');
  }
}

// Mock tool registry
const mockToolRegistry = {
  FileSystemTool: {
    read: async (args) => {
      const log = `FileSystemTool.read called with: ${JSON.stringify(args)}`;
      console.log(`🔧 ${log}`);
      fs.appendFileSync(logFile, `🔧 ${log}\n`, 'utf8');
      
      // Simulate reading a file
      return {
        content: `Mock content of ${args.path}`,
        exists: true,
        size: 1024
      };
    },
    write: async (args) => {
      const log = `FileSystemTool.write called with: ${JSON.stringify(args)}`;
      console.log(`🔧 ${log}`);
      fs.appendFileSync(logFile, `🔧 ${log}\n`, 'utf8');
      
      // Simulate writing a file
      return { success: true, bytesWritten: args.content.length };
    }
  },
  DatabaseTool: {
    query: async (args) => {
      const log = `DatabaseTool.query called with: ${JSON.stringify(args)}`;
      console.log(`🔧 ${log}`);
      fs.appendFileSync(logFile, `🔧 ${log}\n`, 'utf8');
      
      // Simulate database query
      return { rows: [{ id: 1, data: 'sample' }], rowCount: 1 };
    }
  }
};

// Mock database tool for schema version
const mockDatabaseTool = {
  get_schema_version: async () => {
    return 'v1.0.0'; // Static version for demo
  }
};

async function runDemo() {
  console.log('🚀 Starting ToolResultCacheService Demo\n');
  fs.appendFileSync(logFile, '🚀 Starting ToolResultCacheService Demo\n', 'utf8');
  
  // Create cache service
  const cacheService = new ToolResultCacheService({
    ttlSeconds: 10, // 10 seconds for demo
    maxSize: 5,
    traceStore: new LogTraceStore(),
    databaseTool: mockDatabaseTool
  });
  
  const projectId = 123;
  const requestId = 'demo-request-1';
  
  // Create a tool call for FileSystemTool.read
  const toolCall1 = {
    id: 'call_1',
    function: {
      name: 'FileSystemTool_read',
      arguments: JSON.stringify({ path: 'test.txt', encoding: 'utf8' })
    }
  };
  
  const context = { projectId, requestId };
  
  console.log('\n📤 First call (should be cache miss):');
  const start1 = Date.now();
  const result1 = await cacheService.executeWithCache(mockToolRegistry, toolCall1, context);
  const time1 = Date.now() - start1;
  console.log(`✅ Result: ${JSON.stringify(result1.result)}`);
  console.log(`⏱️  Time: ${time1}ms`);
  
  console.log('\n📤 Second call (should be cache hit):');
  const start2 = Date.now();
  const result2 = await cacheService.executeWithCache(mockToolRegistry, toolCall1, context);
  const time2 = Date.now() - start2;
  console.log(`✅ Result: ${JSON.stringify(result2.result)}`);
  console.log(`⏱️  Time: ${time2}ms`);
  
  console.log(`\n📊 Cache hit improved speed by: ${time1 - time2}ms (${Math.round((time1 - time2) / time1 * 100)}% faster)`);
  
  // Different arguments should be cache miss
  console.log('\n📤 Third call (different file, should be cache miss):');
  const toolCall2 = {
    id: 'call_2',
    function: {
      name: 'FileSystemTool_read',
      arguments: JSON.stringify({ path: 'other.txt', encoding: 'utf8' })
    }
  };
  
  const start3 = Date.now();
  const result3 = await cacheService.executeWithCache(mockToolRegistry, toolCall2, context);
  const time3 = Date.now() - start3;
  console.log(`✅ Result: ${JSON.stringify(result3.result)}`);
  console.log(`⏱️  Time: ${time3}ms`);
  
  // Test with DatabaseTool
  console.log('\n📤 Fourth call (DatabaseTool, should be cache miss):');
  const toolCall3 = {
    id: 'call_3',
    function: {
      name: 'DatabaseTool_query',
      arguments: JSON.stringify({ query: 'SELECT * FROM users' })
    }
  };
  
  const start4 = Date.now();
  const result4 = await cacheService.executeWithCache(mockToolRegistry, toolCall3, context);
  const time4 = Date.now() - start4;
  console.log(`✅ Result: ${JSON.stringify(result4.result)}`);
  console.log(`⏱️  Time: ${time4}ms`);
  
  console.log('\n📤 Fifth call (same DatabaseTool, should be cache hit):');
  const start5 = Date.now();
  const result5 = await cacheService.executeWithCache(mockToolRegistry, toolCall3, context);
  const time5 = Date.now() - start5;
  console.log(`✅ Result: ${JSON.stringify(result5.result)}`);
  console.log(`⏱️  Time: ${time5}ms`);
  
  // Show cache stats
  console.log('\n📈 Cache Statistics:');
  const stats = cacheService.stats();
  console.log(`   Size: ${stats.size}/${stats.maxSize}`);
  console.log(`   TTL: ${stats.ttlSeconds}s`);
  
  // Wait a bit then test TTL expiration
  console.log('\n⏳ Waiting 11 seconds for TTL expiration...');
  await new Promise(resolve => setTimeout(resolve, 11000));
  
  console.log('\n📤 Sixth call (after TTL, should be cache miss):');
  const start6 = Date.now();
  const result6 = await cacheService.executeWithCache(mockToolRegistry, toolCall1, context);
  const time6 = Date.now() - start6;
  console.log(`✅ Result: ${JSON.stringify(result6.result)}`);
  console.log(`⏱️  Time: ${time6}ms`);
  
  console.log('\n📝 Checking log file for trace events...');
  const logContent = fs.readFileSync(logFile, 'utf8');
  const cacheHits = (logContent.match(/cache_hit/g) || []).length;
  const cacheMisses = (logContent.match(/cache_miss/g) || []).length;
  
  console.log(`\n📊 Cache Performance Summary:`);
  console.log(`   Cache hits: ${cacheHits}`);
  console.log(`   Cache misses: ${cacheMisses}`);
  console.log(`   Hit rate: ${Math.round(cacheHits / (cacheHits + cacheMisses) * 100)}%`);
  
  console.log(`\n✅ Demo complete! Check ${logFile} for detailed trace events.`);
  console.log('\n📋 Sample log entries:');
  console.log(logContent.split('\n').slice(0, 10).join('\n'));
}

// Run the demo
runDemo().catch(error => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});