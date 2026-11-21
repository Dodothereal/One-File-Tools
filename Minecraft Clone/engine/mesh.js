import { AIR, blocks, faceTile } from '../world/blocks.js';
import { SIZE, HEIGHT, indexOf } from '../world/world.js';

const faces = [
  [[1, 0, 0], [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], 0.82],
  [[-1, 0, 0], [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], 0.74],
  [[0, 1, 0], [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], 1],
  [[0, -1, 0], [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], 0.58],
  [[0, 0, 1], [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], 0.91],
  [[0, 0, -1], [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], 0.68],
];
const uv = [[0,1],[1,1],[1,0],[0,0]];
const triangles = [0, 1, 2, 0, 2, 3];

function face(out, id, f, x, y, z, step = 1, tall = 1, lower = 0) {
  const [, corners, shade] = faces[f];
  const tile = faceTile(id, f);
  for (const i of triangles) {
    const [dx, dy, dz] = corners[i];
    out.push(x + dx * step, y + dy * tall - lower, z + dz * step,
      uv[i][0], uv[i][1], tile, shade);
  }
}

function finish(opaque, liquid) {
  return { opaque: new Float32Array(opaque), liquid: new Float32Array(liquid) };
}

export function meshChunk(data, neighbors) {
  const opaque = [], liquid = [];
  for (let y = 0; y < HEIGHT; y++) for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
    const id = data[indexOf(x, y, z)];
    if (id === AIR) continue;
    const fluid = blocks[id].liquid;
    for (let f = 0; f < faces.length; f++) {
      if (f === 3 && y === 0) continue;
      const [dx, dy, dz] = faces[f][0];
      const nx = x + dx, ny = y + dy, nz = z + dz;
      let other = AIR;
      if (nx === SIZE) other = neighbors[0][indexOf(0, y, z)];
      else if (nx === -1) other = neighbors[1][indexOf(SIZE - 1, y, z)];
      else if (nz === SIZE) other = neighbors[2][indexOf(x, y, 0)];
      else if (nz === -1) other = neighbors[3][indexOf(x, y, SIZE - 1)];
      else if (ny >= 0 && ny < HEIGHT) other = data[indexOf(nx, ny, nz)];
      if (other === AIR || (!fluid && blocks[other].liquid)) {
        face(fluid ? liquid : opaque, id, f, x, y, z);
      }
    }
  }
  return finish(opaque, liquid);
}

export function meshTerrain(surface, x, z, step) {
  const opaque = [], liquid = [];
  const span = SIZE + 2, grid = [];
  for (let j = -1; j <= SIZE; j++) for (let i = -1; i <= SIZE; i++) {
    grid.push(surface(x + i * step + (step >> 1), z + j * step + (step >> 1)));
  }
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
    const index = (j + 1) * span + (i + 1);
    const { y, id } = grid[index];
    if (id === AIR) continue;
    const out = blocks[id].liquid ? liquid : opaque;
    face(out, id, 2, i * step, y, j * step, step);
    for (const [f, offset, edge] of [[0,1,i === SIZE-1],[1,-1,i === 0],[4,span,j === SIZE-1],[5,-span,j === 0]]) {
      const lower = edge ? Math.max(step * 2, y - grid[index + offset].y) : y - grid[index + offset].y;
      if (lower > 0) face(out, id, f, i * step, y, j * step, step, lower, lower - 1);
    }
  }
  return finish(opaque, liquid);
}

export function meshBoxes(boxes) {
  const opaque = [];
  for (const { origin, size, id } of boxes) {
    const [x, y, z] = origin;
    for (let f = 0; f < faces.length; f++) {
      const [, corners, shade] = faces[f];
      for (const i of triangles) {
        const [dx, dy, dz] = corners[i];
        opaque.push(x + dx * size[0], y + dy * size[1], z + dz * size[2],
          uv[i][0], uv[i][1], faceTile(id, f), shade);
      }
    }
  }
  return finish(opaque, []);
}
