const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

function timestamp(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

export const logger = {
  info(msg: string, ...args: unknown[]) {
    console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.cyan}ℹ${COLORS.reset} ${msg}`, ...args);
  },
  success(msg: string, ...args: unknown[]) {
    console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.green}✓${COLORS.reset} ${msg}`, ...args);
  },
  warn(msg: string, ...args: unknown[]) {
    console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.yellow}⚠${COLORS.reset} ${msg}`, ...args);
  },
  error(msg: string, ...args: unknown[]) {
    console.error(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.red}✗${COLORS.reset} ${msg}`, ...args);
  },
  bot(msg: string, ...args: unknown[]) {
    console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.magenta}🔮 Roxy${COLORS.reset} ${msg}`, ...args);
  },
  llm(msg: string, ...args: unknown[]) {
    console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.blue}🧠 LLM${COLORS.reset} ${msg}`, ...args);
  },
};
