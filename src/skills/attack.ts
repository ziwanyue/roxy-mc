import { registerSkill, type Skill, type SkillContext, type SkillResult } from './index.js';
import { logger } from '../utils/logger.js';
import { equipBestWeapon, equipBestArmor } from '../utils/tools.js';

// 所有敌对/中立生物完整列表
const HOSTILE_MOBS = new Set([
  // 亡灵系
  'zombie', 'husk', 'drowned', 'zombie_villager', 'zombified_piglin',
  'skeleton', 'stray', 'wither_skeleton', 'skeleton_horse', 'zombie_horse',
  'phantom', 'wither',

  // 节肢系
  'spider', 'cave_spider', 'silverfish', 'endermite',

  // 苦力怕系
  'creeper',

  // 末影系
  'enderman', 'ender_dragon', 'shulker',

  // 地狱系
  'blaze', 'ghast', 'magma_cube', 'piglin', 'piglin_brute',
  'hoglin', 'zoglin',

  // 灾厄村民系
  'pillager', 'vindicator', 'evoker', 'ravager', 'witch',

  // 史莱姆系
  'slime',

  // 其他
  'guardian', 'elder_guardian', 'vex',
]);

// 威胁等级（距离阈值）
const THREAT_RANGES: Record<string, number> = {
  creeper: 8,        // 苦力怕：远距离警戒
  skeleton: 12,      // 骷髅：远程攻击
  blaze: 10,         // 烈焰人：远程火球
  ghast: 15,         // 恶魂：远程火球
  enderman: 6,       // 末影人：靠近才敌意
  wither: 20,        // 凋灵：boss
  phantom: 12,       // 幻翼：俯冲攻击
  ender_dragon: 30,  // 末影龙：boss
  ravager: 8,        // 劫掠兽：高伤害
  piglin_brute: 8,   // 猪灵蛮兵：高伤害
};

// 速度倍率（相对于玩家）
const MOB_SPEEDS: Record<string, number> = {
  spider: 1.2, zombie: 0.8, skeleton: 0.9, creeper: 0.85,
  phantom: 1.5, wolf: 1.3, enderman: 1.1,
};

const attackSkill: Skill = {
  name: 'attack',
  description: '战斗系统——自动识别并攻击附近的敌对生物',
  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { bot } = ctx;

    // 0. 自动装备盔甲
    await equipBestArmor(bot);

    // 1. 自动拔剑
    await equipBestWeapon(bot);

    // 2. 搜索威胁
    const threats: Array<{ entity: any; name: string; dist: number; priority: number }> = [];

    for (const entity of Object.values(bot.entities) as any[]) {
      if (!entity || entity === bot.entity) continue;
      if (!entity.name) continue;
      if (!HOSTILE_MOBS.has(entity.name)) continue;

      const dist = entity.position.distanceTo(bot.entity.position);
      const range = THREAT_RANGES[entity.name] ?? 10;
      if (dist > range) continue;

      // 计算优先级
      let priority = 100 - dist;
      if (entity.name === 'creeper') priority += 20;   // 苦力怕最高优先
      if (entity.name === 'skeleton') priority += 10;  // 骷髅远程优先
      if (entity.name === 'wither') priority += 50;    // Boss 最高
      if (entity.name === 'ender_dragon') priority += 50;

      threats.push({ entity, name: entity.name, dist, priority });
    }

    if (threats.length === 0) {
      return { success: true, message: '安全，没有发现怪物' };
    }

    // 按优先级排序
    threats.sort((a, b) => b.priority - a.priority);
    const target = threats[0];

    // 战吼
    const battleCries = [
      '有怪物！交给我吧！', '看我的！',
      '水王级魔术师，参上！', '不会让你伤害他的！',
      '哼，就这种程度？', '小心，我来处理！',
    ];
    if (Math.random() < 0.3) {
      bot.chat(battleCries[Math.floor(Math.random() * battleCries.length)]);
    }

    // 3. 特殊怪物战术
    const dist = target.dist;

    // 苦力怕战术：打一下就跑
    if (target.name === 'creeper' && dist < 3) {
      // 后撤
      const pf = await import('mineflayer-pathfinder');
      const dir = {
        x: bot.entity.position.x - target.entity.position.x,
        z: bot.entity.position.z - target.entity.position.z,
      };
      const len = Math.sqrt(dir.x * dir.x + dir.z * dir.z) || 1;
      const fleePos = {
        x: bot.entity.position.x + (dir.x / len) * 6,
        y: bot.entity.position.y,
        z: bot.entity.position.z + (dir.z / len) * 6,
      };
      const movements = new pf.Movements(bot);
      bot.pathfinder.setMovements(movements);
      try {
        await bot.pathfinder.goto(new pf.goals.GoalNear(fleePos.x, fleePos.y, fleePos.z, 2));
      } catch { /* 跑不掉就硬打 */ }
      // 回头射一箭
      bot.attack(target.entity);
      logger.bot('💥 苦力怕！打带跑！');
      return { success: true, message: '击退苦力怕！' };
    }

    // 骷髅/烈焰人战术：蛇形接近
    if ((target.name === 'skeleton' || target.name === 'blaze') && dist > 4) {
      const pf = await import('mineflayer-pathfinder');
      const movements = new pf.Movements(bot);
      bot.pathfinder.setMovements(movements);
      // 之字形接近
      const offset = { x: Math.random() * 3 - 1.5, z: Math.random() * 3 - 1.5 };
      try {
        await bot.pathfinder.goto(new pf.goals.GoalNear(
          target.entity.position.x + offset.x,
          target.entity.position.y,
          target.entity.position.z + offset.z, 2
        ));
      } catch { /* 继续接近 */ }
    }

    // 4. 近战攻击
    if (dist < 5) {
      // 连续攻击
      let hits = 0;
      for (let i = 0; i < 4; i++) {
        try {
          bot.attack(target.entity);
          hits++;
          await new Promise(r => setTimeout(r, 250));
        } catch { break; }
      }
      logger.bot(`⚔️ 攻击 ${target.name} x${hits}`);

      // 调整位置继续
      {
        // 侧绕
        const pf = await import('mineflayer-pathfinder');
        const movements = new pf.Movements(bot);
        bot.pathfinder.setMovements(movements);
        try {
          const side = { x: target.entity.position.x + 2, y: target.entity.position.y, z: target.entity.position.z + 1 };
          await bot.pathfinder.goto(new pf.goals.GoalNear(side.x, side.y, side.z, 1));
        } catch { /* */ }
      }

      return { success: true, message: `⚔️ 与 ${target.name} 战斗` };
    }

    // 5. 远程/接近中
    const pf = await import('mineflayer-pathfinder');
    const movements = new pf.Movements(bot);
    bot.pathfinder.setMovements(movements);
    try {
      await bot.pathfinder.goto(new pf.goals.GoalNear(
        target.entity.position.x, target.entity.position.y, target.entity.position.z, 2
      ));
    } catch { /* */ }

    return { success: true, message: `接近 ${target.name} 中` };
  },
};

registerSkill(attackSkill);
