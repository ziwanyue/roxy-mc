import { registerSkill, type Skill, type SkillContext, type SkillResult } from './index.js';
import { logger } from '../utils/logger.js';

const eatSkill: Skill = {
  name: 'eat',
  description: '从物品栏找食物进食',
  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { bot } = ctx;

    // 常见食物列表（按优先级）
    const foodNames = [
      'golden_apple', 'cooked_beef', 'cooked_porkchop', 'cooked_chicken',
      'cooked_mutton', 'cooked_salmon', 'cooked_cod', 'bread',
      'cooked_rabbit', 'baked_potato', 'beef', 'porkchop',
      'chicken', 'mutton', 'apple', 'melon_slice', 'carrot',
      'sweet_berries', 'cookie', 'potato',
    ];

    // 找物品栏里的食物
    let foodItem = null;
    for (const foodName of foodNames) {
      const item = bot.inventory.items().find(i => i.name === foodName);
      if (item) {
        foodItem = item;
        break;
      }
    }

    if (!foodItem) {
      return { success: false, message: '物品栏里没有食物' };
    }

    // 切换到食物所在的手
    await bot.equip(foodItem, 'hand');
    await bot.consume();

    logger.bot(`吃掉了 ${foodItem.name}`);
    return { success: true, message: `吃了 ${foodItem.name}` };
  },
};

registerSkill(eatSkill);
