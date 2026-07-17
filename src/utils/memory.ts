import { logger } from './logger.js';

interface MemoryEntry {
  type: 'place' | 'resource' | 'event';
  position: { x: number; y: number; z: number };
  description: string;
  timestamp: number;
}

export class Memory {
  private entries: MemoryEntry[] = [];
  private lastPos = { x: 0, y: 0, z: 0 };
  private recordThreshold = 100; // 移动多少格才记录新位置

  addPlace(pos: { x: number; y: number; z: number }, description: string): void {
    // 检查是否已有附近记录
    const existing = this.entries.find(
      e => e.type === 'place' && this.distance(e.position, pos) < 20
    );
    if (existing) {
      existing.description = description;
      existing.timestamp = Date.now();
      return;
    }

    this.entries.push({
      type: 'place',
      position: { ...pos },
      description,
      timestamp: Date.now(),
    });
    // 最多记住 20 条
    if (this.entries.length > 20) this.entries = this.entries.slice(-20);
  }

  addResource(pos: { x: number; y: number; z: number }, resource: string): void {
    const existing = this.entries.find(
      e => e.type === 'resource' && e.description === resource && this.distance(e.position, pos) < 10
    );
    if (existing) return;

    this.entries.push({
      type: 'resource',
      position: { ...pos },
      description: resource,
      timestamp: Date.now(),
    });
    if (this.entries.length > 20) this.entries = this.entries.slice(-20);
  }

  addEvent(description: string): void {
    this.entries.push({
      type: 'event',
      position: { x: 0, y: 0, z: 0 },
      description,
      timestamp: Date.now(),
    });
    if (this.entries.length > 20) this.entries = this.entries.slice(-20);
  }

  checkNewPosition(pos: { x: number; y: number; z: number }): void {
    if (this.distance(pos, this.lastPos) > this.recordThreshold) {
      this.lastPos = { ...pos };
      this.addPlace(pos, `坐标 (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}) 附近`);
    }
  }

  getSummary(): string {
    if (this.entries.length === 0) return '还没有什么特别的记忆。';
    const places = this.entries.filter(e => e.type === 'place').slice(-3);
    const resources = this.entries.filter(e => e.type === 'resource').slice(-3);
    const events = this.entries.filter(e => e.type === 'event').slice(-3);

    const parts: string[] = [];
    if (places.length > 0) {
      parts.push(`去过: ${places.map(p => p.description).join('、')}`);
    }
    if (resources.length > 0) {
      parts.push(`发现过: ${resources.map(r => r.description).join('、')}`);
    }
    if (events.length > 0) {
      parts.push(`经历: ${events.map(e => e.description).join('、')}`);
    }
    return parts.join(' | ');
  }

  private distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  }
}

export const memory = new Memory();
