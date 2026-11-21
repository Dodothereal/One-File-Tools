import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meshChunk } from '../engine/mesh.js';
import { selectTiles } from '../engine/stream.js';
import { raycast } from '../engine/raycast.js';
import { AIR, BEDROCK, BRICK, STONE, WATER } from '../world/blocks.js';
import { dimensions } from '../world/dimensions.js';
import { HEIGHT, SIZE, World, indexOf } from '../world/world.js';
import { Player } from '../entities/player.js';
import { resolveCamera } from '../entities/camera.js';
import { createCommands } from '../commands/builtin.js';
import { normalizeSettings, presets } from '../ui/settings.js';

const worldWith = (generate, surface) => new World({ id: 'test', create: () => ({ generate, surface }) }, 91);

test('Overworld is deterministic with terrain, water and caves; stubs are registered', () => {
  const dimension = dimensions.get('overworld');
  const first = new World(dimension, 2391);
  const second = new World(dimension, 2391);
  assert.deepEqual(first.chunk(-1, 1), second.chunk(-1, 1));
  assert.equal(first.get(-1, 0, 19), BEDROCK);
  const region = [-2,-1,0,1].flatMap(x => [-1,0,1,2].map(z => first.chunk(x,z)));
  assert(region.some(chunk => chunk.includes(WATER)));
  assert(region.some(chunk => chunk.subarray(SIZE*SIZE*4, SIZE*SIZE*12).includes(AIR)));
  assert.deepEqual([...dimensions.values()].filter(d => !d.create).map(d => d.id), ['nether','end','city']);
});

test('edits use floor-based chunk addresses and survive bounds pruning', () => {
  const world = worldWith(() => {});
  let edit;
  world.onEdit = (...coordinates) => { edit = coordinates; };
  assert(world.set(-1, 6, -17, BRICK));
  assert.deepEqual(edit, [-1, -2]);
  world.prune(25, 25, 2);
  assert.equal(world.chunks.size, 0);
  assert.equal(world.get(-1, 6, -17), BRICK);
  assert.equal(world.set(0, HEIGHT, 0, STONE), false);
});

test('chunk meshing removes hidden faces on either side of a boundary', () => {
  const empty = () => new Uint8Array(SIZE*SIZE*HEIGHT);
  const data = empty();
  const neighbors = Array.from({length: 4}, empty);
  data[indexOf(15,12,4)] = STONE;
  assert.equal(meshChunk(data, neighbors).opaque.length, 6*6*7);
  neighbors[0][indexOf(0,12,4)] = STONE;
  assert.equal(meshChunk(data, neighbors).opaque.length, 5*6*7);
  neighbors[0][indexOf(0,12,4)] = WATER;
  assert.equal(meshChunk(data, neighbors).opaque.length, 6*6*7);
  data[indexOf(15,12,4)] = WATER;
  assert.equal(meshChunk(data, neighbors).liquid.length, 5*6*7);
});

test('64-chunk streaming uses nonoverlapping coarse tiles and keeps nearby voxels', () => {
  const tiles = selectTiles(-17, 11, 64, 6);
  assert(tiles.length < 1300 && tiles.some(tile => tile.step === 8));
  const cells = new Set();
  for (const { x,z,step,distance } of tiles) {
    if (distance <= 6) assert.equal(step, 1);
    for (let a = x; a < x+step; a++) for (let b = z; b < z+step; b++) {
      const key = `${a},${b}`;
      assert(!cells.has(key));
      cells.add(key);
    }
  }
  for (let x = -81; x <= 47; x++) for (let z = -53; z <= 75; z++) assert(cells.has(`${x},${z}`));
});

test('raycasting gives target and placement cell across zero with axis-aligned rays', () => {
  const hit = raycast([.5, 2.5, .5], [-1,0,0], 8, x => x === -2);
  assert.deepEqual(hit, { block: [-2,2,0], adjacent: [-1,2,0], distance: 1.5 });
  assert.equal(raycast([0,0,0], [0,1,0], 1, (_,y) => y > 1), null);
});

test('player lands, jumps, flies in creative, and respects solid walls', () => {
  const world = worldWith(({size,set}) => {
    for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) {
      set(x,0,z,STONE);
      if (z === 2) set(x,1,z,STONE);
    }
  });
  const player = new Player([.5, 4, .5]);
  const step = (count, keys = []) => {
    for (let i = 0; i < count; i++) player.step(1/120, new Set(keys), world);
  };
  step(150);
  assert.equal(player.position[1], 1);
  assert(player.grounded);
  step(100, ['KeyW']);
  assert.equal(player.position[2], 1.7);
  player.jump(1000);
  step(15);
  assert(player.position[1] > 1);
  player.jump(1100);
  assert(player.flying);
  const y = player.position[1];
  step(40, ['Space']);
  assert(player.position[1] > y + 2);
  player.setMode('survival');
  assert(!player.flying);
});

test('perspective resolution stops behind walls and delegates cockpit to vehicles', () => {
  const world = worldWith(() => {});
  world.set(0, 2, -1, STONE);
  const player = new Player([.5, 1, .5]);
  player.pitch = 0;
  assert.deepEqual(resolveCamera(2, player, world, 80).position, [.5,2.6,.2]);
  player.vehicle = { camera: id => id === 'cockpit' ? { position: [10,20,30], fov: 91 } : null };
  const cockpit = resolveCamera(3, player, world, 80);
  assert.deepEqual(cockpit.position, [10,20,30]);
  assert.equal(cockpit.fov, 91);
});

test('command registry handles navigation, inventory, time, help and invalid commands', () => {
  const registry = createCommands();
  const world = worldWith(() => {});
  const game = { player: new Player([0,1,0]), world, enterDimension(dimension) { this.dimension = dimension; } };
  assert.match(registry.execute('/help', game), /\/time/);
  assert.match(registry.execute('/dimension city', game), /not yet playable/);
  assert.match(registry.execute('/dimension overworld', game), /Entered/);
  assert.equal(game.dimension.id, 'overworld');
  registry.execute('/tp ~1 38 ~-2', game);
  assert.deepEqual(game.player.position, [1, 38, -2]);
  registry.execute('/time night', game);
  assert.equal(game.time, .75);
  registry.execute('/give terracotta_brick 3', game);
  assert.equal(game.player.hotbar[2], BRICK);
  registry.execute('/gamemode survival', game);
  assert.equal(game.player.mode, 'survival');
  assert.equal(registry.execute('/seed', game), 'World seed: 91');
  assert.match(registry.execute('/foobar', game), /Unknown command/);
});

test('graphics presets include 64-chunk LOD and loaded settings are validated', () => {
  assert.equal(presets['Ultra++'].distance, 64);
  assert.equal(normalizeSettings({ distance: 700 }).distance, 64);
  assert.equal(normalizeSettings({ distance: 'bad' }).distance, presets.Balanced.distance);
});
