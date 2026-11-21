import { SIZE, HEIGHT, chunkOf } from '../world/world.js';
import { meshChunk, meshTerrain } from './mesh.js';

export function selectTiles(cx, cz, radius, detail, canApproximate = true) {
  const tiles = [];
  const root = canApproximate ? 8 : 1;
  function visit(x, z, step) {
    const dx = Math.max(x - cx, 0, cx - (x + step - 1));
    const dz = Math.max(z - cz, 0, cz - (z + step - 1));
    const distance = Math.max(dx, dz);
    if (distance > radius) return;
    if (step > 1 && distance <= detail * (step / 2)) {
      const half = step / 2;
      visit(x, z, half);
      visit(x + half, z, half);
      visit(x, z + half, half);
      visit(x + half, z + half, half);
    } else {
      tiles.push({ x, z, step, distance, key: `${x},${z},${step}` });
    }
  }
  for (let z = Math.floor((cz - radius) / root) * root; z <= cz + radius; z += root) {
    for (let x = Math.floor((cx - radius) / root) * root; x <= cx + radius; x += root) visit(x, z, root);
  }
  return tiles.sort((a, b) => a.distance - b.distance || a.step - b.step);
}

export class ChunkStream {
  constructor(world, renderer) {
    this.world = world;
    this.renderer = renderer;
    this.active = new Map();
    this.dirty = new Set();
    this.signature = '';
    this.wanted = [];
    this.jobs = [];
    world.onEdit = (x, z) => {
      for (const [dx, dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
        const key = `${x+dx},${z+dz},1`;
        if (this.active.has(key)) this.dirty.add(key);
      }
    };
  }

  update(position, settings) {
    const cx = chunkOf(position[0]), cz = chunkOf(position[2]);
    const { distance, detail } = settings;
    if (this.ao !== settings.ao) {
      this.ao = settings.ao;
      for (const [key, tile] of this.active) if (tile.step === 1) this.dirty.add(key);
    }
    const signature = `${cx},${cz},${distance},${detail}`;
    if (signature !== this.signature) {
      this.signature = signature;
      this.wanted = selectTiles(cx, cz, distance, detail, !!this.world.generator.surface);
      const keys = new Set(this.wanted.map(tile => tile.key));
      for (const [key, tile] of this.active) {
        if (keys.has(key)) continue;
        this.renderer.release(tile.mesh);
        this.active.delete(key);
        this.dirty.delete(key);
      }
      this.jobs = this.wanted.filter(tile => !this.active.has(tile.key));
      this.world.prune(cx, cz, Math.min(distance, detail) + 3);
    }
    const deadline = performance.now() + (settings.budget ?? 4);
    let uploads = 0;
    do {
      const dirtyKey = this.dirty.values().next().value;
      const tile = dirtyKey ? this.active.get(dirtyKey) : this.jobs.shift();
      if (!tile) break;
      if (tile.step === 1) {
        const missing = [[0,0],[1,0],[-1,0],[0,1],[0,-1]].find(([dx,dz]) => !this.world.chunks.has(`${tile.x+dx},${tile.z+dz}`));
        if (missing) {
          this.world.chunk(tile.x+missing[0], tile.z+missing[1]);
          if (!dirtyKey) this.jobs.unshift(tile);
          continue;
        }
      }
      if (dirtyKey) {
        this.dirty.delete(dirtyKey);
        this.renderer.release(tile.mesh);
      }
      const { x, z, step, key } = tile;
      const ox = x * SIZE, oz = z * SIZE;
      const world = this.world;
      const surface = world.generator.surface;
      const data = step > 1 ? meshTerrain((a, b) => surface.call(world.generator, a, b), ox, oz, step)
        : meshChunk(world.chunk(x, z), [
          world.chunk(x+1,z), world.chunk(x-1,z), world.chunk(x,z+1), world.chunk(x,z-1),
        ], settings.ao);
      this.active.set(key, { ...tile, mesh: this.renderer.upload(data), bounds: [ox, oz, ox + step*SIZE, oz + step*SIZE, HEIGHT] });
      uploads++;
    } while (uploads < 2 && performance.now() < deadline);
  }

  dispose() {
    for (const tile of this.active.values()) this.renderer.release(tile.mesh);
    this.active.clear();
    this.world.onEdit = null;
  }
}
