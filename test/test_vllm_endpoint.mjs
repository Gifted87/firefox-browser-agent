const BASE_URL = 'https://rippling-deck-emu.ngrok-free.dev';
const headers = { 'ngrok-skip-browser-warning': 'true' };

async function test() {
  console.log('1. Checking /vllm-health...');
  try {
    const r1 = await fetch(`${BASE_URL}/vllm-health`, { headers });
    console.log('Status:', r1.status, await r1.text());
  } catch (e) {
    console.error('Error:', e.message);
  }

  console.log('\n2. Checking /v1/models...');
  try {
    const r2 = await fetch(`${BASE_URL}/v1/models`, { headers });
    console.log('Status:', r2.status, await r2.text());
  } catch (e) {
    console.error('Error:', e.message);
  }

  console.log('\n3. Testing /v1/chat/completions (Qwen/Qwen2.5-1.5B-Instruct via vLLM)...');
  try {
    const r3 = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'Qwen/Qwen2.5-1.5B-Instruct',
        messages: [
          { role: 'system', content: 'You are Aetheria web agent.' },
          { role: 'user', content: 'Say "vLLM proxy online and ready!"' }
        ],
        max_tokens: 60,
        temperature: 0.2
      })
    });
    console.log('Chat Status:', r3.status);
    const data = await r3.json();
    console.log('Response:', data.choices?.[0]?.message?.content);
    console.log('Model reported by server:', data.model);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
