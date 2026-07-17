import { registerSkill, type Skill, type SkillContext, type SkillResult } from './index.js';
import { logger } from '../utils/logger.js';

interface ItemDef {
  name: string;
  displayName: string;
  requiresTable: boolean;
}

const items: Record<string, ItemDef> = {
  crafting_table: { name: 'crafting_table', displayName: '工作台', requiresTable: false },
  torch: { name: 'torch', displayName: '火把', requiresTable: false },
  chest: { name: 'chest', displayName: '箱子', requiresTable: true },
  bed: { name: 'red_bed', displayName: '床', requiresTable: true },
  furnace: { name: 'furnace', displayName: '熔炉', requiresTable: true },
  pickaxe_wood: { name: 'wooden_pickaxe', displayName: '木镐', requiresTable: false },
  pickaxe_stone: { name: 'stone_pickaxe', displayName: '石镐', requiresTable: true },
  sword_wood: { name: 'wooden_sword', displayName: '木剑', requiresTable: false },
  sword_stone: { name: 'stone_sword', displayName: '石剑', requiresTable: true },
  axe_wood: { name: 'wooden_axe', displayName: '木斧', requiresTable: false },
};

const craftSkill: Skill = {
  name: 'craft',
  description: '合成物品（crafting_table/torch/chest/bed/furnace/pickaxe/sword/axe）',
  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { bot, args } = ctx;
    const itemName = String(args.item ?? 'torch').toLowerCase();
    const count = Math.max(1, Math.min(64, Number(args.count ?? 1)));

    const def = items[itemName];
    if (!def) {
      return { success: false, message: `未知物品: ${itemName}` };
    }

    const registry = bot.registry;
    if (!registry?.itemsByName) return { success: false, message: '无法加载物品数据' };

    const itemId = registry.itemsByName[def.name]?.id;
    if (itemId === undefined) return { success: false, message: `未知物品ID: ${def.name}` };

    try {
      // 确保附近有工作台（如果需要）
      let craftingTable = null;
      if (def.requiresTable) {
        craftingTable = bot.findBlock({
          matching: registry.blocksByName?.crafting_table?.id,
          maxDistance: 5,
        });

        if (!craftingTable) {
          // 尝试放置工作台
          const tableItem = bot.inventory.items().find(i => i.name === 'crafting_table');
          if (!tableItem) {
            return { success: false, message: '需要工作台，但物品栏里没有' };
          }
          await bot.equip(tableItem, 'hand');
          const refBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
          if (refBlock) {
            try { await bot.placeBlock(refBlock, { x: 0, y: 1, z: 0 } as any); } catch {}
          }
          // 重新找工作台
          craftingTable = bot.findBlock({
            matching: registry.blocksByName?.crafting_table?.id,
            maxDistance: 5,
          });
        }
      }

      // 查找配方
      const recipesList = bot.recipesAll(
        itemId,
        null,
        def.requiresTable
      );

      if (!recipesList || recipesList.length === 0) {
        return { success: false, message: `不知道怎么合成 ${def.displayName}` };
      }

      // 合成物品
      await bot.craft(recipesList[0], count, craftingTable ?? undefined);

      logger.bot(`合成了 ${def.displayName} x${count}`);
      return { success: true, message: `合成了 ${def.displayName} x${count}` };
    } catch (err) {
      return { success: false, message: `合成失败: ${(err as Error).message}` };
    }
  },
};

registerSkill(craftSkill);
