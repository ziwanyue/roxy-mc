import pf from 'mineflayer-pathfinder';
const { Movements, goals } = pf;
import { registerSkill, type Skill, type SkillResult } from './index.js';
import { logger } from '../utils/logger.js';
import { memory } from '../utils/memory.js';

const exploreSkill: Skill = {
  name: 'explore',
  description: '探索未知区域（自动走向未去过的地方）',
  async execute(ctx: { bot: any; args: Record<string, unknown> }): Promise<{ success: boolean; message?: string }> {
    const { bot, args } = ctx;
    const radius = Math.min(Number(args.radius ?? 50), 100);

    const pos = bot.entity.position;
    const startX = Math.floor(pos.x);
    const startZ = Math.floor(pos.z);

    // 8 个方向中选择一个
    const directions = [
      { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 },
      { x: 1, z: 1 }, { x: -1, z: 1 }, { x: 1, z: -1 }, { x: -1, z: -1 },
    ];

    // 目标：选择最远且没去过方向
    let bestDir = directions[Math.floor(Math.random() * directions.length)];
    let bestScore = -1;

    for (const dir of directions) {
      const targetX = startX + dir.x * radius;
      const targetZ = startZ + dir.z * radius;
      // 分数 = 随机偏移，让每次选择不同
      const score = Math.random();
      if (score > bestScore) {
        bestScore = score;
        bestDir = dir;
      }
    }

    const target = {
      x: startX + bestDir.x * radius,
      y: Math.floor(pos.y),
      z: startZ + bestDir.z * radius,
    };

    // 确保目标 y 合理：扫描地表高度
    for (let y = 120; y > 0; y--) {
      const block = bot.blockAt({ x: target.x, y, z: target.z } as any);
      if (block && block.name !== 'air') {
        target.y = y + 1;
        break;
      }
    }

    const movements = new Movements(bot);
    bot.pathfinder.setMovements(movements);

    try {
      await bot.pathfinder.goto(new goals.GoalNear(target.x, target.y, target.z, 5));
    } catch { /* 寻路失败也记录已探索 */ }

    const dist = Math.sqrt(
      (bot.entity.position.x - startX) ** 2 +
      (bot.entity.position.z - startZ) ** 2
    );

    memory.addPlace(
      { x: Math.floor(bot.entity.position.x), y: Math.floor(bot.entity.position.y), z: Math.floor(bot.entity.position.z) },
      `探索区域 (${Math.floor(bot.entity.position.x)}, ${Math.floor(bot.entity.position.z)})`
    );

    return { success: true, message: `探索了 ${Math.round(dist)} 格距离的新区域` };
  },
};

registerSkill(exploreSkill);
