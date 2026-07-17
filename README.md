# 🔮 洛琪希 Minecraft Agent

把 AI（洛琪希·米格路迪亚）接入 Minecraft 世界的 Agent 项目。

## 功能特性

- 🤖 **AI 自主行动**：洛琪希可以在游戏世界中自主移动、挖矿、建造、战斗
- 💬 **角色对话**：以洛琪希的性格和你聊天（温柔、冒失、水王级魔术师）
- 👥 **协作助手**：跟随玩家、帮助搬运、一起打怪
- 🏠 **生活自动化**：自动进食、整理箱子、种地等日常任务

## 系统架构

```
┌─────────────────────────────────────────┐
│  Minecraft Server (1.21.11)             │
│  localhost:25565                        │
└──────────────┬──────────────────────────┘
               │  Minecraft Protocol
┌──────────────▼──────────────────────────┐
│  Mineflayer Bot (Node.js)               │
│  - 连接服务器、操控角色、感知世界        │
└──────────────┬──────────────────────────┘
               │  世界状态 + 用户输入
┌──────────────▼──────────────────────────┐
│  Agent Brain (Ollama + qwen2.5:7b)      │
│  - 洛琪希角色 Prompt                     │
│  - 感知 → 思考 → 行动循环                 │
└──────────────┬──────────────────────────┘
               │  JSON 动作指令
┌──────────────▼──────────────────────────┐
│  Skills (行动执行层)                     │
│  move / follow / mine / attack / eat    │
└─────────────────────────────────────────┘
```

## 快速开始

### 环境要求

- **Node.js** 18+ (已安装 v24.18.0)
- **Java 21** (已安装)
- **Ollama** + qwen2.5:7b 模型 (已安装)

### 启动服务器

```bash
cd D:\ai beifen\roxy-mc
.\start-server.bat
```

### 启动 Bot

```bash
cd D:\ai beifen\roxy-mc
.\start-bot.bat
# 或者直接运行
node_modules\.bin\tsx src\index.ts
```

### 进入游戏

1. 打开 Minecraft 客户端 (版本 1.21.11)
2. 连接服务器：`localhost:25565`
3. 看到 **Roxy** 角色即表示成功
4. 按 T 打开聊天，输入 `/msg Roxy 你好` 和她对话

## 项目结构

```
roxy-mc/
├── src/
│   ├── index.ts              # 入口文件
│   ├── config.ts             # 配置读取
│   ├── bot/
│   │   ├── Bot.ts            # Mineflayer bot 封装
│   │   └── plugins.ts        # 插件加载
│   ├── brain/
│   │   ├── Brain.ts          # Agent 主循环
│   │   ├── llm.ts            # Ollama API 调用
│   │   └── prompts.ts        # 洛琪希角色 prompt
│   ├── skills/
│   │   ├── index.ts          # 技能注册表
│   │   ├── move.ts           # 移动/寻路
│   │   ├── follow.ts         # 跟随玩家
│   │   ├── mine.ts           # 挖掘方块
│   │   ├── attack.ts         # 战斗
│   │   ├── chat.ts           # 聊天
│   │   ├── eat.ts            # 自动进食
│   │   └── idle.ts           # 空闲/等待
│   └── utils/
│       ├── logger.ts         # 日志工具
│       └── worldState.ts     # 世界状态收集
├── server/                   # MC 服务器文件
├── start-server.bat          # 服务器启动脚本
├── start-bot.bat             # Bot 启动脚本
├── package.json
└── .env                      # 环境变量配置
```

## 配置说明

### .env 文件

```env
# Minecraft 服务器配置
MC_HOST=localhost
MC_PORT=25565
MC_USERNAME=Roxy
MC_VERSION=1.21.11

# Ollama LLM 配置
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b

# Agent 配置
THINK_INTERVAL_MS=2000
```

### 切换 LLM 模型

如果你想使用更大的模型或其他模型：

```bash
# 查看可用模型
ollama list

# 下载更大模型（需要更多内存）
ollama pull qwen2.5:14b

# 修改 .env 文件
OLLAMA_MODEL=qwen2.5:14b
```

## 技能系统

当前支持的动作：

| 技能 | 描述 |
|------|------|
| `move` | 移动到指定坐标 |
| `follow` | 跟随玩家 |
| `mine` | 挖掘指定方块 |
| `attack` | 攻击最近的敌对生物 |
| `eat` | 从物品栏找食物进食 |
| `chat` | 在游戏里说话 |
| `idle` | 原地待命，观察周围 |
| `wait` | 等待指定秒数 |

## 角色设定

洛琪希的 prompt 定义在 `src/brain/prompts.ts` 中，包含：

- 核心性格（温柔、冒失、水王级魔术师）
- 行为倾向（保护玩家、好奇新事物）
- 说话风格（带"呢""呀""哦"等语气词）

## 故障排查

### Bot 无法连接服务器

1. 确认服务器已启动并显示 "Done"
2. 检查 `.env` 中的服务器地址和端口
3. 查看服务器日志是否有错误

### LLM 响应慢

1. 确认 Ollama 运行正常：`ollama list`
2. 查看 Ollama 服务状态
3. 考虑使用更小的模型

### 服务器启动失败

1. 确认 Java 21 已安装
2. 删除 `server/` 目录重新下载
3. 检查端口 25565 是否被占用

## 开发说明

### 添加新技能

1. 在 `src/skills/` 目录创建文件，例如 `newSkill.ts`
2. 实现 Skill 接口
3. 调用 `registerSkill()` 注册
4. 在 `src/brain/Brain.ts` 中导入

### 修改角色性格

编辑 `src/brain/prompts.ts` 中的 `ROXY_SYSTEM_PROMPT`

## 许可证

MIT License

---

**享受和洛琪希的 Minecraft 冒险！** 🎮✨
