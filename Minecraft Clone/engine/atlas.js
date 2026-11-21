import { tiles } from '../world/blocks.js';
import { hash } from '../world/noise.js';

export const TILE = 16;
export const COLS = 16;

export function createAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE;
  canvas.height = Math.ceil(tiles.length / COLS) * TILE;
  const ctx = canvas.getContext('2d');
  tiles.forEach(({ colors, pattern }, index) => {
    const ox = index % COLS * TILE, oy = Math.floor(index / COLS) * TILE;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const random = hash(index * 917 + 7, x, y);
      let color = colors[Math.floor(random * colors.length)];
      if (pattern === 'speckle' || pattern === 'ore') {
        color = colors[hash(index, x >> 1, y >> 1) > (pattern === 'ore' ? .72 : .48) ? 1 : random > .6 ? 2 : 0];
      } else if (pattern === 'cracked') {
        color = colors[(x + Math.floor(3 * Math.sin(y * .8))) % 7 === 0 || y % 7 === 0 ? 1 : random > .65 ? 2 : 0];
      } else if (pattern === 'window') {
        color = colors[x % 8 === 0 || y % 8 === 0 ? 2 : x % 8 === 1 ? 3 : random > .85 ? 1 : 0];
      } else if (pattern === 'panel') {
        color = colors[x === 0 || y === 0 ? 2 : x === 15 || y === 15 ? 1 : random > .8 ? 3 : 0];
      } else if (pattern === 'stripes') {
        color = colors[x % 4 === 0 ? 2 : x % 4 === 1 ? 1 : 0];
      } else if (pattern === 'neon') {
        color = colors[x > 4 && x < 11 || y > 5 && y < 10 ? (x === 7 || y === 7 ? 3 : 1) : 0];
      } else if (pattern === 'swirl' || pattern === 'stars') {
        const spiral = Math.sin(Math.hypot(x - 7.5, y - 7.5) * 1.7 - Math.atan2(y - 7.5, x - 7.5) * 3);
        color = pattern === 'stars' ? colors[random > .97 ? 1 : spiral > .8 ? 3 : 0] : colors[spiral > .7 ? 1 : spiral < -.4 ? 2 : 3];
      } else if (pattern === 'lane') {
        color = colors[(x === 4 || x === 5) && y < 11 ? 1 : x === 12 && y < 11 ? 3 : 0];
      } else if (pattern === 'helipad') {
        color = colors[((x === 4 || x === 11) && y > 2 && y < 13) || (y === 7 && x > 4 && x < 11) ? 1 : 0];
      } else if (pattern === 'billboard') {
        color = colors[x < 2 || y < 2 || x > 13 || y > 13 ? 2 : y > 5 && y < 10 ? (x % 3 ? 1 : 3) : 0];
      } else if (pattern === 'grass' && y < 3 + Math.floor(hash(3, x, 0) * 4)) {
        color = tiles[0].colors[Math.floor(random * 4)];
      } else if (pattern === 'bark') {
        color = colors[(x * 3 + Math.floor(random * 2)) % colors.length];
      } else if (pattern === 'rings') {
        color = colors[Math.floor(Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5))) % colors.length];
      } else if (pattern === 'brick' && (y % 5 === 0 || (x + 4 * Math.floor(y / 5)) % 8 === 0)) {
        color = colors[2];
      } else if (pattern === 'water') {
        color = random < 0.2 && y % 3 === 0 ? colors[1] : colors[random < 0.6 ? 0 : 3];
      }
      ctx.fillStyle = color;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  });
  return canvas;
}
