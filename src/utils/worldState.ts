import type { Bot } from 'mineflayer';
import { logger } from './logger.js';
import { memory } from './memory.js';

export interface WorldState {
  position: { x: number; y: number; z: number };
  health: number;
  food: number;
  nearbyBlocks: string[];
  nearbyEntities: string[];
  inventory: string[];
  recentChat: string[];
  timeOfDay: string;
  biome: string;
  lastActionResult?: string;
  memorySummary?: string;
}

/**
 * 收集当前世界状态摘要
 */
export function collectWorldState(bot: Bot, recentChat: string[]): WorldState {
  const pos = bot.entity.position;

  // 附近方块（3格半径）
  const nearbyBlocks: string[] = [];
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dz = -3; dz <= 3; dz++) {
        const block = bot.blockAt(pos.offset(dx, dy, dz));
        if (block && block.name !== 'air') {
          nearbyBlocks.push(block.name);
        }
      }
    }
  }
  // 去重，取前 20 个
  const uniqueBlocks = [...new Set(nearbyBlocks)].slice(0, 20);

  // 附近实体（10格半径）
  const nearbyEntities: string[] = [];
  for (const entity of Object.values(bot.entities)) {
    if (!entity || entity === bot.entity) continue;
    const dist = entity.position.distanceTo(pos);
    if (dist < 10) {
      const type = entity.type === 'mob' ? `mob:${entity.name ?? 'unknown'}` :
                   entity.type === 'player' ? `player:${entity.username}` :
                   entity.type;
      nearbyEntities.push(type);
    }
  }

  // 物品栏
  const inventory = bot.inventory.items().map(item => `${item.name}x${item.count}`);

  // 时间
  const timeOfDay = getTimeOfDay(bot.time.timeOfDay);

  // 生物群系
  const biome = bot.blockAt(pos)?.biome.name ?? 'unknown';

  return {
    position: { x: pos.x, y: pos.y, z: pos.z },
    health: bot.health,
    food: bot.food,
    nearbyBlocks: uniqueBlocks,
    nearbyEntities,
    inventory,
    recentChat: recentChat.slice(-5), // 最近 5 条聊天
    timeOfDay,
    biome,
    memorySummary: memory.getSummary(),
  };
}
export function updateWorldMemory(pos: { x: number; y: number; z: number }): void {
  memory.checkNewPosition(pos);
}

function getTimeOfDay(time: number): string {
  const hour = Math.floor((time / 1000 + 6) % 24);
  if (hour >= 6 && hour < 12) return '早晨';
  if (hour >= 12 && hour < 18) return '下午';
  if (hour >= 18 && hour < 21) return '傍晚';
  return '夜晚';
}
