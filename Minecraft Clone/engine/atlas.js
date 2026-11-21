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
      if (pattern === 'grass' && y < 3 + Math.floor(hash(3, x, 0) * 4)) {
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
