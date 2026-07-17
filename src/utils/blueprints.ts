import { logger } from './logger.js';
import { memory } from './memory.js';

/** 单个方块定义 */
interface BlueprintBlock {
  x: number;
  y: number;
  z: number;
  blockName: string;
}

/** 蓝图定义 */
export interface Blueprint {
  name: string;
  description: string;
  width: number;
  height: number;
  depth: number;
  blocks: BlueprintBlock[];
}

/** 方块映射表：字符 → 方块名 */
type BlockMap = Record<string, string>;

/** 逐层定义：字符串数组 + 方块映射 */
interface LayerBlueprint {
  name: string;
  description: string;
  /** 每一层的 y 坐标和对应的 2D 图案 */
  layers: Array<{
    y: number;
    pattern: string[];
  }>;
  /** 字符映射表 */
  map: BlockMap;
}

/**
 * 将逐层图案转换为绝对坐标蓝图
 */
function compileLayers(lb: LayerBlueprint): Blueprint {
  const blocks: BlueprintBlock[] = [];
  const width = lb.layers[0].pattern[0].length;
  const depth = lb.layers[0].pattern.length;

  for (const layer of lb.layers) {
    for (let z = 0; z < layer.pattern.length; z++) {
      const row = layer.pattern[z];
      for (let x = 0; x < row.length; x++) {
        const char = row[x];
        if (char === '.' || char === ' ') continue;
        const blockName = lb.map[char];
        if (blockName) {
          blocks.push({ x, y: layer.y, z, blockName });
        }
      }
    }
  }

  return {
    name: lb.name,
    description: lb.description,
    width,
    height: lb.layers.length,
    depth,
    blocks,
  };
}

// ============================================================
// 图纸库
// ============================================================

/**
 * 1. 温馨小木屋
 * 带阁楼、窗户、门廊的乡村风格木屋
 */
const cabin: LayerBlueprint = {
  name: '温馨小木屋',
  description: '乡村风格小木屋，带阁楼和门廊',
  map: {
    '#': 'oak_planks',
    'L': 'oak_log',
    'W': 'spruce_planks',
    'G': 'glass',
    'R': 'spruce_stairs',
    'r': 'spruce_slab',
    'D': 'oak_door',
    'F': 'oak_fence',
    'T': 'torch',
    'B': 'bookshelf',
    'C': 'crafting_table',
    'S': 'stone',
    'O': 'cobblestone',
    'P': 'spruce_fence',
  },
  layers: [
    // y=0: 地基（石头+木板地板）
    {
      y: 0, pattern: [
        'SSSSSSS',
        'S#####S',
        'S#####S',
        'S#####S',
        'S#####S',
        'S#####S',
        'SSSSSSS',
      ],
    },
    // y=1: 墙壁+门+窗户
    {
      y: 1, pattern: [
        'WWWWWWW',
        'W#GG#DW',
        'W# B #W',
        'W#   #W',
        'W# B #W',
        'W#GG# W',
        'WWWWWWW',
      ],
    },
    // y=2: 墙壁+窗户
    {
      y: 2, pattern: [
        'WWWWWWW',
        'W#GG# W',
        'W#   #W',
        'W#   #W',
        'W#   #W',
        'W#GG# W',
        'WWWWWWW',
      ],
    },
    // y=3: 屋顶底部
    {
      y: 3, pattern: [
        '..RRR..',
        '.RRRRR.',
        'RRRRRRR',
        'RRRRRRR',
        'RRRRRRR',
        '.RRRRR.',
        '..RRR..',
      ],
    },
    // y=4: 屋顶顶部
    {
      y: 4, pattern: [
        '...R...',
        '..RRR..',
        '.RRRRR.',
        'RRRRRRR',
        '.RRRRR.',
        '..RRR..',
        '...R...',
      ],
    },
    // 装饰：火把在门口
    {
      y: 1, pattern: [
        '.......',
        '..T.T..',
        '.......',
        '..D....',
        '.......',
        '..T.T..',
        '.......',
      ],
    },
    // 围栏
    {
      y: 0, pattern: [
        '.......',
        '.......',
        '..F....',
        '.......',
        '..F....',
        '.......',
        '.......',
      ],
    },
  ],
};

/**
 * 2. 现代玻璃别墅
 * 简约现代风格，大量玻璃 + 石英
 */
const modernVilla: LayerBlueprint = {
  name: '现代玻璃别墅',
  description: '简约现代别墅，落地窗+平顶',
  map: {
    '#': 'quartz_block',
    'G': 'glass',
    'W': 'white_concrete',
    'L': 'smooth_quartz',
    'S': 'smooth_quartz_slab',
    'D': 'birch_door',
    'T': 'torch',
    'F': 'iron_bars',
    'O': 'spruce_planks',
    'C': 'cyan_terracotta',
    'B': 'bookshelf',
  },
  layers: [
    // y=0: 地基
    {
      y: 0, pattern: [
        'WWWWWWW',
        'W#####W',
        'W#####W',
        'W#####W',
        'W#####W',
        'W#####W',
        'WWWWWWW',
      ],
    },
    // y=1: 一层墙壁+落地窗
    {
      y: 1, pattern: [
        'WWWWWWW',
        'WGGGGGW',
        'W#CCC#W',
        'W#CCC#W',
        'W#BBB#W',
        'WGGGGGW',
        'WWW D W',
      ],
    },
    // y=2: 二层墙壁
    {
      y: 2, pattern: [
        'WWWWWWW',
        'WGGGGGW',
        'W#   #W',
        'W#   #W',
        'W#   #W',
        'WGGGGGW',
        'WWWWWWW',
      ],
    },
    // y=3: 屋顶（石英+铁栏杆围栏）
    {
      y: 3, pattern: [
        'LLLLLLL',
        'L    SL',
        'L    SL',
        'L    SL',
        'L    SL',
        'L    SL',
        'LLLLLLL',
      ],
    },
  ],
};

/**
 * 3. 和风小院
 * 日式风格，深色木+石+纸灯笼
 */
const japaneseHouse: LayerBlueprint = {
  name: '和风小院',
  description: '日式风格小屋，深色木+石瓦',
  map: {
    '#': 'dark_oak_planks',
    'L': 'dark_oak_log',
    'W': 'birch_planks',
    'G': 'glass_pane',
    'R': 'dark_oak_stairs',
    'r': 'dark_oak_slab',
    'S': 'stone_bricks',
    'D': 'dark_oak_door',
    'F': 'dark_oak_fence',
    'T': 'lantern',
    'O': 'spruce_trapdoor',
    'C': 'cherry_planks',
    'P': 'cherry_fence',
    'B': 'bamboo_block',
  },
  layers: [
    // y=0: 地基
    {
      y: 0, pattern: [
        '.........',
        '.LLLLLLL.',
        '.L#####L.',
        '.L#WWW#L.',
        '.L#WWW#L.',
        '.L#WWW#L.',
        '.L#####L.',
        '.LLLLLLL.',
        '.........',
      ],
    },
    // y=1: 墙壁+推拉门（暗色木+玻璃）
    {
      y: 1, pattern: [
        '.........',
        '.L#####L.',
        '.L#  G#L.',
        '.L# W #L.',
        '.LD W DL.',
        '.L# W #L.',
        '.L#G   L.',
        '.L#####L.',
        '.........',
      ],
    },
    // y=2: 墙壁+上部
    {
      y: 2, pattern: [
        '.........',
        '.L#####L.',
        '.L#GGG#L.',
        '.L#WWW#L.',
        '.L#WWW#L.',
        '.L#WWW#L.',
        '.L#GGG#L.',
        '.L#####L.',
        '.........',
      ],
    },
    // y=3: 屋顶（深色木楼梯）
    {
      y: 3, pattern: [
        '....R....',
        '...RRR...',
        '..RRRRR..',
        '.RRRRRRR.',
        'RRRRRRRRR',
        '.RRRRRRR.',
        '..RRRRR..',
        '...RRR...',
        '....R....',
      ],
    },
  ],
};

// 编译所有蓝图
const blueprints: Blueprint[] = [
  compileLayers(cabin),
  compileLayers(modernVilla),
  compileLayers(japaneseHouse),
];

/** 获取所有蓝图名称 */
export function listBlueprints(): string[] {
  return blueprints.map(b => `${b.name} (${b.width}x${b.depth}, ${b.blocks.length} 方块)`);
}

/** 按名称查找蓝图 */
export function findBlueprint(name: string): Blueprint | undefined {
  return blueprints.find(b => b.name.includes(name) || name.includes(b.name));
}

/** 获取所有蓝图 */
export function getAllBlueprints(): Blueprint[] {
  return blueprints;
}
