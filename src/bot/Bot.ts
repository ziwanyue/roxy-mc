import mineflayer, { type Bot as MineflayerBot } from 'mineflayer';
import { config } from '../config.js';
import { loadPlugins } from './plugins.js';
import { logger } from '../utils/logger.js';

export class Bot {
  public mc: MineflayerBot;
  private ready = false;
  private reconnecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionId = Date.now();

  constructor() {
    this.mc = this.createBot();
  }

  private createBot(): MineflayerBot {
    const bot = mineflayer.createBot({
      host: config.mc.host,
      port: config.mc.port,
      username: `${config.mc.username}${this.connectionId.toString().slice(-4)}`, // Unique name to avoid duplicate login
      version: config.mc.version,
    });

    bot.once('spawn', () => {
      loadPlugins(bot);
      this.ready = true;
      this.reconnecting = false;
      logger.success(`已连接到服务器 ${config.mc.host}:${config.mc.port}`);
      logger.bot('大家好呀～我是洛琪希，请多指教！');
    });

    bot.on('chat', (username: string, message: string) => {
      if (username === config.mc.username) return;
      logger.info(`[聊天] ${username}: ${message}`);
    });

    bot.on('whisper', (username: string, message: string) => {
      if (username === config.mc.username) return;
      logger.info(`[私聊] ${username}: ${message}`);
    });

    bot.on('error', (err: Error) => {
      logger.error(`连接错误: ${err.message}`);
    });

    bot.on('kicked', (reason: unknown) => {
      const reasonStr = typeof reason === 'string' ? reason : JSON.stringify(reason);
      logger.warn(`被踢出服务器: ${reasonStr}`);
    });

    bot.on('end', () => {
      this.ready = false;
      logger.warn('连接断开');
      // 防止重复重连
      if (this.reconnecting || this.reconnectTimer) return;
      this.reconnecting = true;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        logger.info('尝试重新连接...');
        this.mc = this.createBot();
      }, 8000);
    });

    return bot;
  }

  isReady(): boolean {
    return this.ready;
  }
}
