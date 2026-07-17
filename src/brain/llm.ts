import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface LLMResponse {
  action?: string;
  params?: Record<string, unknown>;
  chat?: string;
  plan?: Array<{ action: string; params: Record<string, unknown> }>;
}

/**
 * 调用 LLM（支持 Ollama 和 Claude API 两种后端）
 */
export async function askLLM(systemPrompt: string, userMessage: string): Promise<LLMResponse | null> {
  const provider = config.llm.provider;

  try {
    logger.llm(`思考中... (model: ${config.llm.model}, provider: ${provider})`);

    let text: string;

    if (provider === 'claude') {
      text = await callClaude(systemPrompt, userMessage);
    } else {
      text = await callOllama(systemPrompt, userMessage);
    }

    logger.llm(`回复: ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`);
    return parseResponse(text);
  } catch (err) {
    logger.error(`LLM 调用失败: ${(err as Error).message}`);
    return null;
  }
}

/**
 * 调用 Ollama 本地模型
 */
async function callOllama(systemPrompt: string, userMessage: string): Promise<string> {
  const { Ollama } = await import('ollama');
  const ollama = new Ollama({ host: config.ollama.host });

  const response = await ollama.chat({
    model: config.ollama.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    options: {
      temperature: 0.7,
      top_p: 0.9,
    },
  });
  return response.message.content.trim();
}

/**
 * 调用 Claude API（配置 Anthropic API Key 后可用）
 * 角色扮演效果更好，推理能力更强
 */
async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = config.llm.apiKey;
  if (!apiKey) {
    throw new Error('未配置 Claude API Key。请设置 ANTHROPIC_API_KEY 环境变量');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.llm.model,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const data = await response.json() as any;
  if (!response.ok) {
    throw new Error(`Claude API 错误: ${data.error?.message || response.statusText}`);
  }

  return data.content?.[0]?.text?.trim() || '';
}

/**
 * 从 LLM 返回的文本中提取 JSON
 * 支持同一文本包含多个 JSON 对象
 */
function parseResponse(text: string): LLMResponse | null {
  let body = text;

  // 尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    body = codeBlockMatch[1].trim();
  }

  // 找出所有 JSON 对象（支持嵌套）
  const jsonObjects: string[] = [];
  let depth = 0, start = -1;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (body[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        jsonObjects.push(body.slice(start, i + 1));
        start = -1;
      }
    }
  }

  // 没有找到任何 JSON
  if (jsonObjects.length === 0) {
    logger.warn(`未找到 JSON: ${body.slice(0, 60)}`);
    return null;
  }

  let result: LLMResponse = { action: 'idle' };
  let extraChat = '';

  for (const jsonStr of jsonObjects) {
    try {
      const parsed = JSON.parse(jsonStr);

      // action/plan 优先用第一个完整对象
      if (parsed.plan && Array.isArray(parsed.plan) && !result.plan) {
        result.plan = parsed.plan;
        result.action = undefined;
        if (parsed.chat) result.chat = parsed.chat;
      } else if (parsed.action && result.action === 'idle') {
        result.action = parsed.action;
        result.params = parsed.params ?? {};
        if (parsed.chat) result.chat = parsed.chat;
      }

      // 收集额外的 chat 字段
      if (parsed.chat && !result.chat) {
        extraChat = parsed.chat;
      }
    } catch { /* 这个 JSON 解析失败，跳过 */ }
  }

  // 兜底：如果没找到 action/plan 但有 chat
  if (result.action === 'idle' && !result.plan && extraChat) {
    return { action: 'chat', params: { message: extraChat }, chat: extraChat };
  }

  if (result.plan || (result.action && result.action !== 'idle')) {
    return result;
  }

  // 只有 idle，但有额外 chat 时就当 chat 用
  if (extraChat) {
    return { action: 'chat', params: { message: extraChat }, chat: extraChat };
  }

  return result;
}
