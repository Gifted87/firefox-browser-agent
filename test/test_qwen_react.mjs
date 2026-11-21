import { LLMClient } from '../src/agent/llm_client.js';
import { PromptBuilder } from '../src/agent/prompt_builder.js';

console.log('Testing ReAct step with Self-Hosted Qwen/Qwen2.5-1.5B-Instruct...');

const client = new LLMClient({
  provider: 'self_hosted',
  baseUrl: 'https://rippling-deck-emu.ngrok-free.dev',
  model: 'Qwen/Qwen2.5-1.5B-Instruct'
});

const systemPrompt = PromptBuilder.buildSystemPrompt('Candidate Name: Alex Morgan\nEmail: alex@example.com\nResume: 5 years software engineer');
const stepPrompt = PromptBuilder.buildStepUserMessage(
  'Apply to this job posting with my resume',
  {
    title: 'Job Application',
    url: 'https://example.com/apply',
    elements: [
      { id: 1, tag: 'input', type: 'text', label: 'Full Name' },
      { id: 2, tag: 'input', type: 'email', label: 'Email' }
    ],
    readableTextSnippet: 'Apex Dynamics Job Application'
  },
  1
);

const response = await client.chat([
  { role: 'system', content: systemPrompt },
  { role: 'user', content: stepPrompt }
]);

console.log('Raw Qwen Response:\n', response.content);

const parsed = PromptBuilder.parseReActResponse(response.content);
console.log('\n--- Parsed ReAct Output ---');
console.log('Thought:', parsed.thought);
console.log('Action:', parsed.action);
console.log('Action Input:', parsed.actionInput);
