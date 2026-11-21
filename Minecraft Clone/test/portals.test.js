import test from 'node:test';
import assert from 'node:assert/strict';
import { AIR, STONE, BEDROCK, dimensionBlocks as B } from '../world/blocks.js';
import { World } from '../world/world.js';
import { dimensions } from '../world/dimensions.js';
import { portalTarget, portalShape, lightNetherFrame, removeNetherPortal, updatePortalTravel, buildPortal } from '../world/portals.js';
import { createCommands } from '../commands/builtin.js';
import { registerPortalCommands } from '../commands/portals.js';
import { Player } from '../entities/player.js';

function emptyWorld() {
  return new World({ id: 'overworld', create: () => ({ generate() {} }) }, 1);
}

function frame(world, width, height, axis = 'x', missing = false) {
  const point = (u, y) => axis === 'x' ? [u - 10, y + 3, -1] : [-1, y + 3, u - 10];
  for (let u = 0; u < width + 2; u++) for (let y = 0; y < height + 2; y++) {
    if (u !== 0 && u !== width + 1 && y !== 0 && y !== height + 1) continue;
    if (missing && u === 1 && y === 0) continue;
    world.set(...point(u, y), B.obsidian);
  }
  return point;
}

test('obsidian frames light in both orientations including maximum size', () => {
  for (const axis of ['x', 'z']) for (const [width, height] of [[2, 3], [7, 9], [21, 21]]) {
    const world = emptyWorld(), point = frame(world, width, height, axis);
    assert(lightNetherFrame(world, point(0, 0)));
    assert.equal(world.get(...point(1, 1)), B.nether_portal);
    assert.equal(world.get(...point(width, height)), B.nether_portal);
  }
});

test('open, obstructed, undersized and oversized frames do not light', () => {
  for (const [width, height, missing, obstructed] of [[2, 3, true, false], [1, 3], [2, 2], [22, 3], [2, 22], [2, 3, false, true]]) {
    const world = emptyWorld(), point = frame(world, width, height, 'x', missing);
    if (obstructed) world.set(...point(1, 1), STONE);
    assert.equal(lightNetherFrame(world, point(0, 0)), false);
    assert.notEqual(world.get(...point(1, 1)), B.nether_portal);
  }
  assert.equal(lightNetherFrame(emptyWorld(), [0, 4, 0]), false);
});

test('portal mappings toggle each destination back to Overworld', () => {
  for (const kind of ['nether', 'end', 'city']) {
    assert.equal(portalTarget(B[`${kind}_portal`], 'overworld'), kind);
    assert.equal(portalTarget(B[`${kind}_portal`], kind), 'overworld');
  }
  assert.equal(portalTarget(STONE, 'overworld'), null);
});

test('removing the last interior scaffold lights completed frames in either axis and at maximum size', () => {
  for (const axis of ['x', 'z']) for (const [width, height] of [[2, 3], [21, 21]]) {
    const world = emptyWorld(), point = frame(world, width, height, axis);
    const scaffold = point(Math.ceil(width / 2), Math.ceil(height / 2));
    world.set(...scaffold, STONE);
    assert.equal(lightNetherFrame(world, point(0, 0)), false);
    assert.equal(lightNetherFrame(world, scaffold), false);
    world.set(...scaffold, AIR);
    assert(lightNetherFrame(world, scaffold));
    assert.equal(world.get(...point(1, 1)), B.nether_portal);
    assert.equal(world.get(...point(width, height)), B.nether_portal);
  }
  const world = emptyWorld(), point = frame(world, 2, 3, 'x', true);
  assert.equal(lightNetherFrame(world, point(1, 1)), false);
  assert.equal(world.get(...point(1, 1)), AIR);
});

test('breaking frame sides, tops, bases and corners extinguishes only connected Nether portals', () => {
  for (const axis of ['x', 'z']) for (const [u, y] of [[0, 2], [3, 2], [1, 4], [1, 0], [0, 0], [3, 4]]) {
    const world = emptyWorld(), point = frame(world, 2, 3, axis);
    assert(lightNetherFrame(world, point(0, 0)));
    for (const block of portalShape('nether', 19, 4, 20, 'x', false)) world.set(...block, false);
    world.set(...point(u, y), AIR);
    removeNetherPortal(world, point(u, y));
    for (let a = 1; a <= 2; a++) for (let b = 1; b <= 3; b++) assert.equal(world.get(...point(a, b)), AIR);
    assert.equal(world.get(20, 5, 20), B.nether_portal);
    const entered = [];
    const game = { world, player: new Player(point(1, 1).map(n => n + .1)), enterDimension(d) { entered.push(d.id); } };
    updatePortalTravel(game, 2, dimensions);
    assert.deepEqual(entered, []);
    removeNetherPortal(world, point(u, y));
  }
});

test('portal contact waits one second, resets on exit and cools down after travel', () => {
  const world = emptyWorld();
  for (const block of portalShape('nether', -1, 4, 0, 'x', false)) world.set(...block, false);
  const entered = [];
  const game = { world, player: new Player([.5, 5, .5]), enterDimension(d) { entered.push(d.id); } };
  updatePortalTravel(game, .6, dimensions);
  assert.deepEqual(entered, []);
  game.player.position = [3, 5, 0];
  updatePortalTravel(game, .5, dimensions);
  game.player.position = [.5, 5, .5];
  updatePortalTravel(game, .6, dimensions);
  assert.deepEqual(entered, []);
  updatePortalTravel(game, .4, dimensions);
  assert.deepEqual(entered, ['nether']);
  updatePortalTravel(game, 1, dimensions);
  assert.deepEqual(entered, ['nether']);
  world.set(0, 5, 0, B.end_portal);
  game.portalState.cooldown = 0;
  updatePortalTravel(game, .01, dimensions);
  assert.deepEqual(entered, ['nether', 'end']);
  game.player.vehicle = {};
  game.portalState.cooldown = 0;
  updatePortalTravel(game, 2, dimensions);
  assert.equal(entered.length, 2);
});

test('world edits validate entire portal regions, including holes and disconnected remnants', () => {
  for (const axis of ['x', 'z']) for (const [u, y, id] of [[1, 1, STONE], [1, 2, B.obsidian], [0, 2, STONE], [1, 0, AIR]]) {
    const world = emptyWorld(), point = frame(world, 2, 3, axis);
    assert(lightNetherFrame(world, point(0, 0)));
    world.set(...point(u, y), id);
    for (let a = 1; a <= 2; a++) for (let b = 1; b <= 3; b++) {
      assert.equal(world.get(...point(a, b)), a === u && b === y ? id : AIR);
    }
    assert.equal(world.get(...point(u, y)), id);
    removeNetherPortal(world, point(u, y));
  }
  for (const axis of ['x', 'z']) {
    const world = emptyWorld(), point = frame(world, 2, 3, axis);
    assert(lightNetherFrame(world, point(0, 0)));
    for (let u = 1; u <= 2; u++) world.set(...point(u, 2), STONE);
    for (let u = 1; u <= 2; u++) for (const y of [1, 3]) assert.equal(world.get(...point(u, y)), AIR);
  }
  const world = emptyWorld(), point = frame(world, 2, 3);
  assert(lightNetherFrame(world, point(0, 0)));
  const extension = point(1, 1);
  extension[2]++;
  world.set(...extension, B.nether_portal);
  assert.equal(world.get(...extension), AIR);
  assert.equal(world.get(...point(1, 1)), AIR);
});

test('preexisting damaged single-column portals are extinguished on adjacent base changes', () => {
  for (const axis of ['x', 'z']) for (const narrow of [false, true]) {
    const shape = portalShape('nether', 0, 3, 0, axis, false);
    const world = new World({ id: 'overworld', create: () => ({ generate({ x, z, set }) {
      for (const [wx, y, wz, id] of shape) {
        const u = axis === 'x' ? wx : wz;
        set(wx - x, y, wz - z, id === B.nether_portal && u === 1 && (narrow || y === 4) ? STONE : id);
      }
    } }) }, 1);
    const point = (u, y) => axis === 'x' ? [u, y, 0] : [0, y, u];
    world.set(...point(2, 3), AIR);
    for (let u = 1; u <= 2; u++) for (let y = 4; y <= 6; y++) assert.notEqual(world.get(...point(u, y)), B.nether_portal);
    const entered = [];
    updatePortalTravel({ world, player: new Player(point(2, 4)), enterDimension(d) { entered.push(d.id); } }, 2, dimensions);
    assert.deepEqual(entered, []);
  }
});

test('validation preserves fully enclosed minimum and maximum portals near unrelated edits', () => {
  for (const axis of ['x', 'z']) for (const [width, height] of [[2, 3], [21, 21]]) {
    const world = emptyWorld(), point = frame(world, width, height, axis);
    assert(lightNetherFrame(world, point(0, 0)));
    const nearby = point(1, 1);
    nearby[axis === 'x' ? 2 : 0]++;
    world.set(...nearby, STONE);
    world.set(...nearby, AIR);
    removeNetherPortal(world, nearby);
    for (let u = 1; u <= width; u++) for (let y = 1; y <= height; y++) assert.equal(world.get(...point(u, y)), B.nether_portal);
  }
});

test('mining approach obsidian outside the portal plane leaves intact gates lit', () => {
  for (const axis of ['x', 'z']) for (const side of [-1, 1]) for (const [u, y] of [[1, 0], [1, 1], [0, 0], [2, 2]]) {
    const world = emptyWorld(), point = frame(world, 2, 3, axis);
    assert(lightNetherFrame(world, point(0, 0)));
    const approach = point(u, y);
    approach[axis === 'x' ? 2 : 0] += side;
    world.set(...approach, B.obsidian);
    world.set(...approach, AIR);
    removeNetherPortal(world, approach);
    for (let a = 1; a <= 2; a++) for (let b = 1; b <= 3; b++) assert.equal(world.get(...point(a, b)), B.nether_portal);
  }
  const world = new World(dimensions.get('overworld'), 2391);
  const y = world.generator.surface(7, -7).y;
  world.set(7, y - 4, -8, AIR);
  removeNetherPortal(world, [7, y - 4, -8]);
  assert.equal(world.get(7, y - 3, -7), B.nether_portal);
});

test('Overworld has all three deterministic portal types within fifteen blocks of spawn', () => {
  const first = new World(dimensions.get('overworld'), 2391);
  const second = new World(dimensions.get('overworld'), 2391);
  const found = new Set();
  for (let x = 4; x <= 32; x++) for (let z = -14; z <= 5; z++) {
    if (Math.hypot(x - 18, z) > 15) continue;
    for (let y = 1; y < 95; y++) {
      const id = first.get(x, y, z);
      if (portalTarget(id, 'overworld')) found.add(id);
    }
  }
  assert.deepEqual(found, new Set([B.nether_portal, B.end_portal, B.city_portal]));
  assert.deepEqual(first.chunk(0, -1), second.chunk(0, -1));
  for (const [x, z] of [[7, -7], [17, -9], [27, -7], [18, 0]]) {
    const top = first.generator.surface(x, z);
    assert.equal(first.get(x, top.y, z), top.id);
    for (let y = top.y + 1; y < 96; y++) assert.equal(first.get(x, y, z), AIR);
  }
  for (const [dimension, x, z, id] of [['nether', -3, 3, B.nether_portal], ['end', 24, 1, B.end_portal], ['city', 10, 20, B.city_portal]]) {
    const world = new World(dimensions.get(dimension), 2391);
    let found = false;
    for (let y = 1; y < 95; y++) found ||= world.get(x, y, z) === id;
    assert(found, `${dimension} return portal`);
  }
});

test('portal command validates input and builds in front; dimension commands support round trips', () => {
  const registry = registerPortalCommands(createCommands());
  const game = { world: emptyWorld(), player: new Player([0, 10, 0]), enterDimension(d) { this.dimension = d; } };
  assert.match(registry.execute('/portal', game), /Usage/);
  assert.match(registry.execute('/portal unknown', game), /Usage/);
  for (const kind of ['nether', 'end', 'city']) {
    game.world = emptyWorld();
    assert.match(registry.execute(`/portal ${kind}`, game), /Built/);
    assert.match(registry.execute(`/dimension ${kind}`, game), /Entered/);
    assert.equal(game.dimension.id, kind);
    assert.match(registry.execute('/dimension overworld', game), /Entered/);
    assert.equal(game.dimension.id, 'overworld');
  }
  game.player.position[1] = 95;
  assert.match(buildPortal(game, 'city'), /Stand between/);
});

test('portal commands only edit the gate footprint and reject unbreakable blocks atomically', () => {
  for (const kind of ['nether', 'end', 'city']) for (const yaw of [0, Math.PI / 2]) {
    const world = emptyWorld(), player = new Player([0, 10, 0]);
    player.yaw = yaw;
    const alongX = yaw !== 0;
    const shape = portalShape(kind, alongX ? 5 : -1, 9, alongX ? -1 : 5, alongX ? 'z' : 'x', false);
    const footprint = new Set(shape.map(([x, y, z]) => `${x},${y},${z}`));
    for (let x = -4; x <= 10; x++) for (let z = -4; z <= 10; z++) world.set(x, 8, z, BEDROCK);
    world.set(-4, 12, -4, STONE);
    assert.match(buildPortal({ world, player }, kind), /Built/);
    for (let x = -4; x <= 10; x++) for (let y = 8; y <= 16; y++) for (let z = -4; z <= 10; z++) {
      if (!footprint.has(`${x},${y},${z}`)) assert.equal(world.get(x, y, z), y === 8 ? BEDROCK : x === -4 && y === 12 && z === -4 ? STONE : AIR);
    }
    const blocked = emptyWorld();
    blocked.set(...shape[0].slice(0, 3), BEDROCK);
    const before = structuredClone(blocked.edits);
    assert.match(buildPortal({ world: blocked, player }, kind), /unbreakable/);
    assert.deepEqual(blocked.edits, before);
  }
});

test('portal commands refuse blocked openings, headroom and approaches without modifying terrain or edits', () => {
  for (const kind of ['nether', 'end', 'city']) for (const yaw of [0, Math.PI / 2]) {
    const alongX = yaw !== 0;
    const shape = portalShape(kind, alongX ? 5 : -1, 9, alongX ? -1 : 5, alongX ? 'z' : 'x', false);
    const portal = shape.find(([, , , id]) => id === B[`${kind}_portal`]);
    const [x, y, z] = portal;
    const obstacles = kind === 'end' ? [[x, y + 1, z], [x, y + 2, z]] :
      [[x, y, z], [x + (alongX ? 1 : 0), y, z + (alongX ? 0 : 1)], [x - (alongX ? 1 : 0), y + 1, z - (alongX ? 0 : 1)]];
    for (const position of obstacles) for (const id of [STONE, BEDROCK]) {
      const world = emptyWorld(), player = new Player([0, 10, 0]);
      player.yaw = yaw;
      world.set(...position, id);
      const before = structuredClone(world.edits);
      assert.match(buildPortal({ world, player }, kind), /obstructed|unbreakable/);
      assert.deepEqual(world.edits, before);
      assert.equal(world.get(...position), id);
    }
  }
});

test('east-facing End portal at shipped Overworld spawn refuses burial under natural terrain', () => {
  const world = new World(dimensions.get('overworld'), 2391);
  const player = new Player(world.spawn(18, 0));
  player.yaw = Math.PI / 2;
  const before = structuredClone(world.edits);
  assert.match(buildPortal({ world, player }, 'end'), /obstructed/);
  assert.deepEqual(world.edits, before);
});

test('portal commands reuse identical frame blocks and complete gates without false collisions', () => {
  for (const kind of ['nether', 'end', 'city']) for (const yaw of [0, Math.PI / 2]) {
    const world = emptyWorld(), player = new Player([0, 10, 0]);
    player.yaw = yaw;
    const alongX = yaw !== 0;
    const shape = portalShape(kind, alongX ? 5 : -1, 9, alongX ? -1 : 5, alongX ? 'z' : 'x', false);
    for (const block of shape) if (block[3] !== B[`${kind}_portal`]) world.set(...block);
    assert.match(buildPortal({ world, player }, kind), /Built/);
    for (const [x, y, z, id] of shape) assert.equal(world.get(x, y, z), id);
    const before = structuredClone(world.edits);
    assert.match(buildPortal({ world, player }, kind), /Built/);
    assert.deepEqual(world.edits, before);
  }
});
