import test from 'node:test';
import assert from 'node:assert/strict';
import { atmosphere } from '../engine/atmosphere.js';
import { dimensions } from '../world/dimensions.js';
import { presets } from '../ui/settings.js';
import { selectTiles } from '../engine/stream.js';

test('submerged eyes use short blue fog without celestial features', () => {
  for (const daylight of [0, .5, 1]) {
    const water = atmosphere({}, presets.Low, daylight, true);
    assert.deepEqual(water.horizon, water.fog);
    assert.deepEqual(water.zenith, water.fog);
    assert.deepEqual(water.fogRange, [0, 24]);
    assert(water.fog[2] > water.fog[0]);
    assert.equal(water.stars, false);
    assert.equal(water.sun, false);
  }
  assert.deepEqual(atmosphere({}, presets.Low, 1, false), atmosphere({}, presets.Low, 1));
});

test('Nether sky and distant terrain share flat fog before ceiling LOD ends on every preset', () => {
  for (const settings of Object.values(presets)) {
    const nether = dimensions.get('nether');
    for (const daylight of [0, .18, 1]) {
      const sky = atmosphere(nether, settings, daylight);
      assert.deepEqual(sky.horizon, nether.fog);
      assert.deepEqual(sky.zenith, nether.fog);
      assert.equal(sky.stars, false);
      assert.equal(sky.sun, false);
      assert.equal(nether.clouds, false);
      for (const [cx, cz] of [[0, 0], [-1, -1], [7, 7]]) {
        for (const tile of selectTiles(cx, cz, settings.distance, settings.detail)) {
          if (tile.step === 1) continue;
          const x = Math.max(tile.x * 16 - cx * 16, 0, cx * 16 - (tile.x + tile.step) * 16);
          const z = Math.max(tile.z * 16 - cz * 16, 0, cz * 16 - (tile.z + tile.step) * 16);
          assert(sky.fogRange[1] <= Math.hypot(x, z));
        }
      }
    }
  }
});

test('End retains stars without sunlight; unspecified dimensions retain outdoor defaults', () => {
  const end = atmosphere(dimensions.get('end'), presets.Low, .22);
  assert.equal(end.stars, true);
  assert.equal(end.sun, false);
  const outdoor = atmosphere({}, presets.Low, 1);
  assert.equal(outdoor.stars, true);
  assert.equal(outdoor.sun, true);
  assert.deepEqual(outdoor.horizon, [.53, .73, .89]);
  assert.deepEqual(outdoor.fog, outdoor.horizon);
  assert.deepEqual(outdoor.fogRange, [57.599999999999994, 96]);
});
