import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CommandRegistry } from '../commands/registry.js';
import { createCommands } from '../commands/builtin.js';
import { registerPortalCommands } from '../commands/portals.js';
import { presets, settingRules } from '../ui/settings.js';

test('completion preserves command names, empty input and unknown commands', () => {
  const commands = createCommands();
  assert.deepEqual(commands.complete('/GRA'), ['/graphics']);
  assert.deepEqual(commands.complete('  gra'), ['/graphics']);
  assert.deepEqual(commands.complete(''), commands.complete('/'));
  assert(commands.complete('/').includes('/help'));
  for (const input of ['/missing', '/missing value', '/perf ', '/tp ~ ', '/graphics nope', '/graphics Potato extra']) {
    assert.deepEqual(commands.complete(input), [], input);
  }
  assert.deepEqual(new CommandRegistry().complete(''), []);
});

test('known arguments complete case-insensitively with canonical values', () => {
  const commands = registerPortalCommands(createCommands());
  assert.deepEqual(commands.complete('/graphics Pot'), ['/graphics Potato']);
  assert.deepEqual(commands.complete('/GRAPHICS pot'), ['/graphics Potato']);
  assert.deepEqual(commands.complete('/graphics '), Object.keys(presets).map(value => '/graphics ' + value));
  assert.deepEqual(commands.complete('/set '), Object.keys(settingRules).map(value => '/set ' + value));
  assert.deepEqual(commands.complete('/set fpsl'), ['/set fpsLimit']);
  assert.deepEqual(commands.complete('/set ao '), ['true', 'false', 'on', 'off'].map(value => '/set ao ' + value));
  assert.deepEqual(commands.complete('/set fog h'), ['/set fog high']);
  assert.deepEqual(commands.complete('/set fpsLimit '), ['unlimited', '30', '60', '120'].map(value => '/set fpsLimit ' + value));
  assert.deepEqual(commands.complete('/gamemode c'), ['/gamemode creative']);
  assert.deepEqual(commands.complete('/time n'), ['/time noon', '/time night']);
  assert.deepEqual(commands.complete('/dimension over'), ['/dimension overworld']);
  assert.deepEqual(commands.complete('/portal n'), ['/portal nether']);
  assert.deepEqual(commands.complete('/help gra'), ['/help graphics']);
  assert.deepEqual(commands.complete('/setblock ~ ~ ~ sto'), ['/setblock ~ ~ ~ stone']);
  assert.deepEqual(commands.complete('/fill 0 1 2 3 4 5 sto'), ['/fill 0 1 2 3 4 5 stone']);
  assert.deepEqual(commands.complete('/give sto'), ['/give stone']);
  assert.deepEqual(commands.complete('/give stone 9'), ['/give stone 9']);
  assert.deepEqual(commands.complete('/set\tao\tf'), ['/set ao false']);
  for (const input of ['/set missing ', '/set distance ', '/set ao perhaps', '/set ao true ', '/give stone 1 extra']) {
    assert.deepEqual(commands.complete(input), [], input);
  }
});

test('registered completion providers receive only previous arguments', () => {
  const registry = new CommandRegistry();
  registry.register('example', '/example <key> <value>', '', () => '', previous => {
    assert.deepEqual(previous, ['key']);
    return ['Value', 'Other'];
  });
  assert.deepEqual(registry.complete('/example key v'), ['/example key Value']);
});
