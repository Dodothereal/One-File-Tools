import test from 'node:test';
import assert from 'node:assert/strict';
import { AIR, BEDROCK, blocks, dimensionBlocks as B } from '../world/blocks.js';
import { dimensions } from '../world/dimensions.js';
import { World, HEIGHT } from '../world/world.js';
import { CITY_GRID, STREET_Y } from '../world/city.js';

const worldOf = (id, seed = 2391) => new World(dimensions.get(id), seed);

function checkSurface(world, samples) {
  for (const [x, z] of samples) {
    const surface = world.generator.surface(x, z);
    let y = HEIGHT - 1;
    while (y > 0 && world.get(x, y, z) === AIR) y--;
    assert.equal(surface.y, y, `${x},${z}: height`);
    assert.equal(surface.id, world.get(x, y, z), `${x},${z}: block`);
  }
}

test('End main island floats over void with an empty gap before outer islands', () => {
  const world = worldOf('end');
  assert.equal(world.get(10, 40, 0), B.end_stone);
  assert.equal(world.get(10, 0, 0), AIR);
  assert.equal(world.get(0, 49, 0), BEDROCK);
  assert.equal(world.get(1, 50, 0), B.end_portal);
  assert(world.chunk(9, 9).every(id => id === AIR));
  assert.equal(world.generator.surface(150, 150).id, AIR);
  const outer = [];
  for (let x = 280; x <= 600; x += 32) if (world.generator.surface(x, 280).id !== AIR) outer.push([x, 280]);
  assert(outer.length > 0);
  checkSurface(world, [[0, 0], [18, 0], [55, 0], [150, 150], ...outer]);
});

test('End has ten obsidian pillars crowned with crystals', () => {
  const world = worldOf('end');
  const heights = new Set();
  for (let i = 0; i < 10; i++) {
    const x = Math.round(Math.cos(i * Math.PI / 5) * 55);
    const z = Math.round(Math.sin(i * Math.PI / 5) * 55);
    const { y, id } = world.generator.surface(x, z);
    assert.equal(id, B.end_crystal);
    assert.equal(world.get(x, y - 1, z), B.obsidian);
    heights.add(y);
  }
  assert(heights.size > 1);
});

test('End and City generation is deterministic and spawns have solid ground and clearance', () => {
  for (const id of ['end', 'city']) for (const seed of [0, 91, 2391]) {
    const a = worldOf(id, seed), b = worldOf(id, seed);
    for (const [cx, cz] of [[0, 0], [-2, 3], [20, -19]]) assert.deepEqual(a.chunk(cx, cz), b.chunk(cx, cz));
    const [x, y, z] = a.spawn(...a.dimension.spawn).map(Math.floor);
    assert(blocks[a.get(x, y - 1, z)].solid);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      assert.equal(a.get(x + dx, y, z + dz), AIR);
      assert.equal(a.get(x + dx, y + 1, z + dz), AIR);
    }
  }
  assert.notDeepEqual(worldOf('city', 1).chunk(1, 1), worldOf('city', 2).chunk(1, 1));
  assert.notDeepEqual(worldOf('end', 1).chunk(0, 0), worldOf('end', 2).chunk(0, 0));
});

test('City grid has roads, sidewalks, a bedrock foundation and tall hollow buildings', () => {
  const world = worldOf('city');
  for (const x of [-CITY_GRID, 0, CITY_GRID]) {
    assert.equal(world.get(x, STREET_Y, 20), B.asphalt);
    assert.equal(world.get(x, 0, 20), BEDROCK);
  }
  assert.equal(world.get(10, STREET_Y, 12), B.sidewalk);
  assert.equal(world.get(4, STREET_Y, -8), B.asphalt_lane);
  assert.equal(world.get(4, STREET_Y, -3), B.asphalt);
  let building;
  for (let lx = -3; lx <= 3 && !building; lx++) for (let lz = -3; lz <= 3 && !building; lz++) {
    const x = lx * CITY_GRID + 28, z = lz * CITY_GRID + 28;
    if (world.generator.surface(x, z).y > 60) building = [lx, lz];
  }
  assert(building);
  const [lx, lz] = building;
  const x = lx * CITY_GRID + 28, z = lz * CITY_GRID;
  assert.equal(world.get(x, STREET_Y + 1, z + 15), AIR, 'walk-in doorway');
  assert.equal(world.get(x, STREET_Y + 2, z + 20), AIR, 'hollow ground floor');
  assert(blocks[world.get(x, STREET_Y + 4, z + 20)].solid, 'floor slab');
});

test('City LOD surfaces match generated roofs, streets, parks and equipment', () => {
  const world = worldOf('city');
  const samples = [[0, 20], [4, 3], [10, 16], [-1, -1]];
  for (let lx = -2; lx <= 2; lx++) for (let lz = -2; lz <= 2; lz++) {
    for (const [u, v] of [[20, 20], [28, 28], [33, 33], [24, 24], [15, 15]]) samples.push([lx * CITY_GRID + u, lz * CITY_GRID + v]);
  }
  checkSurface(world, samples);
});
