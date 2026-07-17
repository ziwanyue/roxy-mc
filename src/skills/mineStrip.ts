import pf from 'mineflayer-pathfinder';
const { Movements, goals } = pf;
import { registerSkill, type Skill, type SkillResult } from './index.js';
import { logger } from '../utils/logger.js';

const mineStripSkill: Skill = {
  name: 'mineStrip',
  description: '分支矿道挖掘（挖一条笔直的水平矿道）',
  async execute(ctx: { bot: any; args: Record<string, unknown> }): Promise<SkillResult> {
    const { bot, args } = ctx;
    const length = Math.min(Number(args.length ?? 15), 30);
    const direction = Number(args.direction ?? 0); // 0=正X, 1=负X, 2=正Z, 3=负Z

    const pos = bot.entity.position;
    const startY = Math.floor(pos.y);

    const dirs = [
      { x: 1, z: 0 },
      { x: -1, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: -1 },
    ];
    const dir = dirs[direction] || dirs[0];
    const startX = Math.floor(pos.x);
    const startZ = Math.floor(pos.z);

    // 移动到起始位置
    const movements = new Movements(bot);
    bot.pathfinder.setMovements(movements);
    try {
      await bot.pathfinder.goto(new goals.GoalNear(startX, startY, startZ, 1));
    } catch { /* continue */ }

    let mined = 0;
    for (let i = 1; i <= length && mined < 50; i++) {
      const targetX = startX + dir.x * i;
      const targetZ = startZ + dir.z * i;

      // 挖面前的方块
      const block = bot.blockAt({ x: targetX, y: startY, z: targetZ } as any);
      if (block && block.name !== 'air') {
        try {
          // 先走到方块旁边
          await bot.pathfinder.goto(new goals.GoalNear(targetX - dir.x, startY, targetZ - dir.z, 1));

          // 检查装备工具
          const items = bot.inventory.items();
          const pickaxe = items.find((item: any) => item.name.includes('pickaxe'));
          if (pickaxe) await bot.equip(pickaxe, 'hand');

          await bot.dig(block);
          mined++;
          logger.bot(`挖矿道: ${block.name} (${mined}/${length})`);
        } catch { /* skip */ }
      } else {
        try {
          await bot.pathfinder.goto(new goals.GoalNear(targetX, startY, targetZ, 1));
        } catch { /* skip */ }
      }
    }

    return { success: true, message: `挖了 ${mined} 个方块 (矿道长度 ${length})` };
  },
};

registerSkill(mineStripSkill);
