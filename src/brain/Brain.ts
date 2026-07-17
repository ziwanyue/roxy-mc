import type { Bot } from 'mineflayer';
import pf from 'mineflayer-pathfinder';
const { Movements, goals } = pf;
import { askLLM } from './llm.js';
import { ROXY_SYSTEM_PROMPT, buildWorldMessage } from './prompts.js';
import { collectWorldState, updateWorldMemory } from '../utils/worldState.js';
import { executeSkill } from '../skills/index.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// 导入技能（触发注册）
import '../skills/move.js';
import '../skills/follow.js';
import '../skills/mine.js';
import '../skills/chat.js';
import '../skills/attack.js';
import '../skills/eat.js';
import '../skills/idle.js';
import '../skills/build.js';
import '../skills/craft.js';
import '../skills/mineStrip.js';
import '../skills/farm.js';
import '../skills/sleep.js';
import '../skills/explore.js';
import '../skills/flee.js';
import '../skills/cook.js';
import '../skills/give.js';
import '../skills/magic.js';

interface Task {
  action: string;
  params: Record<string, unknown>;
}

export class Brain {
  private bot: Bot;
  private recentChat: string[] = [];
  private lastActionResult = '';
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isThinking = false;

  // 任务队列
  private taskQueue: Task[] = [];
  private currentPlanDescription = '';
  private idleCount = 0; // 连续 idle 计数

  // 持续跟随模式
  private followTarget: string | null = null;
  private followTimer: ReturnType<typeof setInterval> | null = null;

  constructor(bot: Bot) {
    this.bot = bot;
    this.setupChatListener();
  }

  private setupChatListener(): void {
    this.bot.on('chat', (username: string, message: string) => {
      if (username === this.bot.username) return;
      if (/^Roxy\d{4,}$/.test(username)) return;

      // 检测"跟随"命令 → 启动持续跟随
      if (/跟[随着我]|过来|过来跟我|follow/i.test(message)) {
        this.startFollow(username);
        this.bot.chat(`来啦来啦～跟着你走！`);
        return;
      }
      // 检测"停下"命令 → 停止跟随
      if (/停|站住|别跟|原地|stop/i.test(message)) {
        this.stopFollow();
        this.bot.chat(`好～那我先在这里待着`);
        return;
      }

      this.recentChat.push(`[${username}]: ${message}`);
      this.recentChat.length = 0;
      this.recentChat.push(`[${username}]: ${message}`);
      this.taskQueue = [];
      if (this.recentChat.length > 20) this.recentChat = this.recentChat.slice(-20);
    });

    this.bot.on('whisper', (username: string, message: string) => {
      if (username === this.bot.username) return;
      if (/^Roxy\d{4,}$/.test(username)) return;

      if (/跟[随着我]|过来|过来跟我|follow/i.test(message)) {
        this.startFollow(username);
        this.bot.chat(`来啦来啦～跟着你走！`);
        return;
      }
      if (/停|站住|别跟|原地|stop/i.test(message)) {
        this.stopFollow();
        this.bot.chat(`好～那我先在这里待着`);
        return;
      }

      this.recentChat.push(`[${username} 悄悄说]: ${message}`);
      this.taskQueue = [];
      if (this.recentChat.length > 20) this.recentChat = this.recentChat.slice(-20);
    });
  }

  /** 启动持续跟随 */
  private startFollow(player: string): void {
    this.stopFollow();
    this.followTarget = player;
    this.taskQueue = [];
    logger.info(`持续跟随模式: ${player}`);

    this.followTimer = setInterval(async () => {
      if (!this.followTarget) return;
      const target = this.bot.players[this.followTarget]?.entity;
      if (!target) return;

      const dist = target.position.distanceTo(this.bot.entity.position);
      if (dist > 3) {
        const movements = new Movements(this.bot);
        this.bot.pathfinder.setMovements(movements);
        try {
          await this.bot.pathfinder.goto(new goals.GoalNear(
            target.position.x, target.position.y, target.position.z, 2
          ));
        } catch { /* 寻路失败重试 */ }
      }
    }, 2000);
  }

  /** 停止跟随 */
  private stopFollow(): void {
    this.followTarget = null;
    if (this.followTimer) {
      clearInterval(this.followTimer);
      this.followTimer = null;
    }
    this.bot.pathfinder.stop();
  }

  start(): void {
    logger.info(`Agent 启动，思考间隔: ${config.thinkIntervalMs}ms`);
    this.intervalId = setInterval(() => this.tick(), config.thinkIntervalMs);
  }

  stop(): void {
    this.stopFollow();
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.isThinking) return;
    this.isThinking = true;

    try {
      updateWorldMemory(this.bot.entity.position);

      // 持续跟随中，不执行 LLM 决策
      if (this.followTarget) return;

      // ═══ 紧急响应层（优先于任何决策）═══

      // 1. 检测苦力怕/岩浆/低血量 → 紧急逃离
      const nearbyEntities = Object.values(this.bot.entities) as any[];
      const hasCreeper = nearbyEntities.some(e =>
        e && e !== this.bot.entity && e.name === 'creeper' && e.position.distanceTo(this.bot.entity.position) < 6
      );
      const checkPos = this.bot.entity.position.floored();
      const atLava = this.bot.blockAt(checkPos);
      const isOnLava = atLava && (atLava.name === 'lava' || atLava.name === 'fire');

      if (hasCreeper || isOnLava || this.bot.health < 6) {
        const result = await executeSkill('flee', { bot: this.bot, args: {} });
        if (result.success) {
          this.bot.chat('危、危险！快跑！！');
          logger.bot(`🚨 紧急避险: ${result.message}`);
        }
        return;
      }

      // ═══ 洛琪希自动魔法系统 ═══
      // 根据战况智能选择最合适的魔法

      // 1. 低血量 → 治愈
      if (this.bot.health < 12 && this.bot.health >= 6) {
        const healSpell = this.bot.health < 8 ? 'regeneration' : 'heal';
        logger.bot(`💚 血量 ${this.bot.health}/20，使用治愈魔法`);
        await executeSkill('magic', { bot: this.bot, args: { spell: healSpell, target: this.bot.username } });
        return;
      }

      // 2. 检测附近敌对生物 → 选择最合适的攻击魔法
      const hostileMobs = Object.values(this.bot.entities).filter((e: any) =>
        e && e !== this.bot.entity && e.type === 'mob' && e.position &&
        e.position.distanceTo(this.bot.entity.position) < 14 &&
        ['zombie','skeleton','creeper','spider','drowned','phantom','enderman','blaze',
         'hoglin','piglin','witch','pillager','slime','magma_cube','guardian','cave_spider',
         'stray','husk','wither_skeleton','piglin_brute','zoglin','ravager','vindicator','evoker'].includes(e.name)
      );

      if (hostileMobs.length > 0) {
        const closest = hostileMobs.sort((a: any, b: any) =>
          a.position.distanceTo(this.bot.entity.position) - b.position.distanceTo(this.bot.entity.position)
        )[0];
        const dist = closest.position.distanceTo(this.bot.entity.position);
        const count = hostileMobs.length;

        let spell = 'water_ball';
        let strategy = '';

        if (count >= 3) {
          const aoe = ['blizzard','thunder_raincloud','great_tsunami','wrath_water_king'];
          spell = aoe[Math.floor(Math.random() * aoe.length)];
          strategy = `群怪(${count}只)`;
        } else if (dist > 8) {
          const ranged = ['thunder_bolt','water_dragon','fireball','ice_lance'];
          spell = ranged[Math.floor(Math.random() * ranged.length)];
          strategy = '远程';
        } else if (dist > 4) {
          const mid = ['ice_lance','wind_cutter','rock_bullet','water_blade'];
          spell = mid[Math.floor(Math.random() * mid.length)];
          strategy = '中距离';
        } else {
          const close = ['water_ball','ice_shards','gust','water_prison'];
          spell = close[Math.floor(Math.random() * close.length)];
          strategy = '近战';
        }
        if (['ravager','evoker','piglin_brute'].includes(closest.name || '') && Math.random() < 0.5) {
          spell = 'wrath_water_king'; strategy = `Boss(${closest.name})`;
        }
        if ((closest.name || '') === 'creeper' && dist < 4) { spell = 'gust'; strategy = '苦力怕'; }

        logger.bot(`⚡[${strategy}] ${closest.name}(${Math.round(dist)}m)→${spell}`);
        await executeSkill('magic', { bot: this.bot, args: { spell } });

        if (closest.position?.distanceTo(this.bot.entity.position) < 4) {
          await executeSkill('attack', { bot: this.bot, args: {} });
        }
        return;
      }

      // 3. 野外探索时偶尔用辅助魔法
      if (Math.random() < 0.04) {
        await executeSkill('magic', { bot: this.bot, args: { spell: 'mana_detect' } });
        return;
      }

      // 2. 饥饿时自动进食
      if (this.bot.food < 10) {
        const food = this.bot.inventory.items().find((i: any) =>
          ['apple', 'bread', 'cooked_beef', 'cooked_porkchop', 'cooked_chicken',
           'cooked_mutton', 'baked_potato', 'golden_apple', 'carrot', 'melon_slice',
           'sweet_berries', 'cookie'].includes(i.name)
        );
        if (food) {
          try {
            await this.bot.equip(food, 'hand');
            await this.bot.consume();
            logger.bot(`🍽️ 自动吃了 ${food.name}`);
          } catch { /* 吃不到就算了 */ }
        }
      }

      // 3. 天黑且附近有床 → 建议睡觉
      const time = this.bot.time.timeOfDay;
      const isNight = time > 13000 && time < 23000;
      if (isNight && Math.random() < 0.1) {
        const hasBed = this.bot.findBlock({
          matching: (b: any) => b?.name?.includes('bed') || b?.name?.includes('_bed'),
          maxDistance: 16,
        });
        if (hasBed) {
          this.taskQueue = [{ action: 'sleep', params: {} }];
          logger.bot('🌙 天黑了，去找床睡觉...');
          return;
        }
      }

      // 4. 检测附近玩家饱食度 → 自动投喂
      if (Math.random() < 0.1) { // 每 10 次检查一次
        for (const [name, player] of Object.entries(this.bot.players) as any) {
          if (name === this.bot.username || /^Roxy\d{4,}$/.test(name)) continue;
          if (!player.entity) continue;
          const dist = player.entity.position.distanceTo(this.bot.entity.position);
          if (dist > 8) continue;

          // 有食物就给玩家
          const food = this.bot.inventory.items().find((i: any) =>
            ['cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'bread',
             'baked_potato', 'apple', 'golden_apple', 'cooked_mutton'].includes(i.name)
          );
          if (food) {
            try {
              await this.bot.toss(food.type, null, 1);
              this.bot.chat(`${name}，给你点吃的！`);
              logger.bot(`🎁 自动投喂 ${name} ${food.name}`);
            } catch { /* 跳过 */ }
          }
          break;
        }
      }

      // 任务队列执行
      if (this.taskQueue.length > 0) {
        const task = this.taskQueue.shift()!;
        const result = await executeSkill(task.action, {
          bot: this.bot,
          args: task.params,
        });

        this.lastActionResult = result.success
          ? `✅ [${this.currentPlanDescription}] ${task.action}: ${result.message} (剩余 ${this.taskQueue.length} 步)`
          : `❌ [${this.currentPlanDescription}] ${task.action} 失败: ${result.message}`;

        if (result.success) logger.bot(`✓ ${this.lastActionResult}`);
        else logger.warn(`✗ ${this.lastActionResult}`);

        if (this.taskQueue.length === 0) {
          logger.bot(`🎉 ${this.currentPlanDescription} 搞定了！`);
        }
        return;
      }

      // LLM 决策
      const worldState = collectWorldState(this.bot, this.recentChat);
      worldState.lastActionResult = this.lastActionResult;
      const userMessage = buildWorldMessage(worldState);

      const response = await askLLM(ROXY_SYSTEM_PROMPT, userMessage);

      if (!response) {
        logger.warn('LLM 无响应');
        return;
      }

      if (response.chat) {
        this.bot.chat(response.chat);
        logger.bot(`[说] ${response.chat}`);
      }

      if (response.plan && Array.isArray(response.plan)) {
        this.idleCount = 0;
        this.taskQueue = response.plan;
        this.currentPlanDescription = response.chat || '开始干活';
        logger.bot(`📋 计划 (${this.taskQueue.length} 步): ${this.currentPlanDescription}`);
      } else if (response.action) {
        if (response.action === 'idle') {
          this.idleCount++;
          // 连续 idle 3 次 → 主动探索
          if (this.idleCount >= 3) {
            this.idleCount = 0;
            this.taskQueue = [{ action: 'explore', params: {} }];
            logger.bot('👣 没事做，出去探索一下');
            return;
          }
          logger.bot('（看看有什么好玩的...）');
        } else if (response.action === 'wait') {
          const seconds = Number(response.params?.seconds ?? 2);
          await new Promise(r => setTimeout(r, seconds * 1000));
        } else if (response.action !== 'chat') {
          this.idleCount = 0;
          const result = await executeSkill(response.action, {
            bot: this.bot,
            args: response.params ?? {},
          });
          this.lastActionResult = result.success
            ? `✅ ${result.message}` : `❌ ${result.message}`;
          if (result.success) logger.bot(`✓ ${result.message}`);
          else logger.warn(`✗ ${result.message}`);
        }
      }

    } catch (err) {
      logger.error(`tick 失败: ${(err as Error).message}`);
    } finally {
      this.isThinking = false;
    }
  }
}
