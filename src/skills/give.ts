import { registerSkill, type Skill } from './index.js';
import { logger } from '../utils/logger.js';
import { FOOD_ITEMS } from '../utils/recipes.js';

const giveSkill: Skill = {
  name: 'give',
  description: '给附近玩家物品（食物等）',
  async execute(ctx: { bot: any; args: Record<string, unknown> }): Promise<{ success: boolean; message?: string }> {
    const { bot, args } = ctx;
    const targetName = String(args.player ?? '');
    const itemName = String(args.item ?? 'food');
    const count = Math.max(1, Math.min(64, Number(args.count ?? 1)));

    // 找目标玩家
    let targetPlayer: any = null;
    if (targetName) {
      targetPlayer = bot.players[targetName];
    } else {
      // 找最近的玩家
      for (const [name, player] of Object.entries(bot.players) as any) {
        if (name === bot.username) continue;
        if (/^Roxy\d{4,}$/.test(name)) continue;
        if (player.entity) {
          targetPlayer = player;
          break;
        }
      }
    }

    if (!targetPlayer?.entity) {
      return { success: false, message: '附近没有可以给物品的玩家' };
    }

    // 确定给什么物品
    let giveItem: any = null;
    if (itemName === 'food') {
      // 给最好的食物
      const foods = bot.inventory.items()
        .filter((i: any) => FOOD_ITEMS.includes(i.name))
        .sort((a: any, b: any) => {
          const aIdx = FOOD_ITEMS.indexOf(a.name);
          const bIdx = FOOD_ITEMS.indexOf(b.name);
          return (aIdx >= 0 ? aIdx : 99) - (bIdx >= 0 ? bIdx : 99);
        });
      giveItem = foods[0] || null;
    } else {
      giveItem = bot.inventory.items().find((i: any) => i.name === itemName) || null;
    }

    if (!giveItem) {
      return { success: false, message: `没有 ${itemName} 可以给` };
    }

    // 走到玩家附近
    const dist = targetPlayer.entity.position.distanceTo(bot.entity.position);
    if (dist > 4) {
      const pf = await import('mineflayer-pathfinder');
      const movements = new pf.Movements(bot);
      bot.pathfinder.setMovements(movements);
      try {
        await bot.pathfinder.goto(new pf.goals.GoalNear(
          targetPlayer.entity.position.x,
          targetPlayer.entity.position.y,
          targetPlayer.entity.position.z, 2
        ));
      } catch { /* 继续 */ }
    }

    // 丢出物品（模拟给予）
    try {
      await bot.toss(giveItem.type, null, Math.min(count, giveItem.count));
      logger.bot(`🎁 给了 ${targetPlayer.name} ${giveItem.name} x${Math.min(count, giveItem.count)}`);
      return { success: true, message: `给了 ${targetPlayer.name} ${giveItem.name}` };
    } catch (err) {
      return { success: false, message: `给予失败: ${(err as Error).message}` };
    }
  },
};

registerSkill(giveSkill);
