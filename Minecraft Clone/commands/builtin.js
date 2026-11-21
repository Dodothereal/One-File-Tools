import { CommandRegistry } from './registry.js';
import { AIR, blocks, dimensionBlocks } from '../world/blocks.js';
import { dimensions } from '../world/dimensions.js';
import { lightNetherFrames } from '../world/portals.js';
import { HEIGHT } from '../world/world.js';
import { presets, settingRules } from '../ui/settings.js';

const invalid = message => { throw new SyntaxError(message); };
const numeric = (arg, low, high) => {
  const value = arg === undefined || arg.trim() === '' ? NaN : Number(arg);
  if (!Number.isFinite(value) || value < low || value > high) invalid(`Expected a number from ${low} to ${high}.`);
  return value;
};
export function coordinates(args, position) {
  if (args.length !== 3) invalid('Expected three coordinates.');
  return args.map((arg, i) => {
    const relative = arg.startsWith('~');
    const value = relative && arg === '~' ? 0 : numeric(relative ? arg.slice(1) : arg, -3e7, 3e7);
    const result = value + (relative ? position[i] : 0);
    if (Math.abs(result) > 3e7) invalid('Coordinates out of range.');
    return Math.floor(result);
  });
}

export function createCommands(registry = new CommandRegistry()) {
  const change = (game, changes) => game.ui.setSettings(changes);
  registry.register('graphics', '/graphics [preset]', 'List or apply graphics presets', (args, game) => {
    if (!args.length) return 'Graphics: ' + Object.keys(presets).join(', ');
    const name = Object.keys(presets).find(key => key.toLowerCase() === args.join(' ').toLowerCase());
    if (!name) invalid('Unknown graphics preset.');
    change(game, { ...presets[name], preset: name });
    return `Graphics set to ${name}.`;
  }, args => args.length ? [] : Object.keys(presets));
  registry.register('set', '/set <option> <value>', 'Set any graphics or camera option', ([key, raw, ...extra], game) => {
    if (!Object.hasOwn(settingRules, key ?? '') || raw === undefined || extra.length) invalid('Options: ' + Object.keys(settingRules).join(', '));
    const rule = settingRules[key];
    let value;
    if (rule === 'boolean') {
      if (!['true','false','on','off'].includes(raw)) invalid('Expected true/false or on/off.');
      value = raw === 'true' || raw === 'on';
    } else if (key === 'fog') {
      if (!rule.includes(raw)) invalid('Expected low or high.');
      value = raw;
    } else if (key === 'fpsLimit') {
      value = raw === 'unlimited' ? 0 : numeric(raw, 0, 120);
      if (!rule.includes(value)) invalid('Expected 30, 60, 120 or unlimited.');
    } else {
      value = numeric(raw, rule[0], rule[1]);
      if (['distance','detail'].includes(key) && !Number.isInteger(value)) invalid('Expected a whole number.');
    }
    change(game, { [key]: value });
    return `${key} = ${value}`;
  }, args => {
    if (!args.length) return Object.keys(settingRules);
    if (args.length !== 1) return [];
    const rule = settingRules[args[0]];
    if (rule === 'boolean') return ['true', 'false', 'on', 'off'];
    if (args[0] === 'fog') return rule;
    if (args[0] === 'fpsLimit') return rule.map(value => value === 0 ? 'unlimited' : String(value));
    return [];
  });
  for (const [name,key,low,high] of [['render','distance',2,64],['fov','fov',60,105]]) {
    registry.register(name, `/${name} <${low}-${high}>`, `Set ${key}`, (args, game) => {
      if (args.length !== 1) invalid('Expected one value.');
      const value = numeric(args[0], low, high);
      if (key === 'distance' && !Number.isInteger(value)) invalid('Expected a whole number.');
      change(game, { [key]: value });
      return `${key} = ${value}`;
    });
  }
  for (const name of ['setblock','fill']) {
    registry.register(name, name === 'fill' ? '/fill <x1 y1 z1> <x2 y2 z2> <block>' : '/setblock <x y z> <block>', 'Edit blocks; ~ coordinates supported, fill limit 32768', (args, game) => {
      if (args.length !== (name === 'fill' ? 7 : 4)) invalid('Wrong number of arguments.');
      const block = blocks.find(b => b.key === args.at(-1) || String(b.id) === args.at(-1));
      if (!block) invalid('Unknown block.');
      const first = coordinates(args.slice(0,3), game.player.position);
      const second = name === 'fill' ? coordinates(args.slice(3,6), game.player.position) : first;
      const low = first.map((n,i) => Math.min(n, second[i]));
      const high = first.map((n,i) => Math.max(n, second[i]));
      if (low[1] < 0 || high[1] >= HEIGHT) invalid(`Y must be from 0 to ${HEIGHT-1}.`);
      if (high.reduce((volume,n,i) => volume*(n-low[i]+1),1) > 32768) invalid('Fill exceeds 32768 blocks.');
      let changed = 0;
      const frameEdits = block.id === AIR || block.id === dimensionBlocks.obsidian ? [] : null;
      for (let y=low[1];y<=high[1];y++) for (let z=low[2];z<=high[2];z++) for (let x=low[0];x<=high[0];x++) {
        if (!game.world.set(x,y,z,block.id)) continue;
        changed++;
        frameEdits?.push([x,y,z]);
      }
      if (frameEdits?.length) lightNetherFrames(game.world, frameEdits);
      return `Changed ${changed} blocks.`;
    }, args => args.length === (name === 'fill' ? 6 : 3) ? blocks.map(block => block.key) : []);
  }
  registry.register('speed', '/speed <0.1-5>', 'Set movement speed multiplier', (args, game) => {
    if (args.length !== 1) invalid('Expected one multiplier.');
    game.speed = numeric(args[0], .1, 5);
    return `Speed = ${game.speed}×`;
  });
  registry.register('fly', '/fly', 'Toggle creative flight', (_, game) => {
    if (game.player.mode !== 'creative') invalid('Flight requires creative mode.');
    game.player.flying = !game.player.flying;
    return `Flight ${game.player.flying ? 'on' : 'off'}.`;
  });
  registry.register('pos', '/pos', 'Print coordinates', (_, game) => game.player.position.map(n => n.toFixed(2)).join(', '));
  registry.register('clear', '/clear', 'Clear the console', (_, game) => { document.getElementById('chat-log').replaceChildren(); });
  registry.register('perf', '/perf', 'Toggle performance overlay', (_, game) => {
    change(game, { overlay: !game.settings.overlay });
    return `Performance overlay ${game.settings.overlay ? 'on' : 'off'}.`;
  });
  registry.register('benchmark', '/benchmark', 'Measure average FPS over the next five seconds', (_, game) => {
    game.benchmark = { start: performance.now(), frames: 0 };
    return 'Benchmark running for 5 seconds. Keep the console open to see the result.';
  });
  registry.register('help', '/help [command]', 'List commands or get usage', ([name]) => {
    if (!name) return [...registry.commands.values()].map(command => command.usage).join('\n');
    const command = registry.commands.get(name.replace(/^\//, ''));
    return command ? `${command.usage} — ${command.description}` : 'Unknown command.';
  }, args => args.length ? [] : [...registry.commands.keys()]);
  registry.register('tp', '/tp <x> <y> <z>', 'Teleport; ~ coordinates are relative', (args, game) => {
    if (args.length !== 3) return 'Usage: /tp <x> <y> <z>';
    const target = args.map((arg, i) => arg[0] === '~'
      ? game.player.position[i] + Number(arg.slice(1)) : Number(arg));
    if (target.some(n => !Number.isFinite(n) || Math.abs(n) > 3e7)) return 'Invalid coordinates.';
    game.player.moveTo(target);
    return `Teleported to ${target.map(n => n.toFixed(1)).join(', ')}`;
  });
  registry.register('gamemode', '/gamemode <creative|survival>', 'Set movement and editing mode', ([mode], game) => {
    if (mode !== 'creative' && mode !== 'survival') return 'Usage: /gamemode <creative|survival>';
    game.player.setMode(mode);
    return `Game mode set to ${mode}.`;
  }, args => args.length ? [] : ['creative', 'survival']);
  registry.register('time', '/time <day|noon|sunset|night|ticks>', 'Set the world clock (0–23999)', ([value], game) => {
    const times = { day: 1000, noon: 6000, sunset: 12000, night: 18000 };
    const ticks = Object.hasOwn(times, value) ? times[value] : Number(value);
    if (!value || !Number.isFinite(ticks) || ticks < 0 || ticks >= 24000) return 'Usage: /time <day|noon|sunset|night|0–23999>';
    game.time = ticks / 24000;
    return `Time set to ${value}.`;
  }, args => args.length ? [] : ['day', 'noon', 'sunset', 'night']);
  registry.register('dimension', '/dimension <id>', 'Travel to a registered dimension', ([id], game) => {
    if (!id) return 'Dimensions: ' + [...dimensions.values()].map(d => d.id + (d.create ? '' : ' (not yet playable)')).join(', ');
    const dimension = dimensions.get(id);
    if (!dimension) return `Unknown dimension: ${id}.`;
    if (!dimension.create) return `${dimension.name} is registered but not yet playable.`;
    game.enterDimension(dimension);
    return `Entered ${dimension.name}.`;
  }, args => args.length ? [] : [...dimensions.keys()]);
  registry.register('give', '/give <block> [slot]', 'Put a block in your hotbar (slots 1–9)', ([key, slot], game) => {
    const block = blocks.find(b => b.key === key || String(b.id) === key);
    if (!block?.id || !block.solid || block.unbreakable) {
      return 'Available blocks: ' + blocks.filter(b => b.solid && !b.unbreakable).map(b => b.key).join(', ');
    }
    const index = slot === undefined ? game.player.slot : Number(slot) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= 9) return 'Slot must be from 1 to 9.';
    game.player.hotbar[index] = block.id;
    return `Added ${block.name} to slot ${index + 1}.`;
  }, args => !args.length ? blocks.filter(block => block.id && block.solid && !block.unbreakable).map(block => block.key)
    : args.length === 1 ? Array.from({ length: 9 }, (_, index) => String(index + 1)) : []);
  registry.register('seed', '/seed', 'Show the current world seed', (_, game) => `World seed: ${game.world.seed}`);
  return registry;
}
