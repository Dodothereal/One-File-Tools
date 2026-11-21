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

function face(out, id, f, x, y, z, step = 1, tall = 1, lower = 0, lighting = null) {
  const [, corners, shade] = faces[f];
  const tile = faceTile(id, f);
  for (const i of triangles) {
    const [dx, dy, dz] = corners[i];
    out.push(x + dx * step, y + dy * tall - lower, z + dz * step,
      uv[i][0], uv[i][1], tile, shade * (lighting?.[i] ?? 1));
  }
}

function finish(opaque, liquid) {
  return { opaque: new Float32Array(opaque), liquid: new Float32Array(liquid) };
}

export function meshChunk(data, neighbors, ao = false) {
  const opaque = [], liquid = [];
  const sample = (x, y, z) => {
    if (y < 0 || y >= HEIGHT || (x < 0 || x >= SIZE) && (z < 0 || z >= SIZE)) return false;
    const source = x >= SIZE ? neighbors[0] : x < 0 ? neighbors[1] : z >= SIZE ? neighbors[2] : z < 0 ? neighbors[3] : data;
    const id = source[indexOf((x + SIZE) % SIZE, y, (z + SIZE) % SIZE)];
    return blocks[id].solid && !blocks[id].liquid;
  };
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
        let lighting = null;
        if (ao && !fluid) {
          const axes = [0,1,2].filter(axis => faces[f][0][axis] === 0);
          lighting = faces[f][1].map(corner => {
            const base = [nx,ny,nz];
            const a = [...base], b = [...base], diagonal = [...base];
            for (const axis of axes) diagonal[axis] += corner[axis] ? 1 : -1;
            a[axes[0]] = diagonal[axes[0]];
            b[axes[1]] = diagonal[axes[1]];
            const sideA = Number(sample(...a)), sideB = Number(sample(...b));
            const occlusion = sideA && sideB ? 3 : sideA + sideB + Number(sample(...diagonal));
            return 1 - occlusion * .17;
          });
        }
        face(fluid ? liquid : opaque, id, f, x, y, z, 1, 1, 0, lighting);
      }
    }
  }
  return finish(opaque, liquid);
}

export function meshTerrain(surface, x, z, step) {
  const opaque = [], liquid = [];
  const reduction = Math.min(step, 4);
  const cells = SIZE / reduction, spacing = step * reduction;
  const span = cells + 2, grid = [];
  for (let j = -1; j <= cells; j++) for (let i = -1; i <= cells; i++) {
    grid.push(surface(x + i * spacing + spacing / 2, z + j * spacing + spacing / 2));
  }
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const index = (j + 1) * span + (i + 1);
    const { y, id } = grid[index];
    if (id === AIR) continue;
    const out = blocks[id].liquid ? liquid : opaque;
    face(out, id, 2, i * spacing, y, j * spacing, spacing);
    for (const [f, offset, edge] of [[0,1,i === cells-1],[1,-1,i === 0],[4,span,j === cells-1],[5,-span,j === 0]]) {
      const lower = edge ? Math.max(spacing * 2, y - grid[index + offset].y) : y - grid[index + offset].y;
      if (lower > 0) face(out, id, f, i * spacing, y, j * spacing, spacing, lower, lower - 1);
    }
  }
  return finish(opaque, liquid);
}

export function meshBoxes(boxes) {
  const opaque = [];
  for (const { origin, size, id, tile, glow = false } of boxes) {
    const [x, y, z] = origin;
    for (let f = 0; f < faces.length; f++) {
      const [, corners, shade] = faces[f];
      for (const i of triangles) {
        const [dx, dy, dz] = corners[i];
        opaque.push(x + dx * size[0], y + dy * size[1], z + dz * size[2],
          uv[i][0], uv[i][1], tile ?? faceTile(id, f), glow ? 2 : shade);
      }
    }
  }
  return finish(opaque, []);
}
