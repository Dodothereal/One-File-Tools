import { AIR, GRASS, DIRT, STONE, SAND, LOG, LEAVES, WATER, BEDROCK, SNOW } from './blocks.js';
import { hash, noise } from './noise.js';

const SEA = 30;

export function createOverworld(seed) {
  function column(x, z) {
    const continental = noise(seed, x / 100, z / 100);
    const hills = noise(seed + 13, x / 35, z / 35);
    const detail = noise(seed + 29, x / 12, z / 12);
    const climate = noise(seed + 41, x / 145, z / 145);
    const y = Math.floor(15 + continental * 30 + hills * 15 + detail * 5
      + Math.max(0, continental - 0.65) * 60);
    const id = y <= SEA + 1 || climate > 0.72 ? SAND : y >= 62 ? SNOW : GRASS;
    return { y, id, biome: y < SEA ? 'Coast' : id === SNOW ? 'Highlands' : id === SAND ? 'Dunes' : climate < 0.52 ? 'Woodland' : 'Meadow' };
  }

  function tree(x, z, ground) {
    if (ground.id !== GRASS || ground.y <= SEA + 2 ||
      hash(seed + 5, x, z) > (ground.biome === 'Woodland' ? 0.018 : 0.004)) return 0;
    return 4 + Math.floor(hash(seed + 19, x, z) * 3);
  }

  return {
    surface(x, z) {
      const ground = column(x, z);
      return ground.y < SEA ? { ...ground, y: SEA, id: WATER } : ground;
    },
    generate({ x, z, size, height, set }) {
      for (let dz = 0; dz < size; dz++) for (let dx = 0; dx < size; dx++) {
        const wx = x + dx, wz = z + dz;
        const ground = column(wx, wz);
        set(dx, 0, dz, BEDROCK);
        for (let y = 1; y <= Math.min(height - 1, Math.max(SEA, ground.y)); y++) {
          let id = y > ground.y ? WATER : y === ground.y ? ground.id :
            y >= ground.y - 3 ? ground.id === SAND ? SAND : DIRT : STONE;
          if (id === STONE && y > 3 && y < ground.y - 5 &&
              noise(seed + 47, wx / 16, wz / 16, y / 10) > 0.66 &&
              noise(seed + 61, wx / 24, wz / 24, y / 15) > 0.39) id = AIR;
          if (id !== AIR) set(dx, y, dz, id);
        }
      }
      // Include roots outside the chunk so canopy edges agree across chunks.
      for (let dz = -2; dz < size + 2; dz++) for (let dx = -2; dx < size + 2; dx++) {
        const ground = column(x + dx, z + dz);
        const trunk = tree(x + dx, z + dz, ground);
        if (!trunk) continue;
        const top = ground.y + trunk;
        for (let dy = -2; dy <= 1; dy++) {
          const radius = dy >= 0 ? 1 : 2;
          for (let a = -radius; a <= radius; a++) for (let b = -radius; b <= radius; b++) {
            if (Math.abs(a) + Math.abs(b) >= 2 * radius && dy !== 0) continue;
            const lx = dx + a, lz = dz + b;
            if (top + dy > column(x + lx, z + lz).y) set(lx, top + dy, lz, LEAVES, AIR);
          }
        }
        for (let y = ground.y + 1; y <= top; y++) set(dx, y, dz, LOG);
      }
    },
  };
}
