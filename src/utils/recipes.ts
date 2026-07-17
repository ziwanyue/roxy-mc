/**
 * 合成管理系统
 * 知道需要什么材料、自动收集、分阶段推荐
 */
import type { Bot } from 'mineflayer';

// 物品分类
export interface ItemInfo {
  name: string;
  displayName: string;
  category: 'tool' | 'weapon' | 'armor' | 'food' | 'material' | 'block' | 'other';
  tier: number; // 0=木, 1=石, 2=铁, 3=金, 4=钻石, 5=下界合金
}

// 材料依赖表：item → 需要的基础材料
const materialDeps: Record<string, Record<string, number>> = {
  // 工具类
  wooden_pickaxe: { oak_planks: 3, stick: 2 },
  stone_pickaxe: { cobblestone: 3, stick: 2 },
  iron_pickaxe: { iron_ingot: 3, stick: 2 },
  diamond_pickaxe: { diamond: 3, stick: 2 },
  wooden_axe: { oak_planks: 3, stick: 2 },
  stone_axe: { cobblestone: 3, stick: 2 },
  iron_axe: { iron_ingot: 3, stick: 2 },
  diamond_axe: { diamond: 3, stick: 2 },
  wooden_sword: { oak_planks: 2, stick: 1 },
  stone_sword: { cobblestone: 2, stick: 1 },
  iron_sword: { iron_ingot: 2, stick: 1 },
  diamond_sword: { diamond: 2, stick: 1 },
  wooden_shovel: { oak_planks: 1, stick: 2 },
  stone_shovel: { cobblestone: 1, stick: 2 },
  iron_shovel: { iron_ingot: 1, stick: 2 },
  diamond_shovel: { diamond: 1, stick: 2 },
  shield: { oak_planks: 6, iron_ingot: 1 },

  // 装备
  iron_helmet: { iron_ingot: 5 },
  iron_chestplate: { iron_ingot: 8 },
  iron_leggings: { iron_ingot: 7 },
  iron_boots: { iron_ingot: 4 },
  diamond_helmet: { diamond: 5 },
  diamond_chestplate: { diamond: 8 },
  diamond_leggings: { diamond: 7 },
  diamond_boots: { diamond: 4 },

  // 工具
  furnace: { cobblestone: 8 },
  crafting_table: { oak_planks: 4 },
  chest: { oak_planks: 8 },
  torch: { coal: 1, stick: 1 },

  // 食物
  bread: { wheat: 3 },
  cookie: { wheat: 2, cocoa_beans: 1 },
  cake: { wheat: 3, sugar: 2, milk_bucket: 3, egg: 1 },
};

// 进阶阶段定义
export const STAGES = [
  { name: '石器时代', minTier: 0, recommend: ['stone_pickaxe', 'stone_axe', 'stone_sword', 'furnace'] },
  { name: '铁器时代', minTier: 2, recommend: ['iron_pickaxe', 'iron_sword', 'shield', 'iron_chestplate'] },
  { name: '钻石时代', minTier: 4, recommend: ['diamond_pickaxe', 'diamond_sword', 'diamond_chestplate'] },
  { name: '完全体', minTier: 5, recommend: ['diamond_pickaxe', 'diamond_sword', 'diamond_chestplate', 'shield'] },
];

export const FOOD_ITEMS = [
  'cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_mutton',
  'cooked_salmon', 'cooked_cod', 'bread', 'baked_potato',
  'golden_apple', 'beef', 'porkchop', 'chicken', 'apple',
  'melon_slice', 'carrot', 'sweet_berries', 'cookie',
];

export const RAW_FOOD = ['beef', 'porkchop', 'chicken', 'mutton', 'cod', 'salmon', 'potato'];
export const COOKED_FOOD: Record<string, string> = {
  beef: 'cooked_beef',
  porkchop: 'cooked_porkchop',
  chicken: 'cooked_chicken',
  mutton: 'cooked_mutton',
  cod: 'cooked_cod',
  salmon: 'cooked_salmon',
  potato: 'baked_potato',
};

/**
 * 判断当前科技阶段
 */
export function getStage(bot: Bot): number {
  const items = bot.inventory.items().map(i => i.name);
  let maxStage = 0;
  if (items.some(n => n.includes('diamond_'))) maxStage = 3;
  else if (items.some(n => n.includes('iron_'))) maxStage = 2;
  else if (items.some(n => n.includes('stone_'))) maxStage = 1;
  return maxStage;
}

/**
 * 推荐当前阶段应该合成的物品
 */
export function recommendCrafts(bot: Bot): string[] {
  const stage = getStage(bot);
  const items = bot.inventory.items().map(i => i.name);
  const recs: string[] = [];

  for (const info of STAGES) {
    if (getStage(bot) < info.minTier) continue;
    for (const item of info.recommend) {
      if (!items.some(i => i.includes(item.split('_')[0]))) {
        // 还没有同类工具，推荐
        recs.push(item);
      }
    }
  }
  return recs.slice(0, 5);
}

/**
 * 检查能否合成某物品
 */
export function canCraft(bot: Bot, itemName: string): { can: boolean; missing: string[] } {
  const deps = materialDeps[itemName];
  if (!deps) return { can: true, missing: [] }; // 未知配方，让 mineflayer 处理

  const items = bot.inventory.items();
  const missing: string[] = [];
  for (const [mat, count] of Object.entries(deps)) {
    const have = items.filter(i => i.name === mat).reduce((s, i) => s + i.count, 0);
    if (have < count) missing.push(`${mat}x${count - have}`);
  }
  return { can: missing.length === 0, missing };
}

/**
 * 获取食物列表（按优先级排序）
 */
export function getFoodItems(bot: Bot): { name: string; count: number }[] {
  return bot.inventory.items()
    .filter((i: any) => FOOD_ITEMS.includes(i.name))
    .map((i: any) => ({ name: i.name, count: i.count }))
    .sort((a, b) => {
      const aIdx = FOOD_ITEMS.indexOf(a.name);
      const bIdx = FOOD_ITEMS.indexOf(b.name);
      return (aIdx >= 0 ? aIdx : 99) - (bIdx >= 0 ? bIdx : 99);
    });
}

/**
 * 获取玩家附近的可烹饪食材
 */
export function getCookableItems(bot: Bot): string[] {
  return bot.inventory.items()
    .filter((i: any) => RAW_FOOD.includes(i.name))
    .map((i: any) => i.name);
}
