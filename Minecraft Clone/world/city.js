import { AIR, BEDROCK, STONE, DIRT, GRASS, LOG, LEAVES, dimensionBlocks as B } from './blocks.js';
import { hash } from './noise.js';

export const CITY_GRID = 49;
export const STREET_Y = 12;
const mod = n => ((n % CITY_GRID) + CITY_GRID) % CITY_GRID;

export function createCity(seed) {
  function column(x, z, height = 96) {
    const data = new Uint8Array(height);
    data.fill(STONE, 1, STREET_Y - 2);
    data.fill(DIRT, STREET_Y - 2, STREET_Y);
    data[0] = BEDROCK;
    const lx = Math.floor(x / CITY_GRID), lz = Math.floor(z / CITY_GRID);
    const u = mod(x), v = mod(z), choice = hash(seed, lx, lz);
    const roadX = u < 9, roadZ = v < 9;
    const sidewalk = u < 12 || v < 12 || u >= 46 || v >= 46;
    data[STREET_Y] = roadX || roadZ ? B.asphalt : sidewalk ? B.sidewalk : B.concrete_gray;
    if (roadX || roadZ) {
      if ((roadX && u === 4 && ((z % 8) + 8) % 8 < 5) || (roadZ && v === 4 && ((x % 8) + 8) % 8 < 5)) data[STREET_Y] = B.asphalt_lane;
      if ((roadX && (v === 1 || v === 7) && u % 2 === 0) || (roadZ && (u === 1 || u === 7) && v % 2 === 0)) data[STREET_Y] = B.concrete_white;
      return data;
    }
    if (u === 9 || v === 9 || u === 48 || v === 48) data[STREET_Y] = B.curb;
    if ((u === 10 && v % 12 === 4) || (v === 10 && u % 12 === 4)) {
      data.fill(B.steel_beam, STREET_Y + 1, STREET_Y + 6);
      data[STREET_Y + 6] = B.street_lamp;
    }
    if (sidewalk) return data;
    if (choice < .18) {
      data[STREET_Y] = u % 8 === 0 || v % 8 === 0 ? B.sidewalk : GRASS;
      if ((u === 13 || u === 44 || v === 13 || v === 44) && u !== 28 && v !== 28) data[STREET_Y + 1] = B.hedge;
      for (const tx of [20, 36]) for (const tz of [20, 36]) {
        const dx = Math.abs(u - tx), dz = Math.abs(v - tz);
        if (dx <= 2 && dz <= 2) data.fill(LEAVES, STREET_Y + 4, STREET_Y + 7);
        if (dx === 0 && dz === 0) data.fill(LOG, STREET_Y + 1, STREET_Y + 5);
      }
      return data;
    }
    if (choice < .28) {
      data[STREET_Y] = (u + v) % 6 === 0 ? B.concrete_white : B.sidewalk;
      if ((u === 20 || u === 38) && (v === 20 || v === 38)) {
        data.fill(B.purpur_pillar, STREET_Y + 1, STREET_Y + 4);
        data[STREET_Y + 4] = B.neon_cyan;
      }
      return data;
    }
    const tall = choice > .52;
    const roof = tall ? 62 + Math.floor(hash(seed + 7, lx, lz) * 24) : 30 + Math.floor(hash(seed + 7, lx, lz) * 20);
    const concrete = [B.concrete_gray, B.concrete_white, B.concrete_red, B.concrete_blue][Math.floor(choice * 13) % 4];
    for (let y = STREET_Y + 1; y <= roof; y++) {
      const inset = tall ? (y > 72 ? 4 : y > 56 ? 2 : 0) : 0;
      const low = 15 + inset, high = 42 - inset;
      if (u < low || v < low || u > high || v > high) continue;
      const edge = u === low || v === low || u === high || v === high;
      const slab = (y - STREET_Y) % 4 === 0;
      const terrace = tall && (y === 56 || y === 72);
      if (y === roof || slab || terrace) data[y] = concrete;
      else if (edge) {
        const frame = (u - low) % 7 === 0 && (v === low || v === high) || (v - low) % 7 === 0 && (u === low || u === high);
        data[y] = frame ? B.steel_beam : tall ? (hash(seed + 13, x, z, Math.floor(y / 4)) > .62 ? B.lit_window : B.glass_window) : choice > .4 ? B.office_facade : B.brick_facade;
        if (v === low && u >= 27 && u <= 29 && y <= STREET_Y + 3) data[y] = AIR;
        if (v === low && y >= STREET_Y + 5 && y <= STREET_Y + 7 && u >= 20 && u <= 25) {
          data[y] = choice > .65 ? B.billboard : [B.neon_cyan, B.neon_pink, B.neon_green, B.neon_orange][Math.floor(choice * 19) % 4];
        }
      }
    }
    const inset = tall ? (roof > 72 ? 4 : 2) : 0;
    if (u >= 15 + inset && u <= 42 - inset && v >= 15 + inset && v <= 42 - inset) {
      if (u >= 24 && u <= 32 && v >= 24 && v <= 32 && tall && choice > .75) data[roof] = B.helipad;
      if (u >= 18 + inset && u <= 20 + inset && v >= 18 + inset && v <= 20 + inset) data[roof + 1] = B.rooftop_vent;
      if (u === 37 - inset && v === 37 - inset) {
        data.fill(B.steel_beam, roof + 1, Math.min(height, roof + 7));
        if (roof + 7 < height) data[roof + 7] = B.neon_orange;
      }
    }
    return data;
  }

  return {
    spawn() { return [10.5, STREET_Y + 1.01, 12.5]; },
    surface(x, z) {
      const data = column(x, z);
      let y = data.length - 1;
      while (y > 0 && data[y] === AIR) y--;
      return { y, id: data[y], biome: 'Metropolis' };
    },
    generate({ x, z, size, height, set }) {
      for (let dz = 0; dz < size; dz++) for (let dx = 0; dx < size; dx++) {
        const data = column(x + dx, z + dz, height);
        for (let y = 0; y < height; y++) if (data[y] !== AIR) set(dx, y, dz, data[y]);
      }
    },
  };
}
