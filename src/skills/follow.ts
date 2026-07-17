import pf from 'mineflayer-pathfinder';
const { Movements, goals } = pf;
const GoalNear = goals.GoalNear;
import { registerSkill, type Skill, type SkillContext, type SkillResult } from './index.js';
import { logger } from '../utils/logger.js';

const followSkill: Skill = {
  name: 'follow',
  description: '跟随玩家',
  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { bot, args } = ctx;
    const targetName = String(args.player ?? ctx.targetPlayer ?? '');

    const target = bot.players[targetName]?.entity;
    if (!target) {
      return { success: false, message: `找不到玩家: ${targetName}` };
    }

    const movements = new Movements(bot);
    bot.pathfinder.setMovements(movements);

    const pos = target.position;
    return new Promise((resolve) => {
      bot.pathfinder.goto(new GoalNear(pos.x, pos.y, pos.z, 2))
        .then(() => {
          logger.bot(`跟随 ${targetName} 到达位置`);
          resolve({ success: true, message: `已跟随 ${targetName}` });
        })
        .catch((err: Error) => {
          resolve({ success: false, message: `跟随失败: ${err.message}` });
        });
    });
  },
};

registerSkill(followSkill);
