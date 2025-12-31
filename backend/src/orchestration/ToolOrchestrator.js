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
     */
    constructor(adapter, toolRegistry, options = {}) {
        this.adapter = adapter;
        this.toolRegistry = toolRegistry;
        this.maxTurns = options.maxTurns || 10;
        this.traceEmitter = options.traceEmitter || ((event) => console.log('[Trace]', event.type, event.summary || ''));
        this.projectId = options.projectId || null;
        this.requestId = options.requestId || crypto.randomUUID();
        
        // Internal state
        this.currentTurn = 0;
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

        while (shouldContinue && this.currentTurn < this.maxTurns) {
            this.currentTurn++;
            
            // Emit turn start trace
            this._emitTrace('turn_start', {
                turn: this.currentTurn,
                messages: currentMessages.length
            });

            try {
                // Call the adapter for this turn
                const llmStream = this.adapter.callStreaming(currentMessages, tools, {
                    temperature: 0.7,
                    max_tokens: 2000
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
                this._emitTrace('llm_call', {
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
                    this._emitTrace('turn_end', {
                        turn: this.currentTurn,
                        reason: 'no_tool_calls',
                        final_content: aggregatedContent
                    });
                    
                    break;
                }

                // Execute tool calls
                const toolResults = [];
                
                for (const toolCall of turnToolCalls) {
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
                        toolCallId: toolCall.id
                    };
                    yield toolCallEvent;

                    // Prepare context for tool execution
                    const context = {
                        projectId: this.projectId,
                        requestId: this.requestId,
                        turnIndex: this.currentTurn
                    };

                    // Execute the tool call
                    try {
                        const results = await executeToolCalls(
                            this.toolRegistry,
                            [toolCall],
                            context
                        );

                        const result = results[0]; // Single tool call
                        
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
                        this._emitTrace(result.success ? 'tool_success' : 'tool_error', {
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

                        this._emitTrace('tool_error', {
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
                this._emitTrace('turn_end', {
                    turn: this.currentTurn,
                    tool_calls_executed: turnToolCalls.length,
                    tool_results: toolResults.length
                });

            } catch (error) {
                // Error in LLM call or processing
                this._emitTrace('error', {
                    turn: this.currentTurn,
                    error: error.message,
                    stack: error.stack
                });

                yield {
                    type: 'error',
                    error: error.message,
                    turn: this.currentTurn
                };

                shouldContinue = false;
                break;
            }
        }

        // If we reached max turns without natural completion
        if (this.currentTurn >= this.maxTurns && shouldContinue) {
            this._emitTrace('max_turns_reached', {
                turns: this.currentTurn,
                content: aggregatedContent
            });

            yield {
                type: 'max_turns',
                content: aggregatedContent,
                tool_calls: aggregatedToolCalls,
                turns: this.currentTurn
            };
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
     * Emit trace event
     * @param {string} type - Event type
     * @param {Object} data - Event data
     */
    _emitTrace(type, data) {
        const traceEvent = {
            type,
            timestamp: new Date().toISOString(),
            projectId: this.projectId,
            requestId: this.requestId,
            turn: this.currentTurn,
            ...data
        };
        
        this.traceEmitter(traceEvent);
    }
}

module.exports = ToolOrchestrator;
