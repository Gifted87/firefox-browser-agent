import { LLMClient } from '../src/agent/llm_client.js';

console.log('Testing OpenRouter connection with nex-agi/nex-n2.5-mini:free...');

const client = new LLMClient({
  provider: 'openrouter',
  apiKey: process.env.OPENROUTER_API_KEY || 'your_openrouter_api_key_here',
  model: 'nex-agi/nex-n2.5-mini:free',
  baseUrl: 'https://openrouter.ai/api/v1/chat/completions'
});

try {
  const result = await client.chat([
    { role: 'system', content: 'You are an autonomous web agent.' },
    { role: 'user', content: 'Say "Hello, Aetheria is ready!" and nothing else.' }
  ]);
  console.log('✅ OpenRouter Response:', result.content.trim());
} catch (err) {
  console.error('❌ OpenRouter Test Error:', err.message);
}
