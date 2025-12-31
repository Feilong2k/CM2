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
     * Process a task message with streaming response
     * @param {string} message - User message
     * @returns {AsyncIterator} Stream of events
     */
    async *processTaskStreaming(message) {
        // Construct messages
        const messages = [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: message }
        ];

        // Filter tools based on registry
        // We match functionDefinitions names (e.g. 'FileSystemTool_read_file')
        // against the keys in toolRegistry (e.g. 'FileSystemTool').
        // Assumption: functionDefinitions uses 'ToolName_Action' format.
        const registeredToolNames = Object.keys(this.toolRegistry);
        const tools = functionDefinitions.filter(def => {
            const toolName = def.function.name.split('_')[0];
            return registeredToolNames.includes(toolName);
        });

        // Delegate to orchestrator
        yield* this.orchestrator.run(messages, tools);
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
