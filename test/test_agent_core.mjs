import { PromptBuilder } from '../src/agent/prompt_builder.js';
import { DomainCrawler } from '../src/utils/crawler.js';
import { TOOL_DEFINITIONS } from '../src/tools/tool_registry.js';

console.log('--- Running Aetheria Agent Core Validation ---');

// 1. Tool Registry Verification
console.log(`Verifying Tool Definitions (${TOOL_DEFINITIONS.length} tools)...`);
const requiredTools = ['click_element', 'fill_form_field', 'upload_resume_file', 'ask_user', 'finish_task'];
for (const req of requiredTools) {
  const found = TOOL_DEFINITIONS.find(t => t.name === req);
  if (!found) {
    throw new Error(`Missing expected tool: ${req}`);
  }
}
console.log('✓ Tool Registry validated successfully.');

// 2. Prompt Builder & ReAct Parser Verification
console.log('Verifying ReAct Response Parser...');
const sampleResponse = `Thought: I see the job application has a name field at #4 and an email field at #5. I should fill out the candidate full name first using the user master context.
Action: fill_form_field
Action Input: {"element_id": 4, "value": "Alex Morgan"}`;

const parsed = PromptBuilder.parseReActResponse(sampleResponse);
if (parsed.action !== 'fill_form_field') {
  throw new Error(`Expected action fill_form_field, got ${parsed.action}`);
}
if (parsed.actionInput.element_id !== 4 || parsed.actionInput.value !== 'Alex Morgan') {
  throw new Error(`Parsed actionInput mismatch: ${JSON.stringify(parsed.actionInput)}`);
}
console.log('✓ ReAct Response Parser verified successfully.');

// 3. Crawler Domain Logic Verification
console.log('Verifying Crawler URL domain checks...');
const crawler = new DomainCrawler();
const isSame1 = crawler.isSameDomain('https://portfolio.dev/projects', 'portfolio.dev');
const isSame2 = crawler.isSameDomain('https://blog.portfolio.dev/about', 'portfolio.dev');
const isDiff = crawler.isSameDomain('https://external-site.com/link', 'portfolio.dev');

if (!isSame1 || !isSame2 || isDiff) {
  throw new Error('Crawler domain matching logic error');
}
console.log('✓ Domain Crawler URL resolution verified successfully.');

console.log('\n✅ All core agent unit checks passed!');
