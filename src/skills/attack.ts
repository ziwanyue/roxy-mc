import { registerSkill, type Skill, type SkillContext, type SkillResult } from './index.js';
import { logger } from '../utils/logger.js';
import { equipBestWeapon } from '../utils/tools.js';

const attackSkill: Skill = {
  name: 'attack',
  description: '攻击最近的敌对生物',
  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { bot } = ctx;

    // 像真玩家一样先拔剑！
    await equipBestWeapon(bot);

    // 找最近的敌对实体
    const hostileFilter = (e: any) => {
      if (!e || e === bot.entity) return false;
      const hostileTypes = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman',
                            'witch', 'slime', 'phantom', 'drowned', 'pillager',
                            'wither_skeleton', 'blaze', 'ghast', 'hoglin', 'piglin_brute'];
      return hostileTypes.includes(e.name);
    };

    const target = bot.nearestEntity(hostileFilter);
    if (!target) {
      return { success: true, message: '附近没有敌对生物' };
    }

    const dist = target.position.distanceTo(bot.entity.position);
    if (dist > 4) {
      const pf = await import('mineflayer-pathfinder');
      const movements = new pf.Movements(bot);
      bot.pathfinder.setMovements(movements);
      try {
        await bot.pathfinder.goto(new pf.goals.GoalNear(
          target.position.x, target.position.y, target.position.z, 2
        ));
      } catch { /* 接近失败也继续尝试攻击 */ }
    }

    // 连续攻击（像玩家一样连点）
    for (let i = 0; i < 3; i++) {
      bot.attack(target);
      await new Promise(r => setTimeout(r, 300));
    }

    logger.bot(`攻击了 ${target.name ?? '实体'}`);
    return { success: true, message: `攻击了 ${target.name ?? '实体'}` };
  },
};

registerSkill(attackSkill);
