// OrionAgent - High-level intelligent assistant for CodeMaestro
// Composes Adapter and Orchestrator to provide a unified interface

const { DS_ReasonerAdapter } = require('../adapters/DS_ReasonerAdapter');
const ToolOrchestrator = require('../orchestration/ToolOrchestrator');
const functionDefinitions = require('../../tools/functionDefinitions');

class OrionAgent {
    /**
     * Constructor
     * @param {Object} options - Configuration options
     * @param {Object} options.toolRegistry - Map of tool names to implementations (Required)
     * @param {string} options.systemPrompt - Custom system prompt (Optional)
     * @param {Object} options.orchestratorOptions - Options passed to orchestrator (Optional)
     */
    constructor(options = {}) {
        if (!options.toolRegistry) {
            throw new Error('OrionAgent requires a toolRegistry');
        }

        this.toolRegistry = options.toolRegistry;
        this.systemPrompt = options.systemPrompt || this._getDefaultSystemPrompt();
        
        // Context integration
        this.contextService = options.contextService || null;
        this.projectId = options.projectId || null;
        this.rootPath = options.rootPath || process.cwd();
        
        // Initialize components
        this.adapter = new DS_ReasonerAdapter();
        this.orchestrator = new ToolOrchestrator(
            this.adapter,
            this.toolRegistry,
            options.orchestratorOptions
        );
    }

    /**
     * Get the default system prompt
     * @returns {string} System prompt
     * @private
     */
    _getDefaultSystemPrompt() {
        return `You are Orion, an intelligent assistant for the CodeMaestro project.

Capabilities:
- You can have natural conversations.
- You have access to filesystem tools to inspect and modify the project.

Guidelines:
- Use tools ONLY when necessary to fulfill the user's request.
- If the request can be answered with general knowledge or conversationally, do NOT call tools.
- Verify critical operations when appropriate.`;
    }

    /**
     * Build the final message list, using context if available.
     * @param {Array} messages - Original messages (should contain the current user message, may also contain system/assistant messages)
     * @returns {Promise<Array>} Final message list
     * @private
     */
    async _buildFinalMessages(messages) {
        // If we have a projectId and contextService, use dynamic context
        if (this.projectId && this.contextService) {
            const { systemPrompt, historyMessages } = await this.contextService.buildContext(
                this.projectId,
                this.rootPath,
                { includeSkills: true }
            );
            // The last message in the input array is assumed to be the current user message
            const currentUserMessage = messages[messages.length - 1];
            // Ensure the current user message is from the user (role 'user')
            if (currentUserMessage.role !== 'user') {
                throw new Error('Expected the last message to be from the user');
            }
            // Combine: system prompt, history, current user message
            return [
                { role: 'system', content: systemPrompt },
                ...historyMessages,
                currentUserMessage
            ];
        } else {
            // Fallback: use default system prompt and no history.
            // Prepend the default system prompt, assuming messages does not already contain a system message.
            return [
                { role: 'system', content: this.systemPrompt },
                ...messages
            ];
        }
    }

    /**
     * Process a task message with streaming response
     * @param {string} message - User message
     * @returns {AsyncIterator} Stream of events
     */
    async *processTaskStreaming(message) {
        // Delegate to processMessagesStreaming with the user message
        yield* this.processMessagesStreaming([{ role: 'user', content: message }]);
    }

    /**
     * Process a list of messages with streaming response
     * @param {Array} messages - Array of message objects with role and content
     * @returns {AsyncIterator} Stream of events
     */
    async *processMessagesStreaming(messages) {
        // Build final messages (with context if applicable)
        const finalMessages = await this._buildFinalMessages(messages);

        // Filter tools based on registry
        const registeredToolNames = Object.keys(this.toolRegistry);
        const tools = functionDefinitions.filter(def => {
            const toolName = def.function.name.split('_')[0];
            return registeredToolNames.includes(toolName);
        });

        // Delegate to orchestrator
        yield* this.orchestrator.run(finalMessages, tools);
    }

    /**
     * Get agent configuration summary
     * @returns {Object} Config object
     */
    getConfig() {
        return {
            adapter: 'DS_ReasonerAdapter',
            tools: Object.keys(this.toolRegistry),
            promptLength: this.systemPrompt.length
        };
    }
}

module.exports = OrionAgent;
