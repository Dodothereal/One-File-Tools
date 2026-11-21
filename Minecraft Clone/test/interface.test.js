import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Interface } from '../ui/interface.js';

test('performance overlay stays out of paused menus and respects its saved toggle', () => {
  const nodes = new Map();
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, {});
      return nodes.get(id);
    },
  };
  try {
    const ui = Object.create(Interface.prototype);
    ui.game = {
      settings: { overlay: true },
      player: { position: [0, 1, 0], slot: 0, hotbar: [] },
      world: { generator: {}, dimension: { name: 'Test' } },
      renderer: {},
      stream: { jobs: [], dirty: new Set() },
    };
    ui.flight = { show() {}, update() {} };
    ui.hotbarSignature = '0:';
    for (const enabled of [true, false]) {
      ui.game.settings.overlay = enabled;
      for (const view of ['play', 'menu', 'settings', 'hangar', 'chat', 'play']) {
        const hidden = !enabled || (view !== 'play' && view !== 'chat');
        ui.show(view);
        assert.equal(nodes.get('performance').hidden, hidden, `${view} transition`);
        ui.update({}, 60, 12);
        assert.equal(nodes.get('performance').hidden, hidden, `${view} frame`);
        assert.equal(ui.game.settings.overlay, enabled);
      }
    }
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
