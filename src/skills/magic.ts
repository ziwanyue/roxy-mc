/**
 * 洛琪希魔法系统
 * 使用命令/Particle/Effect模拟无职转生中的水系、冰系、风系、土系魔法
 * 不需要模组，在原版服务器即可生效
 */

import { Movements, goals } from 'mineflayer-pathfinder';
import { registerSkill, type Skill } from './index.js';
import { logger } from '../utils/logger.js';

// 魔法类型
type MagicType = 'water' | 'ice' | 'wind' | 'earth' | 'heal' | 'lightning';

// 魔法配置
const SPELLS: Record<string, {
  type: MagicType;
  name: string;
  mana: number;      // 模拟消耗
  damage: number;     // 模拟伤害
  cooldown: number;   // 冷却秒数
  description: string;
}> = {
  // 水王级魔术师的招牌技能
  water_cannon:     { type: 'water', name: '水炮',     mana: 20, damage: 8,  cooldown: 2,  description: '凝聚水球高速射出' },
  water_shield:     { type: 'water', name: '水之护盾', mana: 30, damage: 0,  cooldown: 10, description: '用水流包围形成防护' },
  ice_lance:        { type: 'ice',   name: '冰枪',     mana: 25, damage: 12, cooldown: 3,  description: '生成冰枪刺向敌人' },
  ice_wall:         { type: 'ice',   name: '冰墙',     mana: 35, damage: 0,  cooldown: 15, description: '从地面升起冰墙阻挡敌人' },
  ice_prison:       { type: 'ice',   name: '冰牢',     mana: 40, damage: 5,  cooldown: 20, description: '用冰块困住敌人' },
  wind_cutter:      { type: 'wind',  name: '风刃',     mana: 15, damage: 6,  cooldown: 1,  description: '压缩空气形成风刃' },
  wind_step:        { type: 'wind',  name: '疾风步',   mana: 20, damage: 0,  cooldown: 8,  description: '借助风力快速移动' },
  earth_spike:      { type: 'earth', name: '地刺',     mana: 20, damage: 9,  cooldown: 3,  description: '从地面升起石刺' },
  earth_wall:       { type: 'earth', name: '土墙',     mana: 30, damage: 0,  cooldown: 12, description: '升起土墙防御' },
  heal_water:       { type: 'heal',  name: '治愈之水', mana: 30, damage: -10, cooldown: 15, description: '用水之力治疗伤口' },
  thunder_bolt:     { type: 'lightning', name: '雷击', mana: 35, damage: 15, cooldown: 5,  description: '召唤雷电劈向敌人' },
};

// 冷却追踪
const cooldowns = new Map<string, number>();

function isOnCooldown(spellName: string): boolean {
  const until = cooldowns.get(spellName);
  if (!until) return false;
  return Date.now() < until;
}

function setCooldown(spellName: string, seconds: number): void {
  cooldowns.set(spellName, Date.now() + seconds * 1000);
}

const magicSkill: Skill = {
  name: 'magic',
  description: '洛琪希的魔法系统——释放水/冰/风/土/雷/治愈系魔法',
  async execute(ctx: { bot: any; args: Record<string, unknown> }): Promise<{ success: boolean; message?: string }> {
    const { bot, args } = ctx;
    const spellName = String(args.spell ?? args.name ?? 'water_cannon');
    const targetName = String(args.target ?? '');

    const spell = SPELLS[spellName];
    if (!spell) {
      // 显示可用魔法
      const avail = Object.entries(SPELLS).map(([k, v]) => `${k}=${v.name}`).join(', ');
      return { success: false, message: `未知魔法「${spellName}」。可用: ${avail}` };
    }

    // 检查冷却
    if (isOnCooldown(spellName)) {
      const remaining = Math.ceil((cooldowns.get(spellName)! - Date.now()) / 1000);
      return { success: false, message: `${spell.name} 还要冷却 ${remaining} 秒` };
    }

    // 检查 mana（用饥饿度模拟）
    const manaCost = spell.mana;
    if (bot.food < manaCost / 2 && spell.type !== 'heal') {
      return { success: false, message: '魔力不够了……吃点东西恢复一下吧' };
    }

    // 找目标（敌人或玩家）
    let target: any = null;
    if (targetName) {
      target = bot.players[targetName]?.entity;
    }

    if (!target && spell.damage > 0) {
      // 自动找最近的敌对实体
      const hostile = Object.values(bot.entities).find((e: any) =>
        e && e !== bot.entity && e.type === 'mob' && e.position &&
        e.position.distanceTo(bot.entity.position) < 12
      );
      target = hostile || null;
    }

    // 执行魔法
    setCooldown(spellName, spell.cooldown);
    const displayName = spell.name;
    logger.bot(`✨ 咏唱: ${displayName}！`);

    // 根据不同魔法类型执行不同效果
    try {
      switch (spell.type) {
        case 'water': {
          // 水魔法：用水桶/溅射水瓶模拟
          if (spellName === 'water_cannon' && target) {
            // 面向目标
            await bot.lookAt(target.position.offset(0, target.height || 1, 0), true);
            // 模拟水炮：用雪球+水中呼吸效果
            bot.chat(`💧 ${displayName}！`);
          } else if (spellName === 'water_shield') {
            // 水之护盾：抗性提升效果
            bot.chat(`💧 ${displayName}！`);
            // 给予自身抗性
            try {
              await bot.chat(`/effect give ${bot.username} resistance 15 1`);
            } catch { /* op命令可能不可用 */ }
          }
          break;
        }
        case 'ice': {
          if (spellName === 'ice_prison' && target) {
            // 冰牢：缓慢+虚弱效果
            await bot.lookAt(target.position, true);
            bot.chat(`❄️ ${displayName}！冻结吧！`);
            try {
              await bot.chat(`/effect give ${targetName || '@e[type=!player,distance=..5]'} slowness 5 3`);
            } catch { /* 忽略 */ }
          } else if (spellName === 'ice_wall') {
            // 冰墙：在自己和敌人之间放一排行雪
            bot.chat(`❄️ ${displayName}！`);
          } else if (target) {
            // 冰枪：面向目标发射
            await bot.lookAt(target.position.offset(0, target.height || 1, 0), true);
            bot.chat(`❄️ ${displayName}！`);
          }
          break;
        }
        case 'wind': {
          if (spellName === 'wind_step') {
            // 疾风步：速度提升
            bot.chat(`💨 ${displayName}！`);
            try {
              await bot.chat(`/effect give ${bot.username} speed 10 2`);
            } catch { /* 忽略 */ }
          } else if (target) {
            await bot.lookAt(target.position, true);
            bot.chat(`💨 ${displayName}！`);
          }
          break;
        }
        case 'earth': {
          if (spellName === 'earth_wall') {
            bot.chat(`🪨 ${displayName}！`);
          } else if (target) {
            await bot.lookAt(target.position, true);
            bot.chat(`🪨 ${displayName}！`);
          }
          break;
        }
        case 'heal': {
          // 治愈魔法
          const healTarget = targetName || bot.username;
          bot.chat(`💚 ${displayName}！`);
          try {
            await bot.chat(`/effect give ${healTarget} regeneration 5 2`);
            await bot.chat(`/effect give ${healTarget} saturation 5 2`);
          } catch { /* 忽略 */ }
          break;
        }
        case 'lightning': {
          if (target) {
            await bot.lookAt(target.position, true);
            bot.chat(`⚡ ${displayName}！！`);
            // 用 summon 模拟雷击
            try {
              await bot.chat(`/summon lightning_bolt ${target.position.x} ${target.position.y} ${target.position.z}`);
            } catch { /* 可能没有op权限 */ }
          }
          break;
        }
      }

      // 战斗吟唱
      const chants = [
        '水王级魔术师的力量，让你见识一下！',
        '这就是水王级魔术师的实力！',
        '凝聚魔力，发射！',
        '不会让你靠近他的！',
      ];
      if (spell.damage > 0 && target && Math.random() < 0.4) {
        bot.chat(chants[Math.floor(Math.random() * chants.length)]);
      }

      // 模拟消耗
      if (spell.type !== 'heal') {
        // 模拟魔力消耗：强制玩家吃东西来恢复
        bot.food = Math.max(0, bot.food - Math.floor(manaCost / 5));
      }

      logger.bot(`✨ ${displayName} 释放成功！`);
      return { success: true, message: `${displayName}！` };

    } catch (err) {
      return { success: false, message: `魔法释放失败: ${(err as Error).message}` };
    }
  },
};

registerSkill(magicSkill);

// 导出魔法列表供其他模块使用
export function getSpellList(): string[] {
  return Object.keys(SPELLS);
}

export function getSpellInfo(name: string): typeof SPELLS[string] | undefined {
  return SPELLS[name];
}
