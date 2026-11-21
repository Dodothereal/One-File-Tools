import { AIR, blocks, dimensionBlocks as B } from './blocks.js';

const portalIds = { nether: B.nether_portal, end: B.end_portal, city: B.city_portal };

export function portalTarget(block, current) {
  const target = Object.keys(portalIds).find(key => portalIds[key] === block);
  return target ? current === target ? 'overworld' : target : null;
}

export function portalShape(kind, x, y, z, axis = 'x', approach = true) {
  if (!portalIds[kind]) return [];
  const result = [];
  const put = (u, v, depth, id) => result.push([x + (axis === 'x' ? u : depth), y + v, z + (axis === 'x' ? depth : u), id]);
  const width = kind === 'nether' ? 4 : 5;
  const tall = kind === 'end' ? 1 : kind === 'nether' ? 5 : 6;
  // A clear, solid approach on either side makes naturally generated gates usable.
  if (approach) for (let u = -2; u <= width + 1; u++) for (let d = -2; d <= (kind === 'end' ? 6 : 2); d++) {
    put(u, 0, d, kind === 'nether' ? B.obsidian : kind === 'end' ? B.end_portal_frame : B.metal_panel);
    for (let v = 1; v <= Math.max(4, tall); v++) put(u, v, d, AIR);
  }
  if (kind === 'end') {
    for (let u = 0; u < 5; u++) for (let d = 0; d < 5; d++) {
      put(u, 0, d, u === 0 || d === 0 || u === 4 || d === 4 ? B.end_portal_frame : B.end_portal);
    }
  } else {
    for (let u = 0; u < width; u++) for (let v = 0; v < tall; v++) {
      const edge = u === 0 || u === width - 1 || v === 0 || v === tall - 1;
      put(u, v, 0, edge ? kind === 'nether' ? B.obsidian : v === tall - 1 ? B.neon_cyan : B.steel_beam : portalIds[kind]);
    }
  }
  return result;
}

export function withPortals(generator, dimension) {
  const columns = new Map();
  function add(kind, x, z, y, axis = 'x') {
    const edits = portalShape(kind, x, y, z, axis);
    const touched = new Set();
    for (const [wx, wy, wz, id] of edits) {
      const key = `${wx},${wz}`;
      touched.add(key);
      if (!columns.has(key)) columns.set(key, new Map());
      columns.get(key).set(wy, id);
    }
    if (dimension === 'overworld') for (const key of touched) {
      const edits = columns.get(key);
      for (let h = y + (kind === 'end' ? 1 : kind === 'nether' ? 5 : 6); h < 96; h++) edits.set(h, AIR);
    }
    if (dimension === 'overworld' || dimension === 'end') {
      const start = kind === 'end' ? 7 : 3;
      for (let step = 1; step <= 4; step++) for (let u = 1; u <= (kind === 'nether' ? 2 : 3); u++) {
        const wx = x + (axis === 'x' ? u : start + step - 1);
        const wz = z + (axis === 'x' ? start + step - 1 : u);
        const ground = generator.surface(wx, wz).y;
        const level = Math.max(ground, y - step);
        if (ground >= y) continue;
        const key = `${wx},${wz}`;
        if (!columns.has(key)) columns.set(key, new Map());
        const edits = columns.get(key);
        for (let h = ground; h <= level; h++) edits.set(h, B.sidewalk);
        for (let h = level + 1; h <= (dimension === 'overworld' ? 95 : level + 3); h++) edits.set(h, AIR);
      }
    }
    // Extend foundations to the terrain instead of leaving floating platforms.
    for (const key of touched) {
      const edits = columns.get(key);
      const [wx, wz] = key.split(',').map(Number);
      if (!edits.has(y)) continue;
      const ground = generator.surface?.(wx, wz)?.y ?? y;
      for (let h = ground + 1; h < y; h++) edits.set(h, B.obsidian);
    }
  }
  function ground(x, z, width = 5, depth = 3) {
    let y = 0;
    for (let a = -1; a <= width; a++) for (let b = -1; b <= depth; b++) {
      y = Math.max(y, generator.surface(x + a, z + b).y);
    }
    return Math.min(86, y);
  }
  if (dimension === 'overworld') {
    for (let x = 4; x <= 32; x++) for (let z = -12; z <= 3; z++) {
      const y = generator.surface(x, z).y;
      const edits = new Map([[y, B.sidewalk]]);
      for (let h = y + 1; h < 96; h++) edits.set(h, AIR);
      columns.set(`${x},${z}`, edits);
    }
    add('nether', 6, -7, ground(6, -7));
    add('end', 16, -10, ground(16, -10, 5, 5));
    add('city', 26, -7, ground(26, -7));
  } else if (dimension === 'nether') add('nether', -4, 3, 43);
  else if (dimension === 'end') add('end', 23, 0, ground(23, 0, 5, 5));
  else if (dimension === 'city') add('city', 10, 19, 12, 'z');
  return {
    ...generator,
    generate(options) {
      generator.generate(options);
      for (let z = 0; z < options.size; z++) for (let x = 0; x < options.size; x++) {
        const edits = columns.get(`${options.x + x},${options.z + z}`);
        if (edits) for (const [y, id] of edits) options.set(x, y, z, id);
      }
    },
    surface: generator.surface ? (x, z) => {
      const surface = generator.surface(x, z), edits = columns.get(`${x},${z}`);
      if (!edits) return surface;
      let y = Math.max(surface.y, ...edits.keys());
      while (y > 0 && (edits.get(y) ?? (y <= surface.y ? surface.id : AIR)) === AIR) y--;
      return { ...surface, y, id: edits.get(y) ?? surface.id };
    } : undefined,
  };
}

function enclosedNetherFrame(world, point, minU, maxU, minY, maxY, area) {
  const width = maxU - minU + 1, height = maxY - minY + 1;
  if (width < 2 || width > 21 || height < 3 || height > 21 || minY < 1 || maxY > 94 || area !== width * height) return false;
  for (let u = minU - 1; u <= maxU + 1; u++) {
    if (world.get(...point(u, minY - 1)) !== B.obsidian || world.get(...point(u, maxY + 1)) !== B.obsidian) return false;
  }
  for (let y = minY; y <= maxY; y++) {
    if (world.get(...point(minU - 1, y)) !== B.obsidian || world.get(...point(maxU + 1, y)) !== B.obsidian) return false;
  }
  return true;
}

export function lightNetherFrame(world, placed) {
  return lightFromEdit(world, placed);
}

export function lightNetherFrames(world, edits) {
  if (edits.length === 1) return lightNetherFrame(world, edits[0]);
  const scanned = new Map();
  for (const edit of edits) lightFromEdit(world, edit, scanned);
}

function lightFromEdit(world, placed, scanned) {
  const changed = world.get(...placed);
  if (changed !== B.obsidian && changed !== AIR && !(scanned && changed === B.nether_portal)) return false;
  const reach = scanned && changed !== B.obsidian ? 0 : 1;
  for (const axis of ['x', 'z']) for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) {
    const plane = `${axis}:${placed[axis === 'x' ? 2 : 0]}`;
    if (scanned && !scanned.has(plane)) scanned.set(plane, new Set());
    const checked = scanned?.get(plane);
    const point = (u, y) => axis === 'x' ? [u, y, placed[2]] : [placed[0], y, u];
    const startU = placed[axis === 'x' ? 0 : 2] + a, startY = placed[1] + b;
    if (checked?.has(`${startU},${startY}`)) continue;
    const pending = [[startU, startY]], visited = new Map();
    let minU = startU, maxU = startU, minY = startY, maxY = startY, valid = true;
    while (pending.length && valid) {
      const [u, y] = pending.pop(), key = `${u},${y}`;
      if (visited.has(key)) continue;
      if (checked?.has(key)) { valid = false; break; }
      const id = world.get(...point(u, y));
      if (id === B.obsidian) continue;
      if ((id !== AIR && id !== B.nether_portal) || y < 1 || y > 94) { valid = false; break; }
      visited.set(key, [u, y]);
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      if (maxU - minU >= 21 || maxY - minY >= 21) { valid = false; break; }
      pending.push([u + 1, y], [u - 1, y], [u, y + 1], [u, y - 1]);
    }
    if (checked) for (const key of visited.keys()) checked.add(key);
    if (valid && enclosedNetherFrame(world, point, minU, maxU, minY, maxY, visited.size)) {
      for (const [u, y] of visited.values()) world.set(...point(u, y), B.nether_portal, false);
      removeNetherPortal(world, placed);
      if (!scanned) return true;
    }
  }
  return false;
}

export function removeNetherPortal(world, changed) {
  const planes = new Map(), candidates = new Map();
  function scanPlane(start, axis) {
    const key = `${axis}:${start}`;
    if (planes.has(key)) return planes.get(key);
    const point = (u, y) => axis === 'x' ? [u, y, start[2]] : [start[0], y, u];
    const pending = [[start[axis === 'x' ? 0 : 2], start[1]]], visited = new Set(), region = [];
    let minU = Infinity, maxU = -Infinity, minY = Infinity, maxY = -Infinity;
    while (pending.length) {
      const [u, y] = pending.pop(), key = `${u},${y}`;
      if (visited.has(key) || world.get(...point(u, y)) !== B.nether_portal) continue;
      visited.add(key);
      region.push(point(u, y));
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      pending.push([u + 1, y], [u - 1, y], [u, y + 1], [u, y - 1]);
    }
    const result = { region, valid: enclosedNetherFrame(world, point, minU, maxU, minY, maxY, region.length) };
    for (const p of region) planes.set(`${axis}:${p}`, result);
    return result;
  }
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const start = [changed[0] + dx, changed[1] + dy, changed[2] + dz];
    if (world.get(...start) !== B.nether_portal) continue;
    for (const axis of ['x', 'z']) for (const p of scanPlane(start, axis).region) candidates.set(`${p}`, p);
  }
  const invalid = [...candidates.values()].filter(p => !scanPlane(p, 'x').valid && !scanPlane(p, 'z').valid);
  for (const p of invalid) world.set(...p, AIR, false);
}

export function updatePortalTravel(game, dt, dimensions) {
  const state = game.portalState ??= { cooldown: 0, contact: null, elapsed: 0 };
  state.cooldown = Math.max(0, state.cooldown - dt);
  const [px, py, pz] = game.player.position;
  let contact = null;
  if (!game.player.vehicle) for (let x = Math.floor(px - .3); x <= Math.floor(px + .3 - 1e-6); x++) {
    for (let z = Math.floor(pz - .3); z <= Math.floor(pz + .3 - 1e-6); z++) {
      for (let y = Math.floor(py); y <= Math.floor(py + 1.79 - 1e-6); y++) {
        const id = game.world.get(x, y, z);
        if (portalTarget(id, game.world.dimension.id)) contact = id;
      }
    }
  }
  if (contact !== state.contact || !contact || state.cooldown) state.elapsed = 0;
  state.contact = contact;
  if (!contact || state.cooldown) return;
  state.elapsed += dt;
  if (contact !== B.end_portal && state.elapsed < 1) return;
  const target = dimensions.get(portalTarget(contact, game.world.dimension.id));
  if (!target?.create) return;
  game.enterDimension(target);
  state.cooldown = 3;
  state.elapsed = 0;
  state.contact = null;
}

export function buildPortal(game, kind) {
  if (!portalIds[kind]) return 'Usage: /portal <nether|end|city>';
  const { player, world } = game;
  const alongX = Math.abs(Math.sin(player.yaw)) > Math.abs(Math.cos(player.yaw));
  const fx = alongX ? Math.sign(Math.sin(player.yaw)) : 0;
  const fz = alongX ? 0 : Math.sign(Math.cos(player.yaw));
  const x = Math.floor(player.position[0]) + fx * 5 - (alongX ? 0 : 1);
  const z = Math.floor(player.position[2]) + fz * 5 - (alongX ? 1 : 0);
  const y = Math.floor(player.position[1]) - 1;
  if (y < 1 || y > 88) return 'Stand between y=2 and y=89 to build a portal.';
  const shape = portalShape(kind, x, y, z, alongX ? 'z' : 'x', false);
  if (shape.some(([wx, wy, wz, id]) => world.get(wx, wy, wz) !== id && blocks[world.get(wx, wy, wz)].unbreakable)) {
    return 'Cannot build a portal over unbreakable blocks.';
  }
  const clearance = shape.filter(([, wy]) => wy > y);
  for (const [wx, wy, wz, id] of shape) {
    if (id !== portalIds[kind]) continue;
    if (kind === 'end') {
      clearance.push([wx, wy + 1, wz, AIR], [wx, wy + 2, wz, AIR]);
    } else if (wy <= y + 2) {
      clearance.push([wx + fx, wy, wz + fz, AIR], [wx - fx, wy, wz - fz, AIR]);
    }
  }
  if (clearance.some(([wx, wy, wz, id]) => world.get(wx, wy, wz) !== AIR && world.get(wx, wy, wz) !== id)) {
    return 'Cannot build a portal here: opening or approach is obstructed. Find open ground or clear it first.';
  }
  for (const [wx, wy, wz, id] of shape) world.set(wx, wy, wz, id, false);
  for (const [wx, wy, wz] of shape) removeNetherPortal(world, [wx, wy, wz]);
  return `Built ${kind} portal. Step inside to travel.`;
}
