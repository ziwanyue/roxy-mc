import { Movements, goals } from 'mineflayer-pathfinder';
import { registerSkill, type Skill } from './index.js';
import { logger } from '../utils/logger.js';
import { RAW_FOOD, COOKED_FOOD } from '../utils/recipes.js';

const cookSkill: Skill = {
  name: 'cook',
  description: '用熔炉烹饪食物',
  async execute(ctx: { bot: any; args: Record<string, unknown> }): Promise<{ success: boolean; message?: string }> {
    const { bot } = ctx;
    const registry = bot.registry;
    if (!registry?.blocksByName) return { success: false, message: '无法加载数据' };

    // 找附近的熔炉
    const furnaceBlock = bot.findBlock({ matching: registry.blocksByName.furnace?.id, maxDistance: 10 });
    if (!furnaceBlock) {
      const hasFurnace = bot.inventory.items().some((i: any) => i.name === 'furnace');
      return { success: false, message: hasFurnace ? '需要先放置熔炉' : '没有熔炉，先合成一个吧' };
    }

    // 找食材
    const cookableItems = bot.inventory.items().filter((i: any) => RAW_FOOD.includes(i.name));
    if (cookableItems.length === 0) return { success: false, message: '没有可烹饪的生食材' };

    // 找燃料
    const fuelNames = ['coal', 'charcoal', 'coal_block', 'oak_log', 'spruce_log', 'birch_log',
                       'jungle_log', 'acacia_log', 'dark_oak_log', 'oak_planks', 'stick'];
    const fuelItem = bot.inventory.items().find((i: any) => fuelNames.includes(i.name));
    if (!fuelItem) return { success: false, message: '没有燃料（煤炭/木头）' };

    // 走到熔炉前
    const movements = new Movements(bot);
    bot.pathfinder.setMovements(movements);
    try {
      await bot.pathfinder.goto(new goals.GoalNear(furnaceBlock.position.x, furnaceBlock.position.y, furnaceBlock.position.z, 2));
    } catch { /* 继续 */ }

    try {
      // 打开熔炉
      const furnace = await bot.openFurnace(furnaceBlock);
      let cooked = 0;

      for (const item of cookableItems.slice(0, 5)) { // 最多煮 5 个
        try {
          // 放入食材
          await furnace.putInput(item.type, 1);
          // 放入燃料
          const fuel = bot.inventory.items().find((i: any) => fuelNames.includes(i.name));
          if (fuel) await furnace.putFuel(fuel.type, 1);

          const cookedName = COOKED_FOOD[item.name] || `cooked_${item.name}`;
          logger.bot(`🔥 烹饪 ${item.name}...`);
          cooked++;
        } catch { /* 跳过 */ }
      }

      furnace.close();
      logger.bot(`🍳 放入了 ${cooked} 个食材到熔炉`);
      return { success: true, message: `放入了 ${cooked} 个食材到熔炉` };
    } catch (err) {
      return { success: false, message: `烹饪失败: ${(err as Error).message}` };
    }
  },
};

registerSkill(cookSkill);
