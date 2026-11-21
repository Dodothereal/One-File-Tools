import { AIR, blocks } from './blocks.js';
import { removeNetherPortal } from './portals.js';

export const SIZE = 16;
export const HEIGHT = 96;
export const chunkOf = n => Math.floor(n / SIZE);
export const chunkKey = (x, z) => `${x},${z}`;
export const indexOf = (x, y, z) => (y * SIZE + z) * SIZE + x;

export class World {
  constructor(dimension, seed, edits = new Map()) {
    this.dimension = dimension;
    this.seed = seed;
    this.generator = dimension.create(seed);
    this.chunks = new Map();
    this.edits = edits;
    this.onEdit = null;
  }

  chunk(cx, cz) {
    const key = chunkKey(cx, cz);
    if (!this.chunks.has(key)) {
      const data = new Uint8Array(SIZE * SIZE * HEIGHT);
      this.generator.generate({
        x: cx * SIZE, z: cz * SIZE, size: SIZE, height: HEIGHT,
        set(x, y, z, id, replace) {
          if (x < 0 || z < 0 || y < 0 || x >= SIZE || z >= SIZE || y >= HEIGHT) return;
          const i = indexOf(x, y, z);
          if (replace === undefined || data[i] === replace) data[i] = id;
        },
      });
      for (const [i, id] of this.edits.get(key) ?? []) data[i] = id;
      this.chunks.set(key, data);
    }
    return this.chunks.get(key);
  }

  get(x, y, z) {
    if (y < 0 || y >= HEIGHT) return AIR;
    const cx = chunkOf(x), cz = chunkOf(z);
    return this.chunk(cx, cz)[indexOf(x - cx * SIZE, y, z - cz * SIZE)];
  }

  set(x, y, z, id, updatePortals = true) {
    if (!blocks[id] || y < 0 || y >= HEIGHT) return false;
    const cx = chunkOf(x), cz = chunkOf(z);
    const key = chunkKey(cx, cz);
    const i = indexOf(x - cx * SIZE, y, z - cz * SIZE);
    const data = this.chunk(cx, cz);
    if (data[i] === id) return false;
    data[i] = id;
    if (!this.edits.has(key)) this.edits.set(key, new Map());
    this.edits.get(key).set(i, id);
    if (updatePortals) removeNetherPortal(this, [x, y, z]);
    this.onEdit?.(cx, cz);
    return true;
  }

  prune(cx, cz, radius) {
    for (const key of this.chunks.keys()) {
      const [x, z] = key.split(',').map(Number);
      if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) > radius) this.chunks.delete(key);
    }
  }

  spawn(x = 0, z = 0) {
    const position = this.generator.spawn?.(x, z);
    if (position) {
      const [sx, sy, sz] = position.map(Math.floor);
      const clear = (x, y, z) => this.get(x, y, z) === AIR && this.get(x, y + 1, z) === AIR;
      if (clear(sx, sy, sz)) return position;
      for (let distance = 1; distance <= HEIGHT - sy; distance++) {
        for (let dy = -distance; dy <= distance; dy++) {
          const y = sy + dy;
          if (y < 1) continue;
          const horizontal = distance - Math.abs(dy);
          for (let dx = -horizontal; dx <= horizontal; dx++) {
            const dz = horizontal - Math.abs(dx);
            for (const z of dz ? [sz - dz, sz + dz] : [sz]) {
              const x = sx + dx;
              if (clear(x, y, z) && blocks[this.get(x, y - 1, z)].solid) {
                return [x + .5, y + .01, z + .5];
              }
            }
          }
        }
      }
      return [sx + .5, HEIGHT + .01, sz + .5];
    }
    let y = HEIGHT - 1;
    while (y > 0 && this.get(x, y, z) === AIR) y--;
    return [x + 0.5, y + 1.01, z + 0.5];
  }
}
