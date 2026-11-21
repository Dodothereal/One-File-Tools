import { AIR, BEDROCK, dimensionBlocks as B } from './blocks.js';
import { hash, noise } from './noise.js';

export function createEnd(seed) {
  const pillars = Array.from({ length: 10 }, (_, i) => {
    const angle = i * Math.PI / 5;
    return { x: Math.round(Math.cos(angle) * 55), z: Math.round(Math.sin(angle) * 55),
      radius: 2 + Math.floor(hash(seed + 3, i, 0) * 3), top: 65 + Math.floor(hash(seed + 5, i, 0) * 24) };
  });

  function terrain(x, z) {
    const distance = Math.hypot(x, z);
    const mask = noise(seed + 7, x / 58, z / 58);
    const strength = distance < 120 ? (90 + (mask - .5) * 20 - distance) / 90 :
      distance > 250 ? (mask - .56) * 2.3 : -1;
    if (strength <= 0) return null;
    const top = Math.floor(43 + noise(seed + 11, x / 27, z / 27) * 7);
    return { top, bottom: Math.max(4, top - Math.floor(3 + Math.min(1, strength) * 30)) };
  }

  function column(x, z, height = 96) {
    const data = new Uint8Array(height), ground = terrain(x, z);
    if (!ground) return data;
    data.fill(B.end_stone, ground.bottom, Math.min(height, ground.top + 1));
    for (const p of pillars) {
      if ((x - p.x) ** 2 + (z - p.z) ** 2 > p.radius ** 2) continue;
      data.fill(B.obsidian, ground.top, Math.min(height, p.top + 1));
      if (x === p.x && z === p.z && p.top + 1 < height) data[p.top + 1] = B.end_crystal;
    }
    const ring = Math.max(Math.abs(x), Math.abs(z));
    if (ring <= 3) {
      data.fill(BEDROCK, ground.top, 50);
      if (ring === 3) data[50] = BEDROCK;
      else if (ring > 0) data[50] = B.end_portal;
      else for (let y = 50; y <= 53; y++) data[y] = BEDROCK;
    }
    if (Math.hypot(x, z) > 250) {
      const cellX = Math.floor(x / 32), cellZ = Math.floor(z / 32);
      const cx = cellX * 32 + 16, cz = cellZ * 32 + 16;
      const base = terrain(cx, cz);
      const dx = Math.abs(x - cx), dz = Math.abs(z - cz);
      if (base && hash(seed + 17, cellX, cellZ) < .16 && dx <= 4 && dz <= 4) {
        const roof = base.top + 23;
        for (let y = ground.top + 1; y <= Math.min(height - 1, roof); y++) {
          if (y === roof || (y - base.top) % 6 === 0) data[y] = B.end_stone_bricks;
          else if (dx === 4 || dz === 4) data[y] = dx === 4 && dz === 4 ? B.purpur_pillar : B.purpur_block;
          else data[y] = AIR;
        }
        if (dx === 3 && dz === 3 && roof + 1 < height) data[roof + 1] = B.end_rod;
      } else {
        // Shared roots in a small grid give branching silhouettes across chunk edges.
        const rx = Math.floor(x / 9) * 9 + 4, rz = Math.floor(z / 9) * 9 + 4;
        const root = terrain(rx, rz);
        if (root && hash(seed + 23, rx, rz) < .45) {
          const top = root.top + 4 + Math.floor(hash(seed + 29, rx, rz) * 4);
          if (x === rx && z === rz) {
            for (let y = ground.top + 1; y < top; y++) data[y] = B.chorus_plant;
            data[top] = B.chorus_flower;
          } else if ((z === rz && Math.abs(x - rx) <= 2) || (x === rx && Math.abs(z - rz) <= 2)) {
            data[top - 2] = B.chorus_plant;
            if (Math.abs(x - rx) === 2 || Math.abs(z - rz) === 2) data[top - 1] = B.chorus_flower;
          }
        }
      }
    }
    return data;
  }

  return {
    spawn(x = 18, z = 0) {
      const ground = terrain(x, z);
      if (!ground || Math.hypot(x, z) > 35 || Math.max(Math.abs(x), Math.abs(z)) <= 4) return [18.5, terrain(18, 0).top + 1.01, .5];
      return [x + .5, ground.top + 1.01, z + .5];
    },
    surface(x, z) {
      const data = column(x, z);
      let y = data.length - 1;
      while (y > 0 && data[y] === AIR) y--;
      return { y, id: data[y], biome: Math.hypot(x, z) < 120 ? 'Main Island' : 'Outer End' };
    },
    generate({ x, z, size, height, set }) {
      for (let dz = 0; dz < size; dz++) for (let dx = 0; dx < size; dx++) {
        const data = column(x + dx, z + dz, height);
        for (let y = 0; y < height; y++) if (data[y] !== AIR) set(dx, y, dz, data[y]);
      }
    },
  };
}
