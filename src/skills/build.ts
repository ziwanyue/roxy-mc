import pf from 'mineflayer-pathfinder';
const { Movements, goals } = pf;
import { registerSkill, type Skill, type SkillResult } from './index.js';
import { logger } from '../utils/logger.js';
import { memory } from '../utils/memory.js';
import { findBlueprint, listBlueprints } from '../utils/blueprints.js';

interface BuildTemplate {
  width: number;
  depth: number;
  height: number;
  hasRoof: boolean;
}

const templates: Record<string, BuildTemplate> = {
  shelter: { width: 5, depth: 4, height: 3, hasRoof: true },
  house: { width: 7, depth: 5, height: 4, hasRoof: true },
  wall: { width: 6, depth: 1, height: 3, hasRoof: false },
  floor: { width: 5, depth: 5, height: 1, hasRoof: false },
  tower: { width: 3, depth: 3, height: 5, hasRoof: true },
};

const buildSkill = {
  name: 'build',
  description: '建筑方块结构或蓝图图纸',
  async execute(ctx: { bot: any; args: Record<string, unknown> }): Promise<{ success: boolean; message?: string }> {
    const { bot, args } = ctx;
    const structureType = String(args.structure ?? '');
    const blueprintName = String(args.blueprint ?? '');
    const materialName = String(args.material ?? 'oak_planks');

    // == 模式1: 蓝图建造 ==
    if (blueprintName || structureType === 'blueprint') {
      const avail = listBlueprints();
      // 如果没指定名称，列出可用图纸
      if (!blueprintName || blueprintName === 'list') {
        return { success: true, message: `可用图纸: ${avail.join(', ')}` };
      }
      const bp = findBlueprint(blueprintName);
      if (!bp) {
        return { success: false, message: `未找到图纸「${blueprintName}」，可用: ${avail.join(', ')}` };
      }
      return buildFromBlueprint(bot, bp);
    }

    // == 模式2: 模板建造（旧模式）==
    const template = templates[structureType];
    if (!template) {
      // 默认显示可用建筑
      const bpNames = listBlueprints();
      return { success: false, message: `未知类型。可用: ${Object.keys(templates).join(', ')}, 或图纸: ${bpNames.join(', ')}` };
    }

    const material = bot.registry?.blocksByName?.[materialName]
      ?? bot.registry?.blocksByName?.oak_planks
      ?? bot.registry?.blocksByName?.stone;
    if (!material) return { success: false, message: `未知材料: ${materialName}` };

    const hasMaterial = bot.inventory.items().some((i: any) => i.name === material.name);
    if (!hasMaterial) return { success: false, message: `物品栏没有 ${materialName}` };

    const pos = bot.entity.position;
    const origin = { x: Math.floor(pos.x) + 3, y: Math.floor(pos.y), z: Math.floor(pos.z) + 2 };

    const movements = new Movements(bot);
    bot.pathfinder.setMovements(movements);
    try {
      await bot.pathfinder.goto(new goals.GoalNear(origin.x, origin.y, origin.z, 3));
    } catch { /* continue */ }

    const { width, depth, height: _h } = template;
    let placed = 0;

    for (let x = 0; x < width && placed < 30; x++) {
      for (let z = 0; z < depth && placed < 30; z++) {
        const item = bot.inventory.items().find((i: any) => i.name === material.name);
        if (!item) break;
        try {
          await bot.equip(item, 'hand');
          const target = { x: origin.x + x, y: origin.y, z: origin.z + z };
          const refBlock = bot.blockAt(target.x, target.y - 1, target.z);
          if (refBlock && refBlock.name !== 'air') {
            await bot.placeBlock(refBlock, { x: 0, y: 1, z: 0 } as any);
            placed++;
          }
        } catch { /* skip */ }
      }
    }

    logger.bot(`建好了 ${structureType}（放置了 ${placed} 个方块）`);
    memory.addEvent(`建了一个 ${structureType}`);
    return { success: true, message: `${structureType} 建好了！` };
  },
};

/**
 * 从蓝图建造
 */
async function buildFromBlueprint(bot: any, bp: import('../utils/blueprints.js').Blueprint): Promise<{ success: boolean; message?: string }> {
  const pos = bot.entity.position;
  const origin = {
    x: Math.floor(pos.x) + 2,
    y: Math.floor(pos.y),
    z: Math.floor(pos.z) + 2,
  };

  // 检查材料
  const neededBlocks = new Set(bp.blocks.map(b => b.blockName));
  const inventoryNames = new Set(bot.inventory.items().map((i: any) => i.name));
  const missing = [...neededBlocks].filter(n => !inventoryNames.has(n));

  if (missing.length > 0) {
    return { success: false, message: `缺少材料: ${missing.slice(0, 5).join(', ')}. 先收集这些材料吧！` };
  }

  // 移动到建筑位置
  const movements = new Movements(bot);
  bot.pathfinder.setMovements(movements);
  try {
    await bot.pathfinder.goto(new goals.GoalNear(origin.x, origin.y, origin.z, 3));
  } catch { /* continue */ }

  let placed = 0;
  const total = bp.blocks.length;

  // 按层排序（从下往上建）
  const sortedBlocks = [...bp.blocks].sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);

  for (const block of sortedBlocks) {
    const targetX = origin.x + block.x;
    const targetY = origin.y + block.y;
    const targetZ = origin.z + block.z;

    // 找物品栏里对应的方块
    const item = bot.inventory.items().find((i: any) => i.name === block.blockName);
    if (!item) continue;

    try {
      await bot.equip(item, 'hand');
      // 寻路到目标位置附近
      await bot.pathfinder.goto(new goals.GoalNear(targetX, targetY, targetZ, 2));
      // 放在脚下方块上面或旁边
      const refBlock = bot.blockAt(targetX, targetY - 1, targetZ);
      if (refBlock && refBlock.name !== 'air') {
        await bot.placeBlock(refBlock, { x: 0, y: 1, z: 0 } as any);
        placed++;
      }
    } catch { /* skip problematic blocks */ }

    // 每放 10 个方块报告进度
    if (placed > 0 && placed % 10 === 0) {
      logger.bot(`🏗️ ${bp.name}: ${placed}/${total}`);
    }
  }

  logger.bot(`🏠 ${bp.name} 建造完成！(放置 ${placed}/${total} 方块)`);
  memory.addEvent(`建好了「${bp.name}」`);

  const pct = Math.round((placed / total) * 100);
  return { success: true, message: `「${bp.name}」建好了！完成度 ${pct}% (${placed}/${total})` };
}

registerSkill(buildSkill);
