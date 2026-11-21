import { AIR, BEDROCK, dimensionBlocks as B } from './blocks.js';
import { hash, noise } from './noise.js';

export const LAVA_LEVEL = 29;

export function createNether(seed) {
  function column(x, z) {
    const climate = noise(seed + 83, x / 75, z / 75);
    const biome = climate < .34 ? 'Soul Sand Valley' : climate < .46 ? 'Basalt Deltas' :
      climate < .60 ? 'Crimson Forest' : climate < .73 ? 'Warped Forest' : 'Nether Wastes';
    const y = Math.floor(20 + noise(seed + 11, x / 47, z / 47) * 27 + noise(seed + 17, x / 13, z / 13) * 6);
    const id = biome === 'Soul Sand Valley' ? B.soul_sand : biome === 'Basalt Deltas' ? B.basalt :
      biome === 'Crimson Forest' ? B.crimson_nylium : biome === 'Warped Forest' ? B.warped_nylium : B.netherrack;
    return { y, id, biome };
  }

  function material(x, y, z, height, ground) {
    const random = hash(seed, x, z, y);
    if (y === 0 || y === height - 1 || y === 1 && random > .35 ||
        y >= height - 3 && random > (y === height - 2 ? .15 : .6)) return BEDROCK;
    const sanctuary = Math.abs(x) <= 5 && Math.abs(z) <= 5;
    if (sanctuary && y >= 43 && y <= 51) return y === 43 ? B.nether_bricks : AIR;
    const ceiling = height - 14 + Math.floor(noise(seed + 29, x / 18, z / 18) * 6);
    const density = noise(seed + 31, x / 19, z / 19, y / 13);
    const solid = y <= ground.y ? y < 5 || y > ground.y - 3 || density < .65 :
      y >= ceiling || y > ground.y + 8 && density > .67;
    if (!solid) return y <= LAVA_LEVEL ? B.lava : AIR;
    if (y <= LAVA_LEVEL + 2 && y >= ground.y - 1 && random > .68) return B.magma;
    if (y === ground.y) return ground.id;
    if (ground.biome === 'Basalt Deltas' && y < ground.y) return B.basalt;
    return random > .973 ? B.nether_quartz_ore : B.netherrack;
  }

  function fungus(x, z, ground) {
    return ground.y > LAVA_LEVEL + 2 && (ground.id === B.crimson_nylium || ground.id === B.warped_nylium) &&
      hash(seed + 101, x, z) < .012 ? 5 + Math.floor(hash(seed + 103, x, z) * 5) : 0;
  }

  return {
    spawn(x = 0, z = 0) {
      if (Math.abs(x) <= 4 && Math.abs(z) <= 4) return [x + .5, 44.01, z + .5];
    },
    surface(x, z) {
      const ground = column(x, z);
      return ground.y < LAVA_LEVEL ? { ...ground, y: LAVA_LEVEL, id: B.lava } : ground;
    },
    generate({ x, z, size, height, set }) {
      for (let dz = 0; dz < size; dz++) for (let dx = 0; dx < size; dx++) {
        const wx = x + dx, wz = z + dz, ground = column(wx, wz);
        for (let y = 0; y < height; y++) {
          const id = material(wx, y, wz, height, ground);
          if (id !== AIR) set(dx, y, dz, id);
        }
        // Ceiling pendants are rooted in the same noisy roof as the cave volume.
        const ceiling = height - 14 + Math.floor(noise(seed + 29, wx / 18, wz / 18) * 6);
        if (noise(seed + 113, wx / 4, wz / 4) > .69) {
          const length = 1 + Math.floor(hash(seed + 127, wx, wz) * 5);
          for (let y = ceiling - length; y < ceiling; y++) set(dx, y, dz, B.glowstone, AIR);
        }
        // Sparse, world-aligned bridge spans with piers and low parapets.
        const lane = ((wz % 192) + 192) % 192;
        const span = ((wx % 160) + 160) % 160;
        if (lane < 5 && span >= 32 && span < 112) {
          for (let y = 49; y <= 50; y++) set(dx, y, dz, B.nether_bricks);
          if (lane === 0 || lane === 4) set(dx, 51, dz, B.nether_bricks);
          if (span % 16 < 2 && (lane === 0 || lane === 4)) {
            for (let y = ground.y + 1; y < 49; y++) set(dx, y, dz, B.nether_bricks);
          }
          for (let y = 52; y < 55; y++) set(dx, y, dz, AIR);
        }
      }
      // Evaluate roots beyond the chunk boundary so fungus canopies are seamless.
      for (let dz = -3; dz < size + 3; dz++) for (let dx = -3; dx < size + 3; dx++) {
        const wx = x + dx, wz = z + dz;
        if (Math.abs(wx) < 10 && Math.abs(wz) < 10) continue;
        const ground = column(wx, wz), trunk = fungus(wx, wz, ground);
        if (!trunk) continue;
        const warped = ground.id === B.warped_nylium;
        const top = ground.y + trunk;
        for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
          if (Math.abs(a) + Math.abs(b) > 4) continue;
          for (let y = top - 1; y <= top + 1; y++) {
            const id = y === top - 1 && hash(seed + 139, wx + a, wz + b) > .85 ? B.shroomlight :
              warped ? B.warped_wart_block : B.nether_wart_block;
            set(dx + a, y, dz + b, id, AIR);
          }
        }
        for (let y = ground.y + 1; y < top; y++) set(dx, y, dz, warped ? B.warped_stem : B.crimson_stem, AIR);
      }
    },
  };
}
