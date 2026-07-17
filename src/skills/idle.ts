import { registerSkill, type Skill, type SkillContext, type SkillResult } from './index.js';

const idleSkill: Skill = {
  name: 'idle',
  description: '原地待命，观察周围',
  async execute(_ctx: SkillContext): Promise<SkillResult> {
    // idle 不做任何事，只是占位
    return { success: true, message: '观察周围...' };
  },
};

registerSkill(idleSkill);

const waitSkill: Skill = {
  name: 'wait',
  description: '等待指定秒数',
  async execute(ctx: SkillContext): Promise<SkillResult> {
    const seconds = Number(ctx.args.seconds ?? 2);
    await new Promise(resolve => setTimeout(resolve, Math.min(seconds, 10) * 1000));
    return { success: true, message: `等待了 ${seconds} 秒` };
  },
};

registerSkill(waitSkill);
