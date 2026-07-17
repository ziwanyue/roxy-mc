import fs from 'fs';
import path from 'path';
import { Bot } from './bot/Bot.js';
import { Brain } from './brain/Brain.js';
import { logger } from './utils/logger.js';
import { autoStartup } from './skills/startup.js';

// ── 进程锁 ──
const lockFile = path.resolve(import.meta.dirname, '..', '.bot.lock');
function checkLock(): boolean {
  try {
    if (fs.existsSync(lockFile)) {
      const oldPid = parseInt(fs.readFileSync(lockFile, 'utf-8').trim(), 10);
      if (!isNaN(oldPid)) {
        try {
          process.kill(oldPid, 0); // 检查进程是否存在
          logger.warn(`发现正在运行的 Bot（PID: ${oldPid}），正在关闭它...`);
          process.kill(oldPid, 'SIGTERM');
        } catch { /* 进程已不存在，OK */ }
      }
    }
    fs.writeFileSync(lockFile, String(process.pid));
    return true;
  } catch { return false; }
}
function releaseLock(): void {
  try { if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile); } catch { /* 忽略 */ }
}

async function main() {
  logger.info('🔮 洛琪希 Minecraft Agent 启动中...');
  logger.info('═══════════════════════════════════════');

  // 检查进程锁
  if (!checkLock()) {
    logger.error('无法创建进程锁，检查 .bot.lock 文件权限');
    process.exit(1);
  }

  // 创建 Bot 并连接服务器
  const bot = new Bot();

  // 等待 bot 准备就绪
  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (bot.isReady()) {
        clearInterval(check);
        resolve();
      }
    }, 500);
  });

  logger.success('Bot 已准备就绪！');

  // 自动开荒：砍树→工作台→木镐→挖石→石镐
  logger.info('开始自动开荒...');
  await autoStartup(bot.mc);

  // 启动 Agent Brain（LLM 决策循环）
  const brain = new Brain(bot.mc);
  brain.start();

  logger.success('Agent Brain 已启动，洛琪希开始思考了！');
  logger.info('═══════════════════════════════════════');
  logger.info('按 Ctrl+C 退出');

  // 优雅退出
  process.on('SIGINT', () => {
    logger.info('\n正在关闭...');
    brain.stop();
    bot.mc.quit();
    releaseLock();
    logger.bot('大家再见...下次再一起玩吧～');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    brain.stop();
    bot.mc.quit();
    releaseLock();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error(`启动失败: ${err.message}`);
  logger.info('');
  logger.info('常见问题:');
  logger.info('  1. Minecraft 服务器是否在运行？');
  logger.info('  2. 服务器地址和端口是否正确？（检查 .env）');
  logger.info('  3. Ollama 是否已启动？（运行 ollama serve）');
  releaseLock();
  process.exit(1);
});
