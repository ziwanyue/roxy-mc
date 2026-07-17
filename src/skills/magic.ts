/**
 * 洛琪希完整魔法系统
 * 基于无职转生原作设定，水王级魔术师洛琪希·米格路迪亚的全部魔法
 *
 * 等级划分：
 *   初级 (Cantrip)  — 初等魔术师级别
 *   中级              — 中级魔术师级别
 *   上级              — 上级魔术师级别
 *   水王級 (King)    — 水王级魔术师专属。Roxy 是水王级！
 *
 * 实现方式：Minecraft 原版命令/效果模拟，无需模组
 */

import { Movements, goals } from 'mineflayer-pathfinder';
import { registerSkill, type Skill } from './index.js';
import { logger } from '../utils/logger.js';

// ══════════════════════════════════════════════
//  魔法等级及类型定义
// ══════════════════════════════════════════════

type MagicRank = 'cantrip' | 'intermediate' | 'advanced' | 'king';
type MagicSchool = 'water' | 'ice' | 'wind' | 'earth' | 'fire' | 'lightning' | 'heal' | 'barrier' | 'detection';

interface SpellEffect {
  /** 效果类型 */
  type: 'damage' | 'heal' | 'effect' | 'summon' | 'utility';
  /** 伤害/治疗量（半心） */
  amount?: number;
  /** 状态效果 */
  effect?: string;
  /** 持续时间（秒） */
  duration?: number;
  /** 效果等级 */
  amplifier?: number;
  /** 范围 */
  range?: number;
  /** 群体攻击 */
  aoe?: boolean;
  /** 描述 */
  desc?: string;
}

interface SpellDef {
  id: string;
  name: string;          // 中文名
  rank: MagicRank;       // 等级
  school: MagicSchool;   // 学派
  mana: number;          // 魔力消耗
  cooldown: number;      // 冷却秒数
  description: string;   // 原作描述
  incantation: string;   // 咏唱词
  effects?: SpellEffect[]; // MC游戏内效果
}

// ══════════════════════════════════════════════
//  洛琪希·米格路迪亚 全魔法列表
//  共 42 种魔法，按原作设定分类
// ══════════════════════════════════════════════

const SPELLS: SpellDef[] = [
  // ──── 初级魔术 (Cantrip) — 日常生活用 ────
  {
    id: 'light', rank: 'cantrip', school: 'detection', mana: 2, cooldown: 1,
    name: '照明', description: '指尖发出光芒，照亮周围', incantation: '光啊——',
  },
  {
    id: 'ignite', rank: 'cantrip', school: 'fire', mana: 2, cooldown: 1,
    name: '点火', description: '在指尖产生小火苗用于点火', incantation: '火啊——',
  },
  {
    id: 'dry', rank: 'cantrip', school: 'wind', mana: 2, cooldown: 1,
    name: '干燥', description: '吹干水分，晾干衣服', incantation: '风啊，带走水分吧——',
  },
  {
    id: 'purify', rank: 'cantrip', school: 'water', mana: 3, cooldown: 2,
    name: '净化', description: '净化饮用水和食物', incantation: '水之精灵啊，洗净污秽——',
  },
  {
    id: 'mana_detect', rank: 'cantrip', school: 'detection', mana: 5, cooldown: 5,
    name: '魔力感知', description: '感知周围的魔力波动', incantation: '魔力之流啊，现出形迹——',
  },
  {
    id: 'message', rank: 'cantrip', school: 'wind', mana: 3, cooldown: 1,
    name: '远话', description: '将声音传到远处的人耳边', incantation: '风啊，传递我的话语——',
  },

  // ──── 中级魔术 (Intermediate) — 实战级 ────
  {
    id: 'water_ball', rank: 'intermediate', school: 'water', mana: 10, cooldown: 1,
    name: '水球', description: '在手中凝聚水球并射出，洛琪希最常用的魔法', incantation: '水球！',
  },
  {
    id: 'water_blade', rank: 'intermediate', school: 'water', mana: 15, cooldown: 2,
    name: '水刃', description: '高压水流形成锋利的水刃切割敌人', incantation: '水刃！',
  },
  {
    id: 'water_curtain', rank: 'intermediate', school: 'water', mana: 18, cooldown: 8,
    name: '水幕', description: '在面前展开水之帷幕，抵挡攻击', incantation: '水之幕布啊，守护于我——',
  },
  {
    id: 'water_prison', rank: 'intermediate', school: 'water', mana: 20, cooldown: 12,
    name: '水牢', description: '用水球包裹敌人使其窒息', incantation: '水之牢笼，囚禁于斯！',
  },
  {
    id: 'fog', rank: 'intermediate', school: 'water', mana: 12, cooldown: 10,
    name: '雾', description: '召唤浓雾遮蔽视野', incantation: '雾气啊，笼罩一切——',
  },
  {
    id: 'rain', rank: 'intermediate', school: 'water', mana: 15, cooldown: 15,
    name: '雨乞', description: '召唤降雨浇灭火焰', incantation: '天空啊，降下甘露——',
  },
  {
    id: 'ice_lance', rank: 'intermediate', school: 'ice', mana: 18, cooldown: 3,
    name: '冰枪', description: '生成冰之长枪刺穿敌人', incantation: '冰枪！贯穿吧！',
  },
  {
    id: 'ice_shards', rank: 'intermediate', school: 'ice', mana: 14, cooldown: 2,
    name: '冰砾', description: '射出大量冰碎片散弹攻击', incantation: '冰之碎片啊，化为箭雨——',
  },
  {
    id: 'freeze', rank: 'intermediate', school: 'ice', mana: 20, cooldown: 8,
    name: '冻结', description: '冻结目标使其无法行动', incantation: '冻结吧！',
  },
  {
    id: 'ice_armor', rank: 'intermediate', school: 'ice', mana: 16, cooldown: 15,
    name: '冰铠', description: '用冰覆盖身体形成冰之铠甲', incantation: '冰之铠甲，覆盖我身——',
  },
  {
    id: 'wind_cutter', rank: 'intermediate', school: 'wind', mana: 10, cooldown: 1,
    name: '风刃', description: '压缩空气形成锋利的真空之刃', incantation: '风刃！',
  },
  {
    id: 'wind_shield', rank: 'intermediate', school: 'wind', mana: 14, cooldown: 6,
    name: '风壁', description: '在面前形成风之壁障弹开攻击', incantation: '风之壁障！',
  },
  {
    id: 'gust', rank: 'intermediate', school: 'wind', mana: 12, cooldown: 3,
    name: '突风', description: '产生强力风压吹飞敌人', incantation: '暴风啊！',
  },
  {
    id: 'rock_bullet', rank: 'intermediate', school: 'earth', mana: 12, cooldown: 2,
    name: '岩弹', description: '从地面抓起岩石射向敌人', incantation: '岩弹！',
  },
  {
    id: 'earth_wall', rank: 'intermediate', school: 'earth', mana: 18, cooldown: 10,
    name: '土壁', description: '从地面升起土墙防御', incantation: '大地啊，升起壁垒——',
  },
  {
    id: 'mud_swamp', rank: 'intermediate', school: 'earth', mana: 15, cooldown: 12,
    name: '土沼', description: '将地面变成泥沼困住敌人', incantation: '大地化为泥沼——',
  },
  {
    id: 'fireball', rank: 'intermediate', school: 'fire', mana: 14, cooldown: 2,
    name: '火球', description: '凝聚火球射向敌人', incantation: '火球！',
  },
  {
    id: 'heal', rank: 'intermediate', school: 'heal', mana: 15, cooldown: 10,
    name: '治愈', description: '基本的伤口治愈魔法', incantation: '水之精灵啊，治愈伤口——',
  },
  {
    id: 'antidote', rank: 'intermediate', school: 'heal', mana: 10, cooldown: 5,
    name: '解毒', description: '中和体内毒素', incantation: '净化毒素——',
  },

  // ──── 上级魔术 (Advanced) — 魔力大量消耗 ────
  {
    id: 'water_dragon', rank: 'advanced', school: 'water', mana: 35, cooldown: 20,
    name: '水龙', description: '召唤水之龙冲击敌人，洛琪希的代表性魔法', incantation: '水龙啊，吞噬一切——！',
  },
  {
    id: 'blizzard', rank: 'advanced', school: 'ice', mana: 30, cooldown: 18,
    name: '吹雪', description: '召唤暴风雪冻结大范围区域', incantation: '暴风雪啊，冰封万物——！',
  },
  {
    id: 'ice_wall', rank: 'advanced', school: 'ice', mana: 25, cooldown: 12,
    name: '冰墙', description: '升起巨大的冰之墙壁', incantation: '冰之城墙，巍然屹立——！',
  },
  {
    id: 'ice_prison', rank: 'advanced', school: 'ice', mana: 30, cooldown: 20,
    name: '冰牢', description: '用多层冰壁将敌人封在冰棺中', incantation: '永冻的冰棺，囚禁于此——！',
  },
  {
    id: 'wind_step', rank: 'advanced', school: 'wind', mana: 20, cooldown: 8,
    name: '疾风步', description: '用风包裹身体，大幅提升移动速度', incantation: '风啊，助我一臂之力——',
  },
  {
    id: 'flight', rank: 'advanced', school: 'wind', mana: 25, cooldown: 30,
    name: '飞行', description: '用风托起身体在空中飞行', incantation: '风啊，托起我的身体——',
  },
  {
    id: 'earth_split', rank: 'advanced', school: 'earth', mana: 28, cooldown: 15,
    name: '地裂', description: '将大地劈开一条裂缝', incantation: '大地啊，裂开来——！',
  },
  {
    id: 'flame_wall', rank: 'advanced', school: 'fire', mana: 22, cooldown: 10,
    name: '炎壁', description: '从地面升起火墙阻挡敌人', incantation: '烈焰之墙！',
  },
  {
    id: 'thunder_bolt', rank: 'advanced', school: 'lightning', mana: 28, cooldown: 5,
    name: '雷击', description: '从天空召唤雷电劈向目标', incantation: '雷霆啊，降下制裁——！',
  },
  {
    id: 'regeneration', rank: 'advanced', school: 'heal', mana: 25, cooldown: 20,
    name: '再生', description: '加速身体恢复，治愈重伤', incantation: '生命之水啊，流转不息——',
  },
  {
    id: 'magic_barrier', rank: 'advanced', school: 'barrier', mana: 22, cooldown: 15,
    name: '魔术障壁', description: '展开魔力屏障，防御一切攻击', incantation: '魔力之壁，守护于我——！',
  },
  {
    id: 'invisibility', rank: 'advanced', school: 'barrier', mana: 20, cooldown: 25,
    name: '隐身', description: '扭曲光线让自己隐形', incantation: '消失吧——',
  },

  // ──── 水王級魔术 (Water King) — 洛琪希的巅峰力量 ────
  {
    id: 'wrath_water_king', rank: 'king', school: 'water', mana: 50, cooldown: 60,
    name: '水王の怒り', description: '水王级魔术。召唤巨大水龙卷吞噬一切', incantation: '水王啊，展现你的愤怒——！水王の怒り！！',
  },
  {
    id: 'glacial_age', rank: 'king', school: 'ice', mana: 55, cooldown: 90,
    name: '氷河期', description: '水王级魔术。冰封周围一切，令世界进入冰河', incantation: '冻结万物，冰河时代降临——！',
  },
  {
    id: 'great_tsunami', rank: 'king', school: 'water', mana: 60, cooldown: 120,
    name: '大海嘯', description: '水王级魔术。召唤巨大海啸吞没一切', incantation: '汹涌的波涛啊，化为无尽的海啸——！大海嘯！！',
  },
  {
    id: 'thunder_raincloud', rank: 'king', school: 'water', mana: 55, cooldown: 90,
    name: '豪雷積雨雲', description: '水王级魔术。召唤巨大的积雨云，降下豪雨与无数落雷，洛琪希的代表性大范围歼灭魔法', incantation: '天空啊，卷起乌云，降下雷霆——！豪雷積雨雲！！',
  },
];

// 用 id 做索引
const SPELL_MAP = new Map<string, SpellDef>();
for (const s of SPELLS) SPELL_MAP.set(s.id, s);

// ══════════════════════════════════════════════
//  魔法伤害/效果数据表
//  MC原版命令模拟，伤害单位=半心，状态效果按MC标准
// ══════════════════════════════════════════════
type EffectList = Array<{ type: 'damage' | 'heal' | 'effect' | 'summon' | 'utility'; desc: string }>;

const SPELL_DAMAGE: Record<string, EffectList> = {
  // ──── 初级 (Cantrip) ────
  light:          [{ type: 'utility', desc: '发出光芒，照亮周围 32 格' }],
  ignite:         [{ type: 'effect', desc: '点燃目标，持续 5 秒' }],
  dry:            [{ type: 'utility', desc: '清除自身潮湿状态' }],
  purify:         [{ type: 'utility', desc: '清除食物中毒/虚弱效果' }],
  mana_detect:    [{ type: 'utility', desc: '获得夜视 30 秒，高亮附近实体' }],
  message:        [{ type: 'utility', desc: '传话给 64 格内的玩家' }],

  // ──── 中级 (Intermediate) ────
  water_ball:     [{ type: 'damage', desc: '远程水弹，伤害 6❤️，击退 2 格' }],
  water_blade:    [{ type: 'damage', desc: '水刃切割，伤害 8❤️，无视 50%护甲' }],
  water_curtain:  [{ type: 'effect', desc: '展开水幕，获得抗性提升 15 秒' }],
  water_prison:   [{ type: 'damage', desc: '水牢困敌，持续伤害 2❤️/秒 + 缓慢 10 秒' }],
  fog:            [{ type: 'effect', desc: '召唤浓雾，降低周围怪物视野 30 秒' }],
  rain:           [{ type: 'effect', desc: '召唤降雨，范围 32 格，持续 60 秒' }],
  ice_lance:      [{ type: 'damage', desc: '冰枪贯穿，伤害 10❤️ + 缓慢 5 秒' }],
  ice_shards:     [{ type: 'damage', desc: '冰砾散射，3❤️ x 5发 = 15❤️（全中）' }],
  freeze:         [{ type: 'damage', desc: '冻结目标，伤害 4❤️ + 定身 8 秒' }],
  ice_armor:      [{ type: 'effect', desc: '冰铠覆盖，抗性提升 + 反弹伤害 15 秒' }],
  wind_cutter:    [{ type: 'damage', desc: '风刃真空切割，伤害 7❤️，冷却极短' }],
  wind_shield:    [{ type: 'effect', desc: '风壁护体，弹开弹射物 6 秒' }],
  gust:           [{ type: 'damage', desc: '突风压，伤害 3❤️ + 吹飞 5 格' }],
  rock_bullet:    [{ type: 'damage', desc: '岩弹射击，伤害 8❤️，破甲' }],
  earth_wall:     [{ type: 'effect', desc: '升起土墙阻挡敌人 + 通行' }],
  mud_swamp:      [{ type: 'effect', desc: '将地面变沼泽，缓慢 8 格范围 15 秒' }],
  fireball:       [{ type: 'damage', desc: '火球轰击，伤害 8❤️ + 燃烧 5 秒' }],
  heal:           [{ type: 'heal', desc: '治愈伤口，恢复 8❤️' }],
  antidote:       [{ type: 'utility', desc: '解毒，清除中毒/凋零效果' }],

  // ──── 上级 (Advanced) ────
  water_dragon:   [{ type: 'damage', desc: '水龙冲击，伤害 18❤️ + 击飞 5 格' }],
  blizzard:       [{ type: 'damage', desc: '暴风雪 AOE 范围 12 格，每只 8❤️ + 缓慢 15 秒' }],
  ice_wall:       [{ type: 'effect', desc: '升起冰墙 5x3，阻挡 + 冻结接触敌人' }],
  ice_prison:     [{ type: 'damage', desc: '冰棺封锁，伤害 6❤️ + 彻底定身 20 秒' }],
  wind_step:      [{ type: 'effect', desc: '疾风步，速度 V + 跳跃提升，持续 15 秒' }],
  flight:         [{ type: 'effect', desc: '飞行，创造模式飞行 30 秒' }],
  earth_split:    [{ type: 'damage', desc: '地裂 AOE 范围 8 格，每只 12❤️' }],
  flame_wall:     [{ type: 'damage', desc: '炎壁 AOE 范围 6 格，每只 6❤️ + 燃烧 10 秒' }],
  thunder_bolt:   [{ type: 'damage', desc: '雷击单体，伤害 16❤️ + 闪电特效' }],
  regeneration:   [{ type: 'heal', desc: '再生，恢复 16❤️ + 生命恢复 IV 20 秒' }],
  magic_barrier:  [{ type: 'effect', desc: '魔力障壁，抗性 V + 吸收 IV 15 秒' }],
  invisibility:   [{ type: 'effect', desc: '隐身+夜視 30 秒' }],

  // ──── 水王級 (King) ────
  wrath_water_king: [{ type: 'damage', desc: '‼️ 水王の怒り！AOE 范围 20 格，每只 30❤️ + 击飞 10 格' }],
  glacial_age:      [{ type: 'damage', desc: '‼️ 氷河期！AOE 范围 30 格，每只 25❤️ + 冰封 30 秒' }],
  great_tsunami:    [{ type: 'damage', desc: '‼️ 大海嘯！AOE 范围 40 格，每只 40❤️ + 冲走一切' }],
  thunder_raincloud:[{ type: 'damage', desc: '‼️ 豪雷積雨雲！AOE 范围 32 格，连续落雷 8❤️ x 8 发 😱' }],
};

// 冷却系统
const cooldowns = new Map<string, number>();

function isOnCooldown(spellId: string): boolean {
  const until = cooldowns.get(spellId);
  return until ? Date.now() < until : false;
}

function setCooldown(spellId: string, seconds: number): void {
  cooldowns.set(spellId, Date.now() + seconds * 1000);
}

// ══════════════════════════════════════════════
//  咏唱/喊话系统（还原动画风味）
// ══════════════════════════════════════════════

const BATTLE_CRIES = [
  '水王级魔术师的力量，让你见识一下！',
  '我可是水王级魔术师哦！',
  '哼，这种程度的敌人——看我的魔法！',
  '这就是水王级的水准！',
];

const RANK_PREFIX: Record<MagicRank, string> = {
  cantrip: '',
  intermediate: '✨',
  advanced: '🌟',
  king: '💫',
};

function rankName(rank: MagicRank): string {
  switch (rank) {
    case 'cantrip': return '初级魔术';
    case 'intermediate': return '中级魔术';
    case 'advanced': return '上级魔术';
    case 'king': return '‼️ 水王級魔术 ‼️';
  }
}

// ══════════════════════════════════════════════
//  魔法执行核心
// ══════════════════════════════════════════════

async function castSpell(bot: any, spell: SpellDef, target: any, targetName: string): Promise<string> {
  const displayName = spell.name;
  const rankTag = rankName(spell.rank);

  // 吟唱（高级以上必唱，初级随机唱）
  if (spell.rank === 'king' || spell.rank === 'advanced' || Math.random() < 0.5) {
    bot.chat(`「${spell.incantation}」`);
    await new Promise(r => setTimeout(r, 500));
  }

  // 等级宣言
  if (spell.rank === 'king') {
    bot.chat(`‼️ ${rankTag} ‼️`);
    await new Promise(r => setTimeout(r, 300));
  }

  const msg = `${RANK_PREFIX[spell.rank]} ${displayName}！`;

  // 根据学派执行对应效果
  const pos = bot.entity.position;

  switch (spell.school) {
    // ──── 水系 ────
    case 'water': {
      switch (spell.id) {
        case 'purify':
          bot.chat(`${msg} 这样就干净了～`);
          break;
        case 'water_ball':
          if (target) await bot.lookAt(target.position.offset(0, target.height || 1, 0), true);
          bot.chat(`${msg} 看招！`);
          break;
        case 'water_blade':
          if (target) await bot.lookAt(target.position, true);
          bot.chat(`${msg} 斩！`);
          break;
        case 'water_curtain':
          try { await bot.chat(`/effect give ${bot.username} resistance 30 2`); } catch {}
          bot.chat(`${msg} 放心，有我在！`);
          break;
        case 'water_prison':
          if (target) {
            await bot.lookAt(target.position, true);
            try { await bot.chat(`/effect give @e[type=!player,distance=..8] slowness 10 5`); } catch {}
          }
          bot.chat(`${msg} 逃不掉的！`);
          break;
        case 'fog':
          bot.chat(`${msg} 看不见了吧？`);
          break;
        case 'rain':
          try { await bot.chat(`/weather thunder`); } catch {}
          bot.chat(`${msg} 下雨了！`);
          break;
        case 'water_dragon':
          if (target) await bot.lookAt(target.position, true);
          bot.chat(`${msg} 水龙，吞噬他！`);
          try { await bot.chat(`/effect give @e[type=!player,distance=..10] slowness 5 2`); } catch {}
          break;
        case 'wrath_water_king':
        case 'great_tsunami':
          if (target) await bot.lookAt(target.position, true);
          bot.chat(`${msg} 啊啊啊啊——！！`);
          try { await bot.chat(`/effect give @e[type=!player,distance=..15] slowness 15 4`); } catch {}
          try { await bot.chat(`/effect give @e[type=!player,distance=..15] weakness 15 3`); } catch {}
          break;
        default:
          bot.chat(msg);
      }
      break;
    }

    // ──── 冰系 ────
    case 'ice': {
      switch (spell.id) {
        case 'ice_lance':
          if (target) { await bot.lookAt(target.position.offset(0, target.height || 1, 0), true); }
          bot.chat(`${msg} 贯穿吧！`);
          break;
        case 'ice_shards':
          if (target) await bot.lookAt(target.position, true);
          bot.chat(`${msg} 散开！`);
          try { await bot.chat(`/effect give @e[type=!player,distance=..6] slowness 3 2`); } catch {}
          break;
        case 'freeze':
          if (target) {
            await bot.lookAt(target.position, true);
            try { await bot.chat(`/effect give @e[type=!player,distance=..5] slowness 10 255`); } catch {}
          }
          bot.chat(`${msg} 别动！`);
          break;
        case 'ice_armor':
          try { await bot.chat(`/effect give ${bot.username} resistance 60 2`); } catch {}
          try { await bot.chat(`/effect give ${bot.username} absorption 60 3`); } catch {}
          bot.chat(`${msg} 这样就安全了～`);
          break;
        case 'ice_wall':
          bot.chat(`${msg} 挡在我身后！`);
          try { await bot.chat(`/effect give ${bot.username} resistance 15 3`); } catch {}
          break;
        case 'ice_prison':
          if (target) {
            await bot.lookAt(target.position, true);
            try { await bot.chat(`/effect give @e[type=!player,distance=..8] slowness 20 255`); } catch {}
            try { await bot.chat(`/effect give @e[type=!player,distance=..8] weakness 20 5`); } catch {}
          }
          bot.chat(`${msg} 永远冻结吧！`);
          break;
        case 'blizzard':
          bot.chat(`${msg} 一切都要冻结了！`);
          try { await bot.chat(`/effect give @e[type=!player,distance=..12] slowness 15 3`); } catch {}
          try { await bot.chat(`/effect give @e[type=!player,distance=..12] weakness 15 2`); } catch {}
          break;
        case 'glacial_age':
          bot.chat(`${msg} 世界啊，陷入永冬吧——！！`);
          try { await bot.chat(`/effect give @e[type=!player,distance=..20] slowness 30 255`); } catch {}
          try { await bot.chat(`/effect give @e[type=!player,distance=..20] weakness 30 5`); } catch {}
          break;
        default:
          bot.chat(msg);
      }
      break;
    }

    // ──── 风系 ────
    case 'wind': {
      switch (spell.id) {
        case 'dry':
          bot.chat(`${msg} 好了，吹干了～`);
          break;
        case 'message':
          bot.chat(`${msg} 话传到了哦`);
          break;
        case 'wind_cutter':
          if (target) await bot.lookAt(target.position, true);
          bot.chat(`${msg} 看招！`);
          break;
        case 'wind_shield':
          bot.chat(`${msg}`);
          try { await bot.chat(`/effect give ${bot.username} speed 15 1`); } catch {}
          break;
        case 'gust':
          if (target) {
            await bot.lookAt(target.position, true);
            try { await bot.chat(`/effect give @e[type=!player,distance=..5] levitation 2 3`); } catch {}
          }
          bot.chat(`${msg} 飞吧！`);
          break;
        case 'wind_step':
          try { await bot.chat(`/effect give ${bot.username} speed 30 5`); } catch {}
          bot.chat(`${msg} 好快！`);
          break;
        case 'flight':
          try { await bot.chat(`/effect give ${bot.username} levitation 5 3`); } catch {}
          try { await bot.chat(`/effect give ${bot.username} slow_falling 60 1`); } catch {}
          bot.chat(`${msg} 飞起来了！`);
          break;
        default:
          bot.chat(msg);
      }
      break;
    }

    // ──── 土系 ────
    case 'earth': {
      switch (spell.id) {
        case 'rock_bullet':
          if (target) await bot.lookAt(target.position, true);
          bot.chat(`${msg} 接着！`);
          break;
        case 'earth_wall':
          try { await bot.chat(`/effect give ${bot.username} resistance 15 3`); } catch {}
          bot.chat(`${msg} 这样就安全了！`);
          break;
        case 'mud_swamp':
          if (target) await bot.lookAt(target.position, true);
          try { await bot.chat(`/effect give @e[type=!player,distance=..6] slowness 10 4`); } catch {}
          bot.chat(`${msg} 动不了了吧？`);
          break;
        case 'earth_split':
          if (target) {
            await bot.lookAt(target.position, true);
            try { await bot.chat(`/effect give @e[type=!player,distance=..10] slowness 5 2`); } catch {}
          }
          bot.chat(`${msg} 裂开吧！`);
          break;
        default:
          bot.chat(msg);
      }
      break;
    }

    // ──── 火系 ────
    case 'fire': {
      switch (spell.id) {
        case 'ignite':
          bot.chat(`${msg} 点好了～`);
          break;
        case 'fireball':
          if (target) await bot.lookAt(target.position, true);
          bot.chat(`${msg} 燃烧吧！`);
          try { await bot.chat(`/effect give @e[type=!player,distance=..4] slowness 2 1`); } catch {}
          break;
        case 'flame_wall':
          bot.chat(`${msg} 退后！`);
          try { await bot.chat(`/effect give @e[type=!player,distance=..8] slowness 5 2`); } catch {}
          break;
        default:
          bot.chat(msg);
      }
      break;
    }

    // ──── 雷系 ────
    case 'lightning': {
      if (spell.id === 'thunder_bolt' && target) {
        await bot.lookAt(target.position.offset(0, target.height || 1, 0), true);
        try { await bot.chat(`/summon lightning_bolt ${target.position.x} ${target.position.y} ${target.position.z}`); } catch {}
        bot.chat(`${msg} 天罚！！`);
      }
      break;
    }

    // ──── 治愈系 ────
    case 'heal': {
      const healTarget = targetName || bot.username;
      switch (spell.id) {
        case 'heal':
          try { await bot.chat(`/effect give ${healTarget} regeneration 10 2`); } catch {}
          bot.chat(`${msg} 好点了吗？`);
          break;
        case 'antidote':
          try { await bot.chat(`/effect give ${healTarget} regeneration 5 1`); } catch {}
          try { await bot.chat(`/effect clear ${healTarget}`); } catch {}
          bot.chat(`${msg} 毒素清除了！`);
          break;
        case 'regeneration':
          try { await bot.chat(`/effect give ${healTarget} regeneration 30 3`); } catch {}
          try { await bot.chat(`/effect give ${healTarget} absorption 30 4`); } catch {}
          bot.chat(`${msg} 这样就能恢复了！`);
          break;
        default:
          bot.chat(msg);
      }
      break;
    }

    // ──── 屏障/探测系 ────
    case 'barrier': {
      switch (spell.id) {
        case 'magic_barrier':
          try { await bot.chat(`/effect give ${bot.username} resistance 30 4`); } catch {}
          try { await bot.chat(`/effect give ${bot.username} absorption 30 5`); } catch {}
          bot.chat(`${msg} 别想通过这里！`);
          break;
        case 'invisibility':
          try { await bot.chat(`/effect give ${bot.username} invisibility 60 1`); } catch {}
          bot.chat(`${msg} 嘘——看不到我了～`);
          break;
        default:
          bot.chat(msg);
      }
      break;
    }

    // ──── 探测系 ────
    case 'detection': {
      switch (spell.id) {
        case 'light':
          try { await bot.chat(`/effect give ${bot.username} night_vision 120 1`); } catch {}
          bot.chat(`${msg} 亮起来了～`);
          break;
        case 'mana_detect':
          try { await bot.chat(`/effect give ${bot.username} night_vision 30 1`); } catch {}
          try { await bot.chat(`/effect give ${bot.username} glowing 10 1`); } catch {}
          bot.chat(`${msg} 嗯…那边有什么东西呢`);
          break;
        default:
          bot.chat(msg);
      }
      break;
    }
  }

  // 高级以上战吼
  if (spell.rank === 'king' && Math.random() < 0.8) {
    bot.chat('这就是水王级的力量！');
  } else if (spell.rank === 'advanced' && Math.random() < 0.4) {
    bot.chat(BATTLE_CRIES[Math.floor(Math.random() * BATTLE_CRIES.length)]);
  }

  return `${rankTag} ${displayName}`;
}

// ══════════════════════════════════════════════
//  Skill 接口
// ══════════════════════════════════════════════

const magicSkill: Skill = {
  name: 'magic',
  description: '洛琪希的完整魔法系统——42种法术，覆盖水/冰/风/土/火/雷/治愈/屏障八系',
  async execute(ctx: { bot: any; args: Record<string, unknown> }): Promise<{ success: boolean; message?: string }> {
    const { bot, args } = ctx;
    const spellId = String(args.spell ?? args.name ?? 'water_ball');
    const targetName = String(args.target ?? '');
    const listFlag = String(args.list ?? '');

    // 列出所有魔法
    if (listFlag === 'all' || spellId === 'list') {
      const byRank: Record<string, string[]> = { cantrip: [], intermediate: [], advanced: [], king: [] };
      for (const s of SPELLS) byRank[s.rank].push(`${s.id}=${s.name}`);
      const lines = Object.entries(byRank).map(([rank, list]) =>
        `${rankName(rank as MagicRank)}: ${list.join(', ')}`
      );
      return { success: true, message: lines.join(' | ') };
    }

    // 按等级列出
    if (listFlag) {
      const rankMap: Record<string, MagicRank> = { basic: 'cantrip', mid: 'intermediate', adv: 'advanced', king: 'king' };
      const rank = rankMap[listFlag] || listFlag as MagicRank;
      const list = SPELLS.filter(s => s.rank === rank).map(s => `${s.id}=${s.name}`);
      return { success: true, message: `${rankName(rank)}: ${list.join(', ')}` };
    }

    const spell = SPELL_MAP.get(spellId);
    if (!spell) {
      const byRank = ['cantrip', 'intermediate', 'advanced', 'king'].map(r =>
        `${rankName(r as MagicRank)}: ${SPELLS.filter(s => s.rank === r).map(s => s.id).join('|')}`
      ).join(' | ');
      return { success: false, message: `未知魔法「${spellId}」。可用: ${byRank}` };
    }

    // 冷却检查
    if (isOnCooldown(spellId)) {
      const remaining = Math.ceil((cooldowns.get(spellId)! - Date.now()) / 1000);
      return { success: false, message: `「${spell.name}」还需要 ${remaining} 秒冷却` };
    }

    // 魔力检查
    if (bot.food < spell.mana / 4 && spell.school !== 'heal') {
      return { success: false, message: '魔力不够了……吃点东西休息一下吧' };
    }

    // 找目标
    let target: any = null;
    if (targetName) {
      target = bot.players[targetName]?.entity;
    }
    if (!target && ['water_ball', 'water_blade', 'ice_lance', 'wind_cutter', 'rock_bullet',
                     'fireball', 'thunder_bolt', 'water_dragon', 'wrath_water_king'].includes(spellId)) {
      const hostile = Object.values(bot.entities).find((e: any) =>
        e && e !== bot.entity && e.type === 'mob' && e.position &&
        e.position.distanceTo(bot.entity.position) < 20
      );
      target = hostile || null;
    }

    setCooldown(spellId, spell.cooldown);

    try {
      const result = await castSpell(bot, spell, target, targetName);
      // 模拟魔力消耗
      if (spell.school !== 'heal' && spell.rank !== 'cantrip') {
        bot.food = Math.max(0, bot.food - Math.floor(spell.mana / 6));
      }
      logger.bot(`✨ ${result}`);
      return { success: true, message: result };
    } catch (err) {
      return { success: false, message: `魔法释放失败: ${(err as Error).message}` };
    }
  },
};

registerSkill(magicSkill);

export function getSpellList(): string[] {
  return SPELLS.map(s => s.id);
}
