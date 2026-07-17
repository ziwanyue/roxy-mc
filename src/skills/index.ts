import type { Bot } from 'mineflayer';
import { logger } from '../utils/logger.js';

export interface SkillResult {
  success: boolean;
  message?: string;
}

export interface SkillContext {
  bot: Bot;
  targetPlayer?: string;
  args: Record<string, unknown>;
}

export interface Skill {
  name: string;
  description: string;
  execute(ctx: SkillContext): Promise<SkillResult>;
}

// 技能注册表
const skills = new Map<string, Skill>();

export function registerSkill(skill: Skill): void {
  skills.set(skill.name, skill);
  logger.info(`注册技能: ${skill.name}`);
}

export function getSkill(name: string): Skill | undefined {
  return skills.get(name);
}

export function listSkills(): Skill[] {
  return [...skills.values()];
}

export async function executeSkill(name: string, ctx: SkillContext): Promise<SkillResult> {
  const skill = getSkill(name);
  if (!skill) {
    logger.warn(`未知技能: ${name}`);
    return { success: false, message: `未知技能: ${name}` };
  }
  logger.bot(`执行技能: ${name}`);
  try {
    return await skill.execute(ctx);
  } catch (err) {
    logger.error(`技能 ${name} 执行失败: ${(err as Error).message}`);
    return { success: false, message: (err as Error).message };
  }
}
