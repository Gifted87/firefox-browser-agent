/**
 * Multi-Provider LLM Client
 * Connects to Google Gemini, OpenAI, Anthropic, or Local Ollama endpoints.
 */
import { logger } from '../utils/logger.js';

export class LLMClient {
  constructor(config = {}) {
    this.provider = config.provider || 'gemini'; // 'gemini' | 'openai' | 'anthropic' | 'ollama'
    this.apiKey = config.apiKey || '';
    this.model = config.model || '';
    this.baseUrl = config.baseUrl || '';
    this.temperature = config.temperature ?? 0.2;
  }

  /**
   * Dispatches chat request to configured provider
   * @param {Array<{ role: string, content: string }>} messages 
   * @param {Array} tools - Tool definitions
   * @returns {Promise<{ content: string, toolCalls?: Array<{ name: string, args: any }> }>}
   */
  async chat(messages, tools = []) {
    switch (this.provider) {
      case 'self_hosted':
        return this.callSelfHosted(messages, tools);
      case 'openrouter':
        return this.callOpenRouter(messages, tools);
      case 'gemini':
        return this.callGemini(messages, tools);
      case 'openai':
        return this.callOpenAI(messages, tools);
      case 'anthropic':
        return this.callAnthropic(messages, tools);
      case 'ollama':
        return this.callOllama(messages, tools);
      default:
        throw new Error(`Unsupported LLM provider: ${this.provider}`);
    }
  }

  // --- Self-Hosted Inference Server (ngrok / Qwen) ---
  async callSelfHosted(messages, tools) {
    let baseUrl = this.baseUrl || 'https://rippling-deck-emu.ngrok-free.dev';
    if (!baseUrl.endsWith('/chat/completions')) {
      if (!baseUrl.endsWith('/v1')) {
        baseUrl = baseUrl + '/v1';
      }
      baseUrl = baseUrl + '/chat/completions';
    }

    const modelName = this.model || 'Qwen/Qwen2.5-1.5B-Instruct';

    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const payload = {
      model: modelName,
      messages,
      temperature: this.temperature,
      max_tokens: 16384,
      stream: true
    };

    const t0 = performance.now();
    let firstTokenTime = null;

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Self-hosted server error (${response.status}): ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let content = '';
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices?.[0]?.delta?.content;
            if (delta !== undefined && delta !== null) {
              if (firstTokenTime === null) {
                firstTokenTime = (performance.now() - t0) / 1000;
                logger.info(`TTFT=${firstTokenTime.toFixed(2)}s | `);
              }
              content += delta;
            }
          } catch (e) {
            // ignore JSON parse errors for incomplete chunks
          }
        }
      }
    }

    const totalTime = (performance.now() - t0) / 1000;
    logger.info(`| total=${totalTime.toFixed(2)}s`);

    return { content };
  }

  // --- OpenRouter ---
  async callOpenRouter(messages, tools) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API Key is missing. Please configure it in Settings.');
    }

    const endpoint = (this.baseUrl ? (this.baseUrl.endsWith('/chat/completions') ? this.baseUrl : this.baseUrl + '/chat/completions') : 'https://openrouter.ai/api/v1/chat/completions');
    const modelName = this.model || 'nex-agi/nex-n2.5-mini:free';

    const payload = {
      model: modelName,
      messages,
      temperature: this.temperature,
      stream: true
    };

    const t0 = performance.now();
    let firstTokenTime = null;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://aetheria-agent.local',
        'X-Title': 'Aetheria Firefox Agent'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let content = '';
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices?.[0]?.delta?.content;
            if (delta !== undefined && delta !== null) {
              if (firstTokenTime === null) {
                firstTokenTime = (performance.now() - t0) / 1000;
                logger.info(`TTFT=${firstTokenTime.toFixed(2)}s | `);
              }
              content += delta;
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }

    const totalTime = (performance.now() - t0) / 1000;
    logger.info(`| total=${totalTime.toFixed(2)}s`);

    return { content };
  }

  // --- Google Gemini ---
  async callGemini(messages, tools) {
    if (!this.apiKey) {
      throw new Error('Gemini API Key is missing. Please configure it in Settings.');
    }

    const modelName = this.model || 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    // Convert messages to Gemini format
    let systemInstruction = '';
    const contents = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction += msg.content + '\n';
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }

    const payload = {
      contents,
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: 2048
      }
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map(p => p.text).join('') || '';

    return { content: text };
  }

  // --- OpenAI ---
  async callOpenAI(messages, tools) {
    if (!this.apiKey) {
      throw new Error('OpenAI API Key is missing. Please configure it in Settings.');
    }

    const endpoint = (this.baseUrl || 'https://api.openai.com/v1') + '/chat/completions';
    const modelName = this.model || 'gpt-4o-mini';

    const payload = {
      model: modelName,
      messages,
      temperature: this.temperature,
      stream: true
    };

    const t0 = performance.now();
    let firstTokenTime = null;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let content = '';
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices?.[0]?.delta?.content;
            if (delta !== undefined && delta !== null) {
              if (firstTokenTime === null) {
                firstTokenTime = (performance.now() - t0) / 1000;
                logger.info(`TTFT=${firstTokenTime.toFixed(2)}s | `);
              }
              content += delta;
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }

    const totalTime = (performance.now() - t0) / 1000;
    logger.info(`| total=${totalTime.toFixed(2)}s`);

    return { content };
  }

  // --- Anthropic ---
  async callAnthropic(messages, tools) {
    if (!this.apiKey) {
      throw new Error('Anthropic API Key is missing. Please configure it in Settings.');
    }

    const endpoint = 'https://api.anthropic.com/v1/messages';
    const modelName = this.model || 'claude-3-5-sonnet-latest';

    let systemText = '';
    const filteredMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemText += msg.content + '\n';
      } else {
        filteredMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      }
    }

    const payload = {
      model: modelName,
      messages: filteredMessages,
      max_tokens: 2048,
      temperature: this.temperature
    };

    if (systemText) {
      payload.system = systemText;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const text = data.content?.map(c => c.text).join('') || '';
    return { content: text };
  }

  // --- Ollama / Local LLM ---
  async callOllama(messages, tools) {
    const endpoint = (this.baseUrl || 'http://localhost:11434') + '/api/chat';
    const modelName = this.model || 'llama3';

    const payload = {
      model: modelName,
      messages,
      stream: false,
      options: {
        temperature: this.temperature
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return { content: data.message?.content || '' };
  }
}
