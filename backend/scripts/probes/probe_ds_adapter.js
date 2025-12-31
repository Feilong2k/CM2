// probe_ds_adapter.js
// Standalone script to test DS_ReasonerAdapter streaming interface

// Load environment variables from .env if needed
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

try {
  // Import the DS_ReasonerAdapter
  const { DS_ReasonerAdapter } = require('../../src/adapters/DS_ReasonerAdapter.js');

  // Check for API key
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn('Warning: DEEPSEEK_API_KEY is not set in environment variables.');
  }

  // Main async function
  async function main() {
    const adapter = new DS_ReasonerAdapter();

    const stream = adapter.callStreaming([
      { role: 'user', content: 'Say hello in one word.' }
    ]);

    for await (const chunk of stream) {
      console.log('Received chunk:', chunk);
    }
  }

  main().catch((err) => {
    console.error('Error during streaming:', err);
  });
} catch (err) {
  console.error('Failed to load DS_ReasonerAdapter:', err);
}
