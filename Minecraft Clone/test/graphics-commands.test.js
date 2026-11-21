import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presets, graphicsKeys, normalizeSettings, loadSettings } from '../ui/settings.js';
import { createCommands } from '../commands/builtin.js';
import { Player } from '../entities/player.js';
import { World, SIZE, HEIGHT, indexOf } from '../world/world.js';
import { STONE } from '../world/blocks.js';
import { meshChunk, meshTerrain } from '../engine/mesh.js';
import { ChunkStream } from '../engine/stream.js';

test('presets set every quality option and custom detection preserves the base', () => {
  for (const [preset, values] of Object.entries(presets)) {
    assert.deepEqual(Object.keys(values), graphicsKeys);
    const settings = normalizeSettings({ preset });
    assert.equal(settings.preset, preset);
    const custom = normalizeSettings({ ...settings, clouds: !settings.clouds });
    assert.equal(custom.preset, 'Custom');
    assert.equal(normalizeSettings({ ...custom, clouds: settings.clouds }).preset, preset);
    assert.equal(normalizeSettings({ ...settings, fov: 90, overlay: true }).preset, preset);
  }
  assert.equal(presets.Potato.ao, false);
  assert.equal(presets.Potato.post, false);
  assert.equal(presets['Ultra++'].distance, 64);
});

test('normalization handles empty, corrupt, hostile and old v1 preferences', () => {
  for (const input of [null, undefined, [], 42, 'bad']) assert.equal(normalizeSettings(input).preset, 'Balanced');
  const settings = normalizeSettings({ distance: Infinity, scale: -5, detail: 99, clouds: 'false', fpsLimit: 17, fog: 'bad' });
  assert.equal(settings.distance, 10);
  assert.equal(settings.scale, .5);
  assert.equal(settings.detail, 7);
  assert.equal(settings.clouds, true);
  assert.equal(settings.fpsLimit, 60);
  assert.equal(settings.fog, 'high');
  globalThis.localStorage = { getItem: key => key.endsWith('v1') ? JSON.stringify({ preset: 'Potato', distance: 4, detail: 2, scale: .55, clouds: false }) : null };
  const migrated = loadSettings();
  assert.equal(migrated.ao, false);
  assert.equal(migrated.preset, 'Custom');
  globalThis.localStorage = { getItem: () => '{bad' };
  assert.equal(loadSettings().preset, 'Balanced');
  delete globalThis.localStorage;
});

const setup = () => {
  const game = { player: new Player([1.5,10,2.5]), settings: normalizeSettings(), world: new World({ id: 'test', create: () => ({ generate() {} }) }, 1) };
  game.ui = { setSettings(changes) { game.settings = normalizeSettings({ ...game.settings, ...changes }); } };
  return { game, commands: createCommands() };
};

test('graphics commands validate all option kinds and complete names', () => {
  const { game, commands } = setup();
  const run = input => commands.execute(input, game);
  assert.match(run('/graphics'), /Ultra\+\+/);
  run('/graphics ultra++');
  assert.equal(game.settings.distance, 64);
  run('/set ao false'); assert.equal(game.settings.ao, false);
  run('/set fog low'); assert.equal(game.settings.fog, 'low');
  run('/set fpsLimit unlimited'); assert.equal(game.settings.fpsLimit, 0);
  run('/render 24'); assert.equal(game.settings.distance, 24);
  run('/fov 105'); assert.equal(game.settings.fov, 105);
  run('/perf'); assert.equal(game.settings.overlay, true);
  for (const command of ['/graphics nope','/render','/render 65','/render 2.5','/fov 59','/set','/set ao perhaps','/set fog off','/set fpsLimit 45','/set distance NaN','/set missing 3']) assert.match(run(command), /Usage:/, command);
  assert.deepEqual(commands.complete('/gra'), ['/graphics']);
  assert.deepEqual(commands.complete('/graphics u'), []);
  assert(commands.complete('/').includes('/help'));
});

test('block commands support relative coordinates, reversed fills, empty and errors', () => {
  const { game, commands } = setup();
  const run = input => commands.execute(input, game);
  assert.equal(run('/setblock ~ ~ ~ stone'), 'Changed 1 blocks.');
  assert.equal(game.world.get(1,10,2), STONE);
  assert.equal(run('/setblock ~ ~ ~ stone'), 'Changed 0 blocks.');
  assert.equal(run('/fill 2 12 3 1 11 2 stone'), 'Changed 8 blocks.');
  assert.equal(run('/setblock -1 1 -1 air'), 'Changed 0 blocks.');
  for (const input of ['/fill','/fill 0 1 0 100 20 100 stone','/setblock 0 -1 0 stone','/setblock 0 96 0 stone','/setblock 0 1 0 nonexistent','/setblock ~bad 1 0 stone','/setblock 1 2 stone']) assert.match(run(input), /Usage:/, input);
});

test('movement, position and benchmark commands', () => {
  const { game, commands } = setup();
  commands.execute('/speed 2', game); assert.equal(game.speed, 2);
  assert.match(commands.execute('/speed 100', game), /Usage:/);
  assert.match(commands.execute('/speed', game), /Usage:/);
  commands.execute('/fly', game); assert(game.player.flying);
  commands.execute('/fly', game); assert(!game.player.flying);
  game.player.setMode('survival'); assert.match(commands.execute('/fly', game), /creative/);
  assert.equal(commands.execute('/pos', game), '1.50, 10.00, 2.50');
  assert.match(commands.execute('/benchmark', game), /5 seconds/);
  assert.equal(game.benchmark.frames, 0);
  let cleared = false;
  globalThis.document = { getElementById: () => ({ replaceChildren() { cleared = true; } }) };
  assert.equal(commands.execute('/clear', game), '');
  assert(cleared);
  delete globalThis.document;
});

test('AO darkens occluded vertices only and can be disabled', () => {
  const data = new Uint8Array(SIZE*SIZE*HEIGHT);
  const neighbors = Array.from({ length: 4 }, () => new Uint8Array(data.length));
  assert.equal(meshChunk(data, neighbors, true).opaque.length, 0);
  data[indexOf(4,4,4)] = STONE;
  data[indexOf(5,5,4)] = STONE;
  const plain = meshChunk(data, neighbors, false).opaque;
  const shaded = meshChunk(data, neighbors, true).opaque;
  assert.equal(plain.length, shaded.length);
  assert(shaded.some((value,i) => i % 7 === 6 && value < plain[i]));
});

test('distant terrain reduces vertex cost without shrinking its footprint', () => {
  const surface = () => ({ y: 30, id: STONE });
  const fine = meshTerrain(surface, 0, 0, 2).opaque;
  const coarse = meshTerrain(surface, 0, 0, 8).opaque;
  assert(coarse.length < fine.length);
  const xs = [...coarse].filter((_,i) => i % 7 === 0);
  const zs = [...coarse].filter((_,i) => i % 7 === 2);
  assert.equal(Math.min(...xs), 0);
  assert.equal(Math.max(...xs), 128);
  assert.equal(Math.max(...zs), 128);
});

test('stream fills all 64-chunk tiles, caps uploads, and rebuilds AO live', () => {
  const world = new World({ id: 'test', create: () => ({ generate() {}, surface: () => ({ y: 1, id: STONE }) }) }, 1);
  let uploads = 0;
  const stream = new ChunkStream(world, { upload() { uploads++; return {}; }, release() {} });
  const settings = normalizeSettings({ preset: 'Ultra++' });
  let frames = 0;
  do {
    const before = uploads;
    stream.update([0,5,0], settings);
    assert(uploads-before <= 2);
  } while (stream.jobs.length && ++frames < 2000);
  assert.equal(stream.jobs.length, 0);
  assert.equal(stream.active.size, stream.wanted.length);
  const before = uploads;
  stream.update([0,5,0], { ...settings, ao: false });
  assert(uploads > before);
  assert(stream.dirty.size > 0);
  stream.dispose();
  assert.equal(stream.active.size, 0);
});
