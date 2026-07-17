import pf from 'mineflayer-pathfinder';
const { Movements, goals } = pf;
const GoalNear = goals.GoalNear;
import { registerSkill, type Skill, type SkillContext, type SkillResult } from './index.js';
import { logger } from '../utils/logger.js';
import { equipBestTool } from '../utils/tools.js';

const mineSkill: Skill = {
  name: 'mine',
  description: '挖掘指定类型的方块',
  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { bot, args } = ctx;
    let blockType = String(args.blockType ?? 'stone');

    const blockAliases = [
      blockType,
      blockType.replace(/_/g, ''),
      blockType.replace('minecraft:', ''),
      blockType.split(':')[1] || blockType,
      ...blockType.split('_').map((p, i, arr) => arr.slice(i).join('_')),
    ].filter(Boolean);

    const blocks = bot.registry?.blocksByName;
    if (!blocks) {
      return { success: false, message: '无法加载方块数据' };
    }

    let foundAlias: string | undefined;
    let blockId = undefined;

    for (const alias of [...new Set(blockAliases)]) {
      blockId = blocks[alias]?.id;
      if (blockId !== undefined) {
        foundAlias = alias;
        break;
      }
    }

    if (blockId === undefined) {
      return { success: false, message: `未知方块类型: ${blockType}` };
    }
    blockType = foundAlias!;

    const block = bot.findBlock({
      matching: blockId,
      maxDistance: 32,
    });

    if (!block) {
      return { success: false, message: `附近没有找到 ${blockType}` };
    }

    // 像真玩家一样先换工具！
    await equipBestTool(bot, blockType);

    const movements = new Movements(bot);
    bot.pathfinder.setMovements(movements);

    try {
      await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 2));
      await bot.dig(block);
      logger.bot(`挖了一个 ${blockType}`);
      return { success: true, message: `成功挖掘 ${blockType}` };
    } catch (err) {
      return { success: false, message: `挖掘失败: ${(err as Error).message}` };
    }
  },
};

registerSkill(mineSkill);
