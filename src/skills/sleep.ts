import { registerSkill, type Skill, type SkillContext, type SkillResult } from './index.js';
import { logger } from '../utils/logger.js';

const sleepSkill: Skill = {
  name: 'sleep',
  description: '找附近的床睡觉（天黑时使用）',
  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { bot } = ctx;

    // 找附近的床
    const bedBlock = bot.findBlock({
      matching: (block: any) => {
        const name = block?.name ?? '';
        return name.includes('bed') || name.includes('_bed');
      },
      maxDistance: 16,
    });

    if (!bedBlock) {
      return { success: false, message: '附近没有床，今晚要熬夜了' };
    }

    try {
      // 走到床边
      const pf = await import('mineflayer-pathfinder');
      const movements = new pf.Movements(bot);
      bot.pathfinder.setMovements(movements);
      await bot.pathfinder.goto(new pf.goals.GoalNear(
        bedBlock.position.x, bedBlock.position.y, bedBlock.position.z, 2
      ));

      // 睡觉
      await bot.sleep(bedBlock);
      logger.bot('晚安～明天见！');
      return { success: true, message: '睡觉了，晚安！' };
    } catch (err) {
      return { success: false, message: `睡觉失败: ${(err as Error).message}` };
    }
  },
};

registerSkill(sleepSkill);
