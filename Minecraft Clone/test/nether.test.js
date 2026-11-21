import test from 'node:test';
import assert from 'node:assert/strict';
import { AIR, BEDROCK, blocks, dimensionBlocks as B, tiles, faceTile } from '../world/blocks.js';
import { dimensions } from '../world/dimensions.js';
import { World, SIZE, HEIGHT, indexOf } from '../world/world.js';
import { createNether, LAVA_LEVEL } from '../world/nether.js';
import { meshChunk, meshTerrain, meshBoxes } from '../engine/mesh.js';
import { createAtlas } from '../engine/atlas.js';

const nether = seed => new World(dimensions.get('nether'), seed);

test('Nether has an unbroken bedrock shell with jagged inner layers', () => {
  const data = nether(2391).chunk(-2, 3);
  let floorJagged = false, roofJagged = false;
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    assert.equal(data[indexOf(x, 0, z)], BEDROCK);
    assert.equal(data[indexOf(x, HEIGHT - 1, z)], BEDROCK);
    floorJagged ||= data[indexOf(x, 1, z)] !== BEDROCK;
    roofJagged ||= data[indexOf(x, HEIGHT - 3, z)] !== BEDROCK;
  }
  assert(floorJagged && roofJagged);
});

test('Nether contains low lava oceans and deterministic seeded cave volumes', () => {
  const first = nether(2391), second = nether(2391), different = nether(2392);
  let lava = false;
  for (const [x, z] of [[-5, -3], [0, 0], [4, 7], [10, -8]]) {
    const data = first.chunk(x, z);
    assert.deepEqual(data, second.chunk(x, z));
    lava ||= data.subarray(0, SIZE * SIZE * (LAVA_LEVEL + 1)).includes(B.lava);
    assert(data.includes(AIR));
    assert(data.includes(B.netherrack));
  }
  assert(lava);
  assert.notDeepEqual(first.chunk(4, 7), different.chunk(4, 7));
});

test('Nether spawn is open air above a solid safe platform for multiple seeds', () => {
  for (const seed of [0, 1, 91, 2391, -72]) {
    const world = nether(seed);
    const [x, y, z] = world.spawn(...world.dimension.spawn).map(Math.floor);
    assert(blocks[world.get(x, y - 1, z)].solid);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (let dy = 0; dy < 3; dy++) assert.equal(world.get(x + dx, y + dy, z + dz), AIR);
    }
  }
  assert.equal(createNether(1).spawn(100, 100), undefined);
});

test('Nether bridges have three unobstructed walking lanes across chunks and negative spans', () => {
  for (const seed of [2391, 1, 91]) {
    const world = nether(seed);
    for (const [offsetX, offsetZ] of [[0, 0], [-160, -192]]) {
      for (let x = 32; x < 112; x++) for (let lane = 0; lane < 5; lane++) {
        assert.equal(world.get(x + offsetX, 50, lane + offsetZ), B.nether_bricks);
        assert.equal(world.get(x + offsetX, 51, lane + offsetZ), lane === 0 || lane === 4 ? B.nether_bricks : AIR);
        for (let y = 52; y < 55; y++) assert.equal(world.get(x + offsetX, y, lane + offsetZ), AIR);
      }
    }
  }
});

test('dimension palettes have valid distinct byte IDs and procedural atlas tiles', () => {
  assert(blocks.length <= 256);
  assert.equal(new Set(blocks.map(b => b.key)).size, blocks.length);
  for (const id of Object.values(B)) {
    assert.equal(blocks[id].id, id);
    for (let face = 0; face < 6; face++) assert(tiles[faceTile(id, face)]);
  }
  for (const key of ['lava', 'nether_portal', 'end_portal', 'city_portal']) {
    assert.equal(blocks[B[key]].solid, false);
    assert.equal(blocks[B[key]].glow, true);
  }
  assert.equal(blocks[B.lava].liquid, true);
  assert.notEqual(faceTile(B.basalt, 0), faceTile(B.basalt, 2));
});

test('glow flags reach voxel, liquid, LOD and entity meshes without changing vertex layout', () => {
  const data = new Uint8Array(SIZE * SIZE * HEIGHT);
  const neighbors = Array.from({ length: 4 }, () => new Uint8Array(data.length));
  assert.equal(meshChunk(data, neighbors).opaque.length, 0);
  for (const id of [B.glowstone, B.lava, B.nether_portal]) {
    data[indexOf(1, 4, 1)] = id;
    const mesh = meshChunk(data, neighbors);
    const vertices = blocks[id].liquid ? mesh.liquid : mesh.opaque;
    assert.equal(vertices.length, 6 * 6 * 7);
    for (let i = 6; i < vertices.length; i += 7) assert.equal(vertices[i], -1);
  }
  for (const mesh of [meshTerrain(() => ({ y: 4, id: B.glowstone }), 0, 0, 1),
    meshBoxes([{ origin: [0, 0, 0], size: [1, 1, 1], id: B.end_crystal }])]) {
    for (let i = 6; i < mesh.opaque.length; i += 7) assert.equal(mesh.opaque[i], -1);
  }
});

test('all procedural atlas patterns paint valid colors without external assets', () => {
  const previous = globalThis.document;
  let pixels = 0;
  const ctx = { fillStyle: '', fillRect() { assert.match(this.fillStyle, /^#[0-9a-f]{6}$/i); pixels++; } };
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
  try {
    const atlas = createAtlas();
    assert.equal(atlas.width, 256);
    assert.equal(pixels, tiles.length * 256);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
