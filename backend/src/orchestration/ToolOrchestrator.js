// ToolOrchestrator - Core "brain" that manages conversation loop, executes tools, and emits trace events
const crypto = require('crypto');
const { executeToolCalls } = require('../../tools/ToolRunner');
const { parseFunctionCall } = require('../../tools/functionDefinitions');

class ToolOrchestrator {
    /**
     * Constructor
     * @param {Object} adapter - The adapter instance (e.g., DS_ReasonerAdapter)
     * @param {Object} toolRegistry - Map of tool names to implementations
     * @param {Object} options - Configuration options
     * @param {number} options.maxTurns - Maximum number of conversation turns (default: 10)
     * @param {Function} options.traceEmitter - Function to emit trace events (default: console.log)
     * @param {string} options.projectId - Project ID for tracing
     * @param {string} options.requestId - Request ID for tracing (auto-generated if not provided)
     * @param {Object} options.traceStoreService - Service for persisting trace events (required for persistence)
     * @param {Object} options.messageStoreService - Service for persisting chat messages (optional)
     * @param {Object} options.toolResultCache - Instance of ToolResultCacheService for caching tool results (optional)
     */
    constructor(adapter, toolRegistry, options = {}) {
        this.adapter = adapter;
        this.toolRegistry = toolRegistry;
        this.maxTurns = options.maxTurns || 50;
        this.traceEmitter = options.traceEmitter || ((event) => console.log('[Trace]', event.type, event.summary || ''));
        this.projectId = options.projectId || null;
        this.requestId = options.requestId || crypto.randomUUID();
        this.traceStoreService = options.traceStoreService || null;
        this.messageStoreService = options.messageStoreService || null;
        this.toolResultCache = options.toolResultCache || null;
    }

    /**
     * Main orchestrator loop
     * @param {Array} messages - Initial conversation history
     * @param {Array} tools - Tool definitions for the LLM
     * @returns {AsyncIterator} Async iterator yielding events
     */
    async *run(messages, tools) {
        let currentMessages = [...messages];
        let aggregatedContent = '';
        let aggregatedToolCalls = [];
        let shouldContinue = true;
        let currentTurn = 0;
        this.currentTurn = currentTurn;

        while (shouldContinue && currentTurn < this.maxTurns) {
            currentTurn++;
            this.currentTurn = currentTurn;
            
            // Emit turn start trace
            await this._emitTrace('turn_start', {
                turn: currentTurn,
                messages: currentMessages.length
            });

            try {
                // Call the adapter for this turn
                const llmStream = this.adapter.callStreaming(currentMessages, tools, {
                    temperature: 0.7,
                    max_tokens: 8000  // Increased for large document generation
                });

                // Process the streaming response
                let turnContent = '';
                let turnToolCalls = [];
                
                for await (const chunk of llmStream) {
                    // Yield chunk events as they come
                    yield {
                        type: 'chunk',
                        content: chunk.content || '',
                        reasoning_content: chunk.reasoning_content || '',
                        tool_calls: chunk.tool_calls || []
                    };

                    // Aggregate content
                    if (chunk.content) {
                        turnContent += chunk.content;
                        aggregatedContent += chunk.content;
                    }

                    // Aggregate tool calls (need to merge partial JSON)
                    if (chunk.tool_calls && chunk.tool_calls.length > 0) {
                        turnToolCalls = this._mergeToolCalls(turnToolCalls, chunk.tool_calls);
                        aggregatedToolCalls = this._mergeToolCalls(aggregatedToolCalls, chunk.tool_calls);
                    }
                }

                // Emit LLM call trace
                await this._emitTrace('llm_call', {
                    turn: this.currentTurn,
                    content: turnContent,
                    tool_calls: turnToolCalls,
                    messages: currentMessages.length
                });

                // Check if we have tool calls to execute
                if (turnToolCalls.length === 0) {
                    // No tool calls - end of conversation
                    shouldContinue = false;
                    
                    // Emit final event
                    yield {
                        type: 'final',
                        content: aggregatedContent,
                        tool_calls: aggregatedToolCalls,
                        turns: this.currentTurn
                    };
                    
                    // Emit final trace
                    await this._emitTrace('turn_end', {
                        turn: this.currentTurn,
                        reason: 'no_tool_calls',
                        final_content: aggregatedContent
                    });
                    
                    break;
                }

                // Execute tool calls
                const toolResults = [];
                
                const TraceStoreService = require('../services/TraceStoreService');
                const WritePlanTraceLogger = require('../services/WritePlanTraceLogger');
                async function trace(event) {
                    // 1) File-based trace
                    if (WritePlanTraceLogger && typeof WritePlanTraceLogger.log === 'function') {
                        await WritePlanTraceLogger.log(event);
                    }
                    // 2) Tara’s tests: static TraceStoreService.insertTraceEvent is mocked there
                    if (TraceStoreService && typeof TraceStoreService.insertTraceEvent === 'function') {
                        try { await TraceStoreService.insertTraceEvent(event); } catch (e) {}
                    }
                }

                for (const toolCall of turnToolCalls) {
                    // Emit tool_call_raw trace BEFORE parsing/repair/execution
                    const toolName = toolCall.function?.name || 'unknown';
                    const argsRaw = toolCall.function?.arguments || '';
                    const conversationId = this.requestId || 'unknown';
                    const turnIndex = this.currentTurn;

                    await trace({
                        kind: 'tool_call_raw',
                        tool_name: toolName,
                        parsed_arguments_raw: argsRaw,
                        conversation_id: conversationId,
                        turn: turnIndex
                    });

                    // Parse the tool call using the safe parser
                    let parsedToolCall;
                    try {
                        parsedToolCall = parseFunctionCall(toolCall);
                    } catch (error) {
                        console.warn('Failed to parse tool call:', error);
                        parsedToolCall = {
                            tool: 'unknown',
                            action: 'unknown',
                            params: {}
                        };
                    }

                    // Yield tool_call event
                    const toolCallEvent = {
                        type: 'tool_call',
                        tool: parsedToolCall.tool,
                        action: parsedToolCall.action,
                        params: parsedToolCall.params,
                        rawArguments: toolCall.function?.arguments, // Capture raw args for debugging
                        toolCallId: toolCall.id
                    };
                    yield toolCallEvent;

                    // Emit tool call trace
                    await this._emitTrace('tool_call', {
                        turn: this.currentTurn,
                        tool: parsedToolCall.tool,
                        action: parsedToolCall.action,
                        params: parsedToolCall.params,
                        toolCallId: toolCall.id
                    });

                    // Prepare context for tool execution
                    const context = {
                        projectId: this.projectId,
                        requestId: this.requestId,
                        turnIndex: this.currentTurn
                    };

                    // Execute the tool call, using cache if available and applicable
                    let result;
                    try {
                        if (this.toolResultCache && this._isCacheableTool(toolCall)) {
                            // Use cache service
                            result = await this.toolResultCache.executeWithCache(
                                this.toolRegistry,
                                toolCall,
                                context
                            );
                        } else {
                            // Fall back to direct execution
                            const results = await executeToolCalls(
                                this.toolRegistry,
                                [toolCall],
                                context
                            );
                            result = results[0]; // Single tool call
                        }
                        
                        // Yield tool_result event
                        const toolResultEvent = {
                            type: 'tool_result',
                            tool: toolCallEvent.tool,
                            action: toolCallEvent.action,
                            success: result.success,
                            result: result.result,
                            error: result.error,
                            attempts: result.attempts,
                            toolCallId: toolCall.id
                        };
                        yield toolResultEvent;
                        toolResults.push(toolResultEvent);

                        // Emit tool execution trace
                        await this._emitTrace(result.success ? 'tool_success' : 'tool_error', {
                            turn: this.currentTurn,
                            tool: toolCallEvent.tool,
                            action: toolCallEvent.action,
                            success: result.success,
                            error: result.error,
                            attempts: result.attempts
                        });

                    } catch (error) {
                        // Tool execution failed
                        const errorEvent = {
                            type: 'tool_result',
                            tool: toolCallEvent.tool,
                            action: toolCallEvent.action,
                            success: false,
                            error: error.message,
                            attempts: 1,
                            toolCallId: toolCall.id
                        };
                        yield errorEvent;
                        toolResults.push(errorEvent);

                        await this._emitTrace('tool_error', {
                            turn: this.currentTurn,
                            tool: toolCallEvent.tool,
                            action: toolCallEvent.action,
                            error: error.message
                        });
                    }
                }

                // Update conversation history
                // Add assistant message with tool calls
                const sanitizedToolCalls = turnToolCalls.map(call => ({
                    id: call.id,
                    type: call.type || 'function',
                    function: {
                        name: call.function?.name || 'unknown',
                        arguments: call.function?.arguments || '{}'
                    }
                }));

                currentMessages.push({
                    role: 'assistant',
                    content: turnContent,
                    tool_calls: sanitizedToolCalls
                });

                // Add tool result messages
                for (const result of toolResults) {
                    currentMessages.push({
                        role: 'tool',
                        content: JSON.stringify({
                            success: result.success,
                            result: result.result,
                            error: result.error
                        }),
                        tool_call_id: result.toolCallId
                    });
                }

                // Emit turn end trace
                await this._emitTrace('turn_end', {
                    turn: this.currentTurn,
                    tool_calls_executed: turnToolCalls.length,
                    tool_results: toolResults.length
                });

            } catch (error) {
                // Check for ContextLimitError
                if (error.name === 'ContextLimitError') {
                    await this._emitTrace('error', {
                        turn: this.currentTurn,
                        error: error.message,
                        stack: error.stack,
                        errorType: 'context_limit'
                    });

                    yield {
                        type: 'error',
                        error: error.message,
                        turn: this.currentTurn,
                        errorType: 'context_limit'
                    };
                } else {
                    // Other errors
                    await this._emitTrace('error', {
                        turn: this.currentTurn,
                        error: error.message,
                        stack: error.stack
                    });

                    yield {
                        type: 'error',
                        error: error.message,
                        turn: this.currentTurn
                    };
                }

                shouldContinue = false;
                break;
            }
        }

        // If we reached max turns without natural completion
        if (this.currentTurn >= this.maxTurns && shouldContinue) {
            await this._emitTrace('max_turns_reached', {
                turns: this.currentTurn,
                content: aggregatedContent
            });

            // Inject prompt message for final answer
            const finalPrompt = {
                role: 'system',
                content: 'You have reached the maximum number of turns. Provide a comprehensive summary or answer based on the information you have gathered so far. Do not call any more tools. Focus on summarizing what you have learned for the user.'
            };

            // Append final prompt to messages
            const finalMessages = [...currentMessages, finalPrompt];

            await this._emitTrace('max_turns_prompt_injected', {
                turns: this.currentTurn,
                prompt: finalPrompt.content
            });

            // Make one additional LLM call for final answer (streaming)
            // Use empty tools list to discourage further tool calls
            try {
                const finalChunks = [];
                for await (const chunk of this.adapter.callStreaming(finalMessages, [], { temperature: 0.7, max_tokens: 8000 })) {
                    const chunkContent = chunk.content || '';
                    finalChunks.push(chunkContent);
                    // Yield chunk events for streaming
                    yield {
                        type: 'chunk',
                        content: chunkContent,
                        reasoning_content: chunk.reasoning_content || '',
                        tool_calls: chunk.tool_calls || []
                    };
                    // Emit trace for each chunk if it has content (for debugging)
                    if (chunkContent.trim()) {
                        await this._emitTrace('final_chunk', {
                            turn: this.currentTurn,
                            length: chunkContent.length
                        });
                    }
                }
                const finalContent = finalChunks.join('');

                await this._emitTrace('llm_call', {
                    turn: this.currentTurn,
                    content_length: finalContent.length,
                    final: true
                });

                if (finalContent.trim()) {
                    yield {
                        type: 'final',
                        content: finalContent,
                        tool_calls: [],
                        turns: this.currentTurn
                    };
                } else {
                    // If final content is empty, fall back to aggregated content
                    await this._emitTrace('final_empty', {
                        turn: this.currentTurn
                    });
                    yield {
                        type: 'final',
                        content: aggregatedContent || 'I have gathered information but cannot generate a final summary. Please ask a more specific question.',
                        tool_calls: aggregatedToolCalls,
                        turns: this.currentTurn
                    };
                }
            } catch (error) {
                await this._emitTrace('error', {
                    turns: this.currentTurn,
                    error: error.message
                });

                // Yield final event with aggregated content despite error
                yield {
                    type: 'final',
                    content: aggregatedContent,
                    tool_calls: aggregatedToolCalls,
                    turns: this.currentTurn,
                    error: error.message
                };
            }

            // End loop
            shouldContinue = false;
        }
    }

    /**
     * Merge partial tool calls from streaming chunks
     * @param {Array} existingCalls - Existing accumulated tool calls
     * @param {Array} newCalls - New tool calls from current chunk
     * @returns {Array} Merged tool calls
     */
    _mergeToolCalls(existingCalls, newCalls) {
        const merged = [...existingCalls];
        
        for (const newCall of newCalls) {
            // Match by index, as IDs might only appear in the first chunk
            const idx = newCall.index;
            const existingIndex = merged.findIndex(call => call.index === idx);
            
            if (existingIndex === -1) {
                // Create a deep copy to avoid reference issues
                const callCopy = { ...newCall };
                if (newCall.function) {
                    callCopy.function = { ...newCall.function };
                }
                merged.push(callCopy);
            } else {
                const existing = merged[existingIndex];
                
                // Update basic fields if present
                if (newCall.id) existing.id = newCall.id;
                if (newCall.type) existing.type = newCall.type;
                
                // Update function fields
                if (newCall.function) {
                    if (!existing.function) existing.function = {};
                    
                    if (newCall.function.name) {
                        existing.function.name = newCall.function.name;
                    }
                    
                    if (newCall.function.arguments) {
                        const existingArgs = existing.function.arguments || '';
                        existing.function.arguments = existingArgs + newCall.function.arguments;
                    }
                }
                
                merged[existingIndex] = existing;
            }
        }
        
        return merged;
    }

    /**
     * Check if a tool call is cacheable.
     * Currently caches FileSystemTool and DatabaseTool operations.
     * @param {Object} toolCall - The tool call object
     * @returns {boolean} True if the tool is cacheable
     */
    _isCacheableTool(toolCall) {
        const toolName = toolCall.function?.name || '';
        // Cache only context-building tools that are read-heavy and idempotent
        return toolName.startsWith('FileSystemTool_') || 
               toolName.startsWith('DatabaseTool_') ||
               toolName.startsWith('search_files');
    }

    /**
     * Recursively sanitize an object for JSON serialization.
     * Converts undefined to null, functions to strings, and ensures all values are JSON-serializable.
     */
    _sanitizeForJSON(obj) {
        if (obj === undefined || obj === null) {
            return null;
        }
        if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this._sanitizeForJSON(item));
        }
        if (typeof obj === 'object') {
            const sanitized = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    sanitized[key] = this._sanitizeForJSON(obj[key]);
                }
            }
            return sanitized;
        }
        // For functions, symbols, etc., convert to string
        return String(obj);
    }

    /**
     * Emit trace event
     * @param {string} type - Event type
     * @param {Object} data - Event data
     */
    async _emitTrace(type, data) {
        const traceEvent = {
            type,
            timestamp: new Date().toISOString(),
            projectId: this.projectId,
            requestId: this.requestId,
            turn: this.currentTurn,
            ...data
        };
        
        // Emit via the configured trace emitter (e.g., console.log)
        this.traceEmitter(traceEvent);
        
        // Persist to database if traceStoreService is available
        if (this.traceStoreService) {
            // Convert internal trace event to storage event format
            const storageEvent = this._createStorageEvent(type, data);
            try {
                await this.traceStoreService.insertTraceEvent(storageEvent);
            } catch (error) {
                // Log the error but don't break the orchestrator
                console.error('Failed to store trace event:', error);
            }
        }
    }

    /**
     * Convert internal trace event to storage event format for TraceStoreService
     * @param {string} type - Event type (internal)
     * @param {Object} data - Event data
     * @returns {Object} Storage event for TraceStoreService.insertTraceEvent
     */
    _createStorageEvent(type, data) {
        // Sanitize the data for JSON serialization
        const sanitizedData = this._sanitizeForJSON(data);
        // Base event with required fields
        const baseEvent = {
            projectId: this.projectId,
            requestId: this.requestId,
            type: this._mapTraceTypeToStorageType(type),
            source: this._determineSource(type, data),
            summary: this._generateSummary(type, data),
            details: sanitizedData,
            // Optional fields that may be present in data
            toolName: data.tool || null,
            direction: this._determineDirection(type, data),
            phaseIndex: data.phaseIndex || null,
            cycleIndex: data.cycleIndex || null,
            error: data.error ? this._sanitizeForJSON(data.error) : null,
            metadata: data.metadata ? this._sanitizeForJSON(data.metadata) : null,
        };

        // Ensure details is an object (default to {})
        if (!baseEvent.details || typeof baseEvent.details !== 'object') {
            baseEvent.details = {};
        }

        return baseEvent;
    }

    /**
     * Map internal trace type to storage event type
     * @param {string} internalType - Internal trace type
     * @returns {string} Storage event type
     */
    _mapTraceTypeToStorageType(internalType) {
        const typeMap = {
            'turn_start': 'orchestration_phase_start',
            'llm_call': 'llm_call',
            'tool_call': 'tool_call',
            'tool_success': 'tool_result',
            'tool_error': 'tool_result',
            'tool_result': 'tool_result',
            'turn_end': 'orchestration_phase_end',
            'error': 'system_error',
            'max_turns_reached': 'system_event',
            'max_turns_prompt_injected': 'system_event',
            'final_chunk': 'llm_call',
            'final_empty': 'system_event',
        };
        return typeMap[internalType] || internalType;
    }

    /**
     * Determine source based on event type and data
     * @param {string} type - Event type
     * @param {Object} data - Event data
     * @returns {string} Source identifier
     */
    _determineSource(type, data) {
        if (data.source) return data.source;
        
        const sourceMap = {
            'turn_start': 'system',
            'llm_call': 'orion',
            'tool_call': 'orion',
            'tool_success': 'tool',
            'tool_error': 'tool',
            'tool_result': 'tool',
            'turn_end': 'system',
            'error': 'system',
            'max_turns_reached': 'system',
            'max_turns_prompt_injected': 'system',
            'final_chunk': 'orion',
            'final_empty': 'system',
        };
        return sourceMap[type] || 'system';
    }

    /**
     * Generate human-readable summary
     * @param {string} type - Event type
     * @param {Object} data - Event data
     * @returns {string} Summary text
     */
    _generateSummary(type, data) {
        switch (type) {
            case 'turn_start':
                return `Turn ${data.turn} started`;
            case 'llm_call':
                return `LLM call for turn ${data.turn}`;
            case 'tool_call':
                return `Tool call: ${data.tool}.${data.action}`;
            case 'tool_success':
                return `Tool result: ${data.tool}.${data.action} succeeded`;
            case 'tool_error':
                return `Tool result: ${data.tool}.${data.action} failed`;
            case 'turn_end':
                return `Turn ${data.turn} ended`;
            case 'error':
                return `Error: ${data.error || 'Unknown error'}`;
            case 'max_turns_reached':
                return `Maximum turns (${this.maxTurns}) reached`;
            case 'max_turns_prompt_injected':
                return 'Max turns prompt injected';
            case 'final_chunk':
                return 'Final answer chunk';
            case 'final_empty':
                return 'Final answer empty, using aggregated content';
            default:
                return `${type} event`;
        }
    }

    /**
     * Determine direction based on event type
     * @param {string} type - Event type
     * @param {Object} data - Event data
     * @returns {string|null} Direction (inbound, outbound, internal) or null
     */
    _determineDirection(type, data) {
        if (data.direction) return data.direction;
        
        const directionMap = {
            'tool_call': 'outbound',
            'tool_result': 'inbound',
            'llm_call': 'outbound',
        };
        return directionMap[type] || null;
    }
}

module.exports = ToolOrchestrator;
