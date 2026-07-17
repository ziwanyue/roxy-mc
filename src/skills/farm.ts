import pf from 'mineflayer-pathfinder';
const { Movements, goals } = pf;
import { registerSkill, type Skill, type SkillResult } from './index.js';
import { logger } from '../utils/logger.js';
import { memory } from '../utils/memory.js';

const farmSkill: Skill = {
  name: 'farm',
  description: '种地/收菜（找附近耕地种种子，或收获成熟作物）',
  async execute(ctx: { bot: any; args: Record<string, unknown> }): Promise<{ success: boolean; message?: string }> {
    const { bot, args } = ctx;
    const mode = String(args.mode ?? 'auto'); // plant, harvest, auto

    const registry = bot.registry;
    if (!registry?.blocksByName) return { success: false, message: '无法加载数据' };

    // 可种植的种子
    const seeds: Record<string, string> = {
      wheat_seeds: 'wheat',
      carrot: 'carrots',
      potato: 'potatoes',
      beetroot_seeds: 'beetroots',
      melon_seeds: 'melon',
      pumpkin_seeds: 'pumpkin',
    };

    if (mode === 'harvest' || mode === 'auto') {
      const cropTypes = Object.values(seeds);
      let harvested = 0;
      for (let dx = -8; dx <= 8 && harvested < 20; dx++) {
        for (let dz = -8; dz <= 8 && harvested < 20; dz++) {
          for (let dy = -2; dy <= 2; dy++) {
            const x = Math.floor(bot.entity.position.x) + dx;
            const y = Math.floor(bot.entity.position.y) + dy;
            const z = Math.floor(bot.entity.position.z) + dz;
            const block = bot.blockAt({ x, y, z } as any);
            if (!block || !cropTypes.includes(block.name)) continue;
            if (block.metadata === 7 || block.metadata === 3 || block.metadata === 4) {
              try {
                await bot.dig(block);
                harvested++;
                logger.bot(`收获了 ${block.name}`);
              } catch { /* skip */ }
            }
          }
        }
      }
      if (harvested > 0) memory.addEvent(`收获了 ${harvested} 个作物`);
    }

    if (mode === 'plant' || mode === 'auto') {
      const seedItem = bot.inventory.items().find((i: any) => seeds[i.name]);
      if (!seedItem) return { success: false, message: '没有种子可以种' };

      const seedName = seedItem.name;
      const movements = new Movements(bot);
      bot.pathfinder.setMovements(movements);

      let planted = 0;
      for (let dx = -5; dx <= 5 && planted < 10; dx++) {
        for (let dz = -5; dz <= 5 && planted < 10; dz++) {
          for (let dy = -2; dy <= 2; dy++) {
            const x = Math.floor(bot.entity.position.x) + dx;
            const y = Math.floor(bot.entity.position.y) + dy;
            const z = Math.floor(bot.entity.position.z) + dz;
            const block = bot.blockAt({ x, y, z } as any);
            if (!block || block.name !== 'farmland') continue;

            const above = bot.blockAt({ x: block.position.x, y: block.position.y + 1, z: block.position.z } as any);
            if (above && above.name !== 'air') continue;

            try {
              await bot.pathfinder.goto(new goals.GoalNear(block.position.x, block.position.y, block.position.z, 2));
              const seed = bot.inventory.items().find((i: any) => i.name === seedName);
              if (!seed) break;
              await bot.equip(seed, 'hand');
              await bot.placeBlock(block, { x: 0, y: 1, z: 0 } as any);
              planted++;
            } catch { /* skip */ }
          }
        }
      }

      if (planted > 0) {
        logger.bot(`种了 ${planted} 颗 ${seedName}`);
        memory.addEvent(`种了 ${planted} 颗作物`);
      }
    }

    return { success: true, message: '农活干完了！' };
  },
};

registerSkill(farmSkill);
