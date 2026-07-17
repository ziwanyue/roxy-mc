import { registerSkill, type Skill, type SkillContext, type SkillResult } from './index.js';
import { logger } from '../utils/logger.js';

const chatSkill: Skill = {
  name: 'chat',
  description: '在游戏里说话',
  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { bot, args } = ctx;
    const message = String(args.message ?? '');

    if (!message) {
      return { success: false, message: '没有要说的话' };
    }

    bot.chat(message);
    logger.bot(`[说] ${message}`);
    return { success: true, message: `说了: ${message}` };
  },
};

registerSkill(chatSkill);
