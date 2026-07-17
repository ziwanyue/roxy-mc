import pf from 'mineflayer-pathfinder';
const { Movements, goals } = pf;
import { registerSkill, type Skill, type SkillResult } from './index.js';
import { logger } from '../utils/logger.js';

const fleeSkill: Skill = {
  name: 'flee',
  description: '紧急逃离危险（苦力怕、岩浆、高处坠落）',
  async execute(ctx: { bot: any; args: Record<string, unknown> }): Promise<{ success: boolean; message?: string }> {
    const { bot } = ctx;
    const pos = bot.entity.position;
    let fleeTarget = null;

    // 1. 检查最近的威胁
    const threats: Array<{ pos: any; dist: number; name: string }> = [];

    for (const entity of Object.values(bot.entities) as any[]) {
      if (!entity || entity === bot.entity) continue;
      const dist = entity.position.distanceTo(pos);
      if (dist > 8) continue;

      const name = entity.name || '';
      // 苦力怕：高优先逃离
      if (name === 'creeper') {
        threats.push({ pos: entity.position, dist, name: 'creeper' });
      }
      // 骷髅弓箭手
      if (name === 'skeleton') {
        threats.push({ pos: entity.position, dist, name: 'skeleton' });
      }
      // 僵尸
      if (name === 'zombie' && dist < 3) {
        threats.push({ pos: entity.position, dist, name: 'zombie' });
      }
    }

    // 2. 检查脚下是否有岩浆/火
    const feetBlock = bot.blockAt({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) } as any);
    if (feetBlock && (feetBlock.name === 'lava' || feetBlock.name === 'fire' || feetBlock.name === 'magma_block')) {
      threats.push({ pos: pos, dist: 0, name: 'lava' });
    }

    // 3. 检查血量太低
    if (bot.health < 6) {
      threats.push({ pos: pos, dist: 0, name: 'low_health' });
    }

    if (threats.length === 0) {
      return { success: true, message: '附近没有危险' };
    }

    // 选择逃离方向：远离最近的威胁
    const nearest = threats.sort((a, b) => a.dist - b.dist)[0];
    const threatPos = nearest.dist > 0 ? nearest.pos : pos;

    // 逃离方向 = 远离威胁
    const dirX = pos.x - threatPos.x;
    const dirZ = pos.z - threatPos.z;
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;

    const runDistance = 15;
    fleeTarget = {
      x: Math.floor(pos.x + (dirX / len) * runDistance),
      y: Math.floor(pos.y),
      z: Math.floor(pos.z + (dirZ / len) * runDistance),
    };

    // 找到地表高度
    for (let y = 120; y > 0; y--) {
      const block = bot.blockAt({ x: fleeTarget.x, y, z: fleeTarget.z } as any);
      if (block && block.name !== 'air') {
        fleeTarget.y = y + 1;
        break;
      }
    }

    const movements = new Movements(bot);
    bot.pathfinder.setMovements(movements);

    try {
      await bot.pathfinder.goto(new goals.GoalNear(fleeTarget.x, fleeTarget.y, fleeTarget.z, 3));
      const msg = nearest.name === 'creeper' ? '💥 苦力怕！快跑！' :
                  nearest.name === 'lava' ? '🔥 有岩浆！躲开！' :
                  nearest.name === 'low_health' ? '❤️ 血量太低，先撤！' :
                  `⚠️ 逃离 ${nearest.name}`;
      logger.bot(msg);
      return { success: true, message: msg };
    } catch {
      return { success: false, message: '逃跑时被卡住了！' };
    }
  },
};

registerSkill(fleeSkill);
