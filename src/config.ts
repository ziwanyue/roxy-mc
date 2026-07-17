import 'dotenv/config';

export const config = {
  mc: {
    host: process.env.MC_HOST ?? 'localhost',
    port: Number(process.env.MC_PORT ?? 25565),
    username: process.env.MC_USERNAME ?? 'Roxy',
    version: process.env.MC_VERSION ?? '1.21',
  },
  ollama: {
    host: process.env.OLLAMA_HOST ?? 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL ?? 'qwen2.5:7b',
  },
  llm: {
    // provider: 'ollama' | 'claude'
    provider: process.env.LLM_PROVIDER ?? 'ollama',
    // Claude API 用：model 如 claude-sonnet-4-6, claude-haiku-4-5 等
    model: process.env.LLM_MODEL ?? (process.env.LLM_PROVIDER === 'claude' ? 'claude-sonnet-4-6' : 'qwen2.5:7b'),
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  },
  thinkIntervalMs: Number(process.env.THINK_INTERVAL_MS ?? 2000),
};
