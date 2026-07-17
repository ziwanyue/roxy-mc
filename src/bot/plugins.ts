import type { Bot } from 'mineflayer';
import pf from 'mineflayer-pathfinder';
import cb from 'mineflayer-collectblock';

/**
 * 加载所有需要的 Mineflayer 插件
 */
export function loadPlugins(bot: Bot): void {
  bot.loadPlugin(pf.pathfinder);
  bot.loadPlugin(cb.plugin);
}
