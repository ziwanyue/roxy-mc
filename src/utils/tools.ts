import type { Bot } from 'mineflayer';

/**
 * 工具管理 — 让洛琪希像真玩家一样用对工具
 */

// 方块类型 → 最佳工具映射
const toolMap: Record<string, string[]> = {
  // 镐类
  pickaxe: ['stone', 'cobblestone', 'coal_ore', 'iron_ore', 'diamond_ore', 'gold_ore',
            'copper_ore', 'redstone_ore', 'lapis_ore', 'emerald_ore', 'deepslate',
            'netherrack', 'basalt', 'blackstone', 'granite', 'diorite', 'andesite',
            'obsidian', 'ancient_debris'],
  // 斧类
  axe: ['oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log',
        'oak_planks', 'spruce_planks', 'birch_planks', 'oak_door', 'spruce_door',
        'oak_fence', 'spruce_fence', 'crafting_table', 'chest', 'bookshelf'],
  // 锹类
  shovel: ['dirt', 'grass_block', 'sand', 'gravel', 'clay', 'soul_sand', 'mycelium',
           'podzol', 'coarse_dirt', 'farmland', 'snow_block'],
  // 剑类（用于更快地破坏树叶/蜘蛛网）
  sword: ['leaves', 'cobweb', 'melon', 'pumpkin'],
};

// 工具品质优先级（从低到高）
const toolTiers = ['wooden', 'stone', 'iron', 'golden', 'diamond', 'netherite'];

// 物品栏中找最佳工具
function findBestTool(bot: Bot, blockName: string): { slot: number; item: any } | null {
  const items = bot.inventory.items();
  let bestItem = null;
  let bestScore = -1;

  for (const item of items) {
    const name = item.name;
    // 判断工具类型
    let toolType = '';
    if (name.includes('pickaxe')) toolType = 'pickaxe';
    else if (name.includes('axe')) toolType = 'axe';
    else if (name.includes('shovel')) toolType = 'shovel';
    else if (name.includes('sword')) toolType = 'sword';
    else if (name.includes('hoe')) toolType = 'hoe';
    if (!toolType) continue;

    // 判断是否适合这个方块
    const suitableBlocks = toolMap[toolType] || [];
    const isSuitable = suitableBlocks.some(b => blockName.includes(b));

    // 计算分数：适用性 + 品质等级
    const tierIndex = toolTiers.findIndex(t => name.includes(t));
    let score = isSuitable ? 10 : 0;
    score += tierIndex >= 0 ? tierIndex : -1;

    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return bestItem ? { slot: 0, item: bestItem } : null;
}

/**
 * 为挖掘自动装备最佳工具
 */
export async function equipBestTool(bot: Bot, blockName: string): Promise<void> {
  // 先看手上有没有合适的
  const hand = bot.heldItem;
  if (hand && isGoodToolFor(hand.name, blockName)) return;

  const best = findBestTool(bot, blockName);
  if (best) {
    try {
      await bot.equip(best.item, 'hand');
    } catch { /* 装备失败就算了 */ }
  }
}

/**
 * 为战斗装备最好的剑
 */
export async function equipBestWeapon(bot: Bot): Promise<void> {
  const items = bot.inventory.items();
  let bestSword = null;
  let bestTier = -1;

  for (const item of items) {
    const name = item.name;
    if (!name.includes('sword')) continue;
    const tierIndex = toolTiers.findIndex(t => name.includes(t));
    if (tierIndex > bestTier) {
      bestTier = tierIndex;
      bestSword = item;
    }
  }

  if (bestSword) {
    try {
      await bot.equip(bestSword, 'hand');
    } catch { /* 忽略 */ }
  }
}

/**
 * 自动装备最好的盔甲
 */
export async function equipBestArmor(bot: Bot): Promise<void> {
  const armorSlots = ['head', 'torso', 'legs', 'feet'] as const;
  const armorTypes = ['helmet', 'chestplate', 'leggings', 'boots'] as const;
  const tiers = ['leather', 'golden', 'chainmail', 'iron', 'diamond', 'netherite'];

  for (let i = 0; i < armorSlots.length; i++) {
    const slot = armorSlots[i];
    const type = armorTypes[i];

    // 找最好的该部位盔甲
    let bestItem: any = null;
    let bestTier = -1;

    for (const item of bot.inventory.items()) {
      if (!item.name.includes(type)) continue;
      const tierIdx = tiers.findIndex(t => item.name.includes(t));
      if (tierIdx > bestTier) {
        bestTier = tierIdx;
        bestItem = item;
      }
    }

    if (bestItem) {
      try {
        await bot.equip(bestItem, slot);
      } catch { /* 忽略 */ }
    }
  }
}

function isGoodToolFor(toolName: string, blockName: string): boolean {
  let toolType = '';
  if (toolName.includes('pickaxe')) toolType = 'pickaxe';
  else if (toolName.includes('axe')) toolType = 'axe';
  else if (toolName.includes('shovel')) toolType = 'shovel';
  else if (toolName.includes('sword')) toolType = 'sword';
  if (!toolType) return false;

  const suitable = toolMap[toolType] || [];
  return suitable.some(b => blockName.includes(b));
}

/**
 * 玩家化的随机小动作：跳跃、转头等
 */
export async function doPlayerLikeStuff(bot: Bot): Promise<void> {
  const rand = Math.random();
  if (rand < 0.3) {
    // 随机转头（看向附近）
    const yaw = Math.random() * Math.PI * 2;
    bot.look(yaw, 0, true);
  } else if (rand < 0.4) {
    // 跳跃
    bot.setControlState('jump', true);
    await new Promise(r => setTimeout(r, 200));
    bot.setControlState('jump', false);
  } else if (rand < 0.45 && bot.food < 20) {
    // 吃两口
    const food = bot.inventory.items().find(i =>
      ['apple', 'bread', 'cooked_beef', 'cooked_porkchop', 'cooked_chicken',
       'cooked_mutton', 'baked_potato', 'golden_apple', 'carrot'].includes(i.name)
    );
    if (food) {
      try {
        await bot.equip(food, 'hand');
        await bot.consume();
      } catch { /* 忽略 */ }
    }
  }
}

// 玩家化感叹词
export const playerExclamations: Record<string, string[]> = {
  happy: ['嘿嘿，这个不错！', '赚到了！', 'nice！', '运气真好～', '哈哈，找到了！'],
  sad: ['啊……怎么没有呢', '唉，运气不好', '算了算了', '唔……白跑一趟'],
  surprise: ['哇！', '诶？！', '不是吧！', '还有这种操作？', '哦哦哦！'],
  hurt: ['好痛！', '哎哟！', '喂！', '痛死了……', '轻点啊！'],
  night: ['天黑了……该睡觉了', '晚上了，找个地方躲起来吧', '夜晚不安全，先撤吧'],
  bored: ['好无聊啊……', '有没有什么有趣的事啊', '嗯……接下来干啥呢'],
};

export function getRandomExclamation(category: string): string {
  const list = playerExclamations[category];
  if (!list) return '';
  return list[Math.floor(Math.random() * list.length)];
}
