const BASE_URL = 'https://rippling-deck-emu.ngrok-free.dev';

async function testEndpoint() {
  console.log('1. Testing /health...');
  try {
    const healthRes = await fetch(`${BASE_URL}/health`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    console.log('Health status:', healthRes.status, await healthRes.text());
  } catch (e) {
    console.error('Health check failed:', e.message);
  }

  console.log('\n2. Testing /v1/models...');
  try {
    const modelsRes = await fetch(`${BASE_URL}/v1/models`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    console.log('Models status:', modelsRes.status, await modelsRes.text());
  } catch (e) {
    console.error('Models check failed:', e.message);
  }

  console.log('\n3. Testing /v1/chat/completions with Qwen/Qwen2.5-3B-Instruct...');
  try {
    const chatRes = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen2.5-3B-Instruct',
        messages: [
          { role: 'system', content: 'You are Aetheria, an autonomous web agent.' },
          { role: 'user', content: 'Respond with "Aetheria connected to self-hosted Qwen successfully!" and nothing else.' }
        ],
        max_tokens: 100,
        temperature: 0.2
      })
    });

    console.log('Chat completions status:', chatRes.status);
    const data = await chatRes.json();
    console.log('Response content:', data.choices?.[0]?.message?.content || data);
  } catch (e) {
    console.error('Chat completions failed:', e.message);
  }
}

testEndpoint();
