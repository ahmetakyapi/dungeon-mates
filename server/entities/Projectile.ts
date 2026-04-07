import {
  ProjectileState,
  Vec2,
  TileType,
  TILE_SIZE,
  TICK_RATE,
} from '../../shared/types';

let nextProjectileId = 0;

const generateProjectileId = (): string => {
  nextProjectileId += 1;
  return `proj_${nextProjectileId}_${Date.now()}`;
};

const PROJECTILE_CONFIG = {
  arrow: { speed: 8, lifetime: 1.2, radius: 0.2, aoe: false },
  fireball: { speed: 5, lifetime: 1.5, radius: 0.3, aoe: true, aoeRadius: 1.5 },
  sword_slash: { speed: 0, lifetime: 0.15, radius: 1.2, aoe: false },
  holy_bolt: { speed: 6, lifetime: 1.3, radius: 0.25, aoe: false },
} as const;

export class Projectile {
  public state: ProjectileState;
  private readonly radius: number;
  private readonly isAoe: boolean;
  private readonly aoeRadius: number;

  constructor(
    ownerId: string,
    position: Vec2,
    direction: Vec2,
    damage: number,
    type: ProjectileState['type'],
  ) {
    const config = PROJECTILE_CONFIG[type];
    const speed = config.speed;

    this.state = {
      id: generateProjectileId(),
      ownerId,
      position: { x: position.x, y: position.y },
      velocity: { x: direction.x * speed, y: direction.y * speed },
      direction: { x: direction.x, y: direction.y },
      damage,
      lifetime: config.lifetime * TICK_RATE,
      type,
    };

    this.radius = config.radius;
    this.isAoe = 'aoe' in config && config.aoe === true;
    this.aoeRadius = 'aoeRadius' in config ? (config as { aoeRadius: number }).aoeRadius : 0;
  }

  getRadius(): number {
    return this.radius;
  }

  getIsAoe(): boolean {
    return this.isAoe;
  }

  getAoeRadius(): number {
    return this.aoeRadius;
  }

  update(tiles: TileType[][]): boolean {
    this.state.lifetime -= 1;

    if (this.state.lifetime <= 0) {
      return false;
    }

    const dx = this.state.velocity.x / TICK_RATE;
    const dy = this.state.velocity.y / TICK_RATE;
    const nextX = this.state.position.x + dx;
    const nextY = this.state.position.y + dy;

    // Bounds check on destination
    const tileX = Math.floor(nextX);
    const tileY = Math.floor(nextY);
    const w = tiles[0]?.length ?? 0;
    const h = tiles.length;

    if (tileX < 0 || tileY < 0 || tileX >= w || tileY >= h) {
      return false;
    }

    // Ray march: check intermediate tiles for fast projectiles that might skip walls
    const dist = Math.abs(dx) + Math.abs(dy); // Manhattan distance in tiles
    if (dist > 0.8) {
      // Step through intermediate tiles (simple DDA)
      const steps = Math.ceil(dist * 2);
      const stepX = dx / steps;
      const stepY = dy / steps;
      let cx = this.state.position.x;
      let cy = this.state.position.y;
      for (let s = 1; s <= steps; s++) {
        cx += stepX;
        cy += stepY;
        const tx = Math.floor(cx);
        const ty = Math.floor(cy);
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
        if (tiles[ty][tx] === 'wall') return false;
      }
    } else {
      // Short distance — just check destination
      if (tiles[tileY][tileX] === 'wall') {
        return false;
      }
    }

    this.state.position.x = nextX;
    this.state.position.y = nextY;

    return true;
  }

  checkCircleCollision(targetPos: Vec2, targetRadius: number): boolean {
    const dx = this.state.position.x - targetPos.x;
    const dy = this.state.position.y - targetPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.radius + targetRadius;
  }

  getAoeTargetsInRange(targetPos: Vec2, targetRadius: number): boolean {
    if (!this.isAoe) return false;
    const dx = this.state.position.x - targetPos.x;
    const dy = this.state.position.y - targetPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.aoeRadius + targetRadius;
  }

  getState(): ProjectileState {
    // Return direct reference — serialized by Socket.IO before next mutation
    return this.state;
  }
}
