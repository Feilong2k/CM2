// DS_ReasonerAdapter - Thin wrapper around DeepSeek API
// Implements streaming interface for DeepSeek API calls

class DS_ReasonerAdapter {
    constructor() {
        // Read API key from environment
        this.apiKey = process.env.DEEPSEEK_API_KEY;
        this.apiUrl = 'https://api.deepseek.com/chat/completions';
        
        if (!this.apiKey) {
            console.warn('Warning: DEEPSEEK_API_KEY is not set in environment variables.');
            // In production, you might want to throw an error
            // throw new Error('DEEPSEEK_API_KEY is required');
        }
    }

    /**
     * Calls the DeepSeek API with streaming enabled
     * @param {Array} messages - Array of OpenAI-format messages
     * @param {Array} tools - Array of tool definitions (optional)
     * @param {Object} options - Additional options (temperature, max_tokens, etc.)
     * @returns {AsyncIterator} - Async iterator yielding parsed chunks
     */
    async *callStreaming(messages, tools = [], options = {}) {
        const requestBody = {
            model: 'deepseek-chat',
            messages,
            stream: true,
            ...options
        };

        // Add tools if provided
        if (tools && tools.length > 0) {
            requestBody.tools = tools;
        }

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DeepSeek API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        // Parse the streaming response
        yield* this._parseStreamingResponse(response);
    }

    /**
     * Parses SSE stream from DeepSeek API response
     * @param {Response} response - Fetch response object
     * @returns {AsyncIterator} - Async iterator yielding parsed chunks
     */
    async *_parseStreamingResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    // Process any remaining data in buffer
                    if (buffer.trim()) {
                        const chunks = this._processBuffer(buffer);
                        for (const chunk of chunks) {
                            yield chunk;
                        }
                    }
                    break;
                }

                // Decode the chunk and add to buffer
                buffer += decoder.decode(value, { stream: true });
                
                // Process complete lines from buffer
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6); // Remove 'data: ' prefix
                        
                        // Skip [DONE] marker
                        if (data === '[DONE]') {
                            continue;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            
                            // Extract delta from the response
                            const delta = parsed.choices?.[0]?.delta || {};
                            
                            // Yield standardized chunk
                            yield {
                                content: delta.content || '',
                                reasoning_content: delta.reasoning_content || '',
                                tool_calls: delta.tool_calls || []
                            };
                        } catch (e) {
                            console.warn('Failed to parse SSE data:', data, e);
                            // Continue processing other lines
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Process remaining buffer content
     * @param {string} buffer - Remaining buffer content
     * @returns {Array} - Array of parsed chunks
     */
    _processBuffer(buffer) {
        const chunks = [];
        const lines = buffer.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.substring(6);
                
                if (data === '[DONE]') {
                    continue;
                }

                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta || {};
                    
                    chunks.push({
                        content: delta.content || '',
                        reasoning_content: delta.reasoning_content || '',
                        tool_calls: delta.tool_calls || []
                    });
                } catch (e) {
                    console.warn('Failed to parse buffered data:', data, e);
                }
            }
        }
        
        return chunks;
    }
}

module.exports = { DS_ReasonerAdapter };
