import pf from 'mineflayer-pathfinder';
import { registerSkill, type Skill, type SkillContext, type SkillResult } from './index.js';
import { logger } from '../utils/logger.js';

const { Movements, goals } = pf;
const GoalNear = goals.GoalNear;

const moveSkill: Skill = {
  name: 'move',
  description: '移动到指定坐标',
  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { bot, args } = ctx;
    let x = Number(args.x ?? 0);
    let y = Number(args.y ?? 64);
    let z = Number(args.z ?? 0);

    // 修正不合理的坐标：如果目标 y 和当前位置差距过大，改为在地表移动
    const curPos = bot.entity.position;
    if (y < curPos.y - 5 || y > curPos.y + 10) {
      // 目标坐标不合理（在地底或天上），改为以当前位置为基准偏移
      y = Math.floor(curPos.y);
      x = Math.floor(curPos.x) + (x !== 0 ? Math.sign(x) * Math.min(Math.abs(x), 20) : 0);
      z = Math.floor(curPos.z) + (z !== 0 ? Math.sign(z) * Math.min(Math.abs(z), 20) : 0);
    }

    const mcData = (bot as any).mcData ?? await import('minecraft-data');
    const movements = new Movements(bot);
    bot.pathfinder.setMovements(movements);

    // 设置寻路超时
    const timeout = 15000; // 15 seconds

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        bot.pathfinder.stop();
        resolve({ success: false, message: '移动超时' });
      }, timeout);

      bot.pathfinder.goto(new GoalNear(x, y, z, 2))
        .then(() => {
          clearTimeout(timer);
          logger.bot(`移动到 (${x}, ${y}, ${z})`);
          resolve({ success: true, message: `到达 (${x}, ${y}, ${z})` });
        })
        .catch((err: Error) => {
          clearTimeout(timer);
          resolve({ success: false, message: `移动失败: ${err.message}` });
        });
    });
  },
};

registerSkill(moveSkill);
