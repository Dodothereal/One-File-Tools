import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../engine/renderer.js';
import { viewAxes } from '../engine/math.js';
import { Interface } from '../ui/interface.js';
import { presets } from '../ui/settings.js';

test('liquid draws double-sided while opaque geometry retains culling', () => {
  const calls = [];
  const gl = new Proxy({}, { get: (_, key) => /^[A-Z_]+$/.test(key) ? key
    : (...args) => calls.push([key, ...args]) });
  const renderer = Object.assign(Object.create(Renderer.prototype), {
    gl, canvas: { clientWidth: 100, clientHeight: 100 }, sky: {}, voxel: {}, line: {},
  });
  const previous = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 1;
  try {
    for (const liquid of [null, { vao: 'water', count: 6 }]) {
      calls.length = 0;
      renderer.render({ position: [0, 2, 0], fov: 78, ...viewAxes(0, 0) },
        [{ bounds: [-8, 1, 8, 16, 10], mesh: { opaque: { vao: 'land', count: 6 }, liquid } }],
        presets.Low, .25, {}, null, []);
      let culling = false;
      const draws = [];
      let vao;
      for (const [name, ...args] of calls) {
        if (name === 'enable' && args[0] === 'CULL_FACE') culling = true;
        if (name === 'disable' && args[0] === 'CULL_FACE') culling = false;
        if (name === 'bindVertexArray') vao = args[0];
        if (name === 'drawArrays' && vao) draws.push([vao, culling]);
      }
      assert.deepEqual(draws, liquid ? [['land', true], ['water', false]] : [['land', true]]);
      assert.equal(culling, true);
    }
  } finally {
    if (previous === undefined) delete globalThis.devicePixelRatio;
    else globalThis.devicePixelRatio = previous;
  }
});

test('Escape returns settings to menu and focuses its entry, ignoring other views and keys', () => {
  const previous = globalThis.document;
  let focused = false, prevented = false;
  globalThis.document = { getElementById: id => {
    assert.equal(id, 'settings');
    return { focus: () => { focused = true; } };
  } };
  try {
    const ui = Object.assign(Object.create(Interface.prototype), {
      view: 'settings', show(view) { this.view = view; },
    });
    ui.backFromSettings({ key: 'Enter' });
    assert.equal(ui.view, 'settings');
    ui.backFromSettings({ key: 'Escape', preventDefault() { prevented = true; } });
    assert.equal(ui.view, 'menu');
    assert(focused && prevented);
    for (const view of ['menu', 'play', 'chat', 'hangar', undefined]) {
      ui.view = view;
      ui.backFromSettings({ key: 'Escape' });
      assert.equal(ui.view, view);
    }
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
