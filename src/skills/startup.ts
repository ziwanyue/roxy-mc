import type { Bot } from 'mineflayer';
import { logger } from '../utils/logger.js';
import { equipBestTool } from '../utils/tools.js';

/**
 * 自动开荒流程：砍树 → 工作台 → 木镐 → 挖石 → 石镐
 */
export async function autoStartup(bot: Bot): Promise<void> {
  const items = bot.inventory.items().map(i => i.name);

  if (items.some(n => n.includes('stone_pickaxe') || n.includes('iron_pickaxe'))) {
    logger.info('已有工具，跳过自动开荒');
    return;
  }

  // 等世界加载好
  await new Promise(r => setTimeout(r, 3000));

  try {
    // 砍附近的树
    logger.bot('先砍点木头...');
    const logTypes = ['oak_log', 'birch_log', 'spruce_log', 'dark_oak_log', 'jungle_log', 'acacia_log'];
    let totalMined = 0;
    for (const log of logTypes) {
      if (totalMined >= 6) break;
      const mined = await mineBlock(bot, log, 6 - totalMined);
      totalMined += mined;
    }

    if (totalMined === 0) {
      logger.warn('附近没有树，跳过自动开荒（可能出生在非森林地形）');
      return;
    }

    logger.bot(`砍了 ${totalMined} 块木头`);

    // 检查木板
    let planks = bot.inventory.items().find(i => i.name.includes('_planks'));
    if (!planks) {
      logger.warn('没有木板，无法合成');
      return;
    }

    // 合成工作台
    await craftItem(bot, 'crafting_table', 1);

    // 放置工作台
    const table = bot.inventory.items().find(i => i.name === 'crafting_table');
    if (table) {
      await bot.equip(table, 'hand');
      const pos = bot.entity.position;
      const target = { x: Math.floor(pos.x) + 2, y: Math.floor(pos.y), z: Math.floor(pos.z) };
      const ref = bot.blockAt(target as any);
      if (ref?.name === 'air') {
        try { await bot.placeBlock(ref, { x: 0, y: 1, z: 0 } as any); logger.bot('放好了工作台'); } catch { }
      }
    }

    // 木镐
    await craftItem(bot, 'wooden_pickaxe', 1);

    // 挖石头 → 石镐
    await mineBlock(bot, 'stone', 3);
    await craftItem(bot, 'stone_pickaxe', 1);

    // 木剑
    await craftItem(bot, 'wooden_sword', 1);

    logger.success('自动开荒完成！');
  } catch (err) {
    logger.warn(`自动开荒中断: ${(err as Error).message}`);
  }
}

async function mineBlock(bot: Bot, name: string, count: number): Promise<number> {
  const blocks = bot.registry?.blocksByName;
  if (!blocks) return 0;

  const blockId = blocks[name]?.id;
  if (blockId === undefined) return 0;

  let mined = 0;
  for (let attempt = 0; attempt < count * 8 && mined < count; attempt++) {
    const block = bot.findBlock({ matching: blockId, maxDistance: 16 });
    if (!block) break;

    await equipBestTool(bot, name);
    const pf = await import('mineflayer-pathfinder');
    bot.pathfinder.setMovements(new pf.Movements(bot));
    try {
      await bot.pathfinder.goto(new pf.goals.GoalNear(block.position.x, block.position.y, block.position.z, 2));
      await bot.dig(block);
      mined++;
    } catch { continue; }
  }
  return mined;
}

async function craftItem(bot: Bot, itemName: string, count: number): Promise<void> {
  const registry = bot.registry;
  const item = registry?.itemsByName?.[itemName];
  if (!item) return;

  const recipes = bot.recipesFor(item.id, null, 1, null as any);
  if (!recipes?.length) return;

  try {
    await bot.craft(recipes[0], count);
    logger.bot(`合成了 ${itemName} x${count}`);
  } catch { /* 材料不够 */ }
}
