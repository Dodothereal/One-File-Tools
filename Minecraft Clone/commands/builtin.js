import { CommandRegistry } from './registry.js';
import { blocks } from '../world/blocks.js';
import { dimensions } from '../world/dimensions.js';

export function createCommands(registry = new CommandRegistry()) {
  registry.register('help', '/help [command]', 'List commands or get usage', ([name]) => {
    if (!name) return [...registry.commands.values()].map(command => command.usage).join('\n');
    const command = registry.commands.get(name.replace(/^\//, ''));
    return command ? `${command.usage} — ${command.description}` : 'Unknown command.';
  });
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
  });
  registry.register('time', '/time <day|noon|sunset|night|ticks>', 'Set the world clock (0–23999)', ([value], game) => {
    const times = { day: 1000, noon: 6000, sunset: 12000, night: 18000 };
    const ticks = Object.hasOwn(times, value) ? times[value] : Number(value);
    if (!value || !Number.isFinite(ticks) || ticks < 0 || ticks >= 24000) return 'Usage: /time <day|noon|sunset|night|0–23999>';
    game.time = ticks / 24000;
    return `Time set to ${value}.`;
  });
  registry.register('dimension', '/dimension <id>', 'Travel to a registered dimension', ([id], game) => {
    if (!id) return 'Dimensions: ' + [...dimensions.values()].map(d => d.id + (d.create ? '' : ' (not yet playable)')).join(', ');
    const dimension = dimensions.get(id);
    if (!dimension) return `Unknown dimension: ${id}.`;
    if (!dimension.create) return `${dimension.name} is registered but not yet playable.`;
    game.enterDimension(dimension);
    return `Entered ${dimension.name}.`;
  });
  registry.register('give', '/give <block> [slot]', 'Put a block in your hotbar (slots 1–9)', ([key, slot], game) => {
    const block = blocks.find(b => b.key === key || String(b.id) === key);
    if (!block?.id || !block.solid || block.unbreakable) {
      return 'Available blocks: ' + blocks.filter(b => b.solid && !b.unbreakable).map(b => b.key).join(', ');
    }
    const index = slot === undefined ? game.player.slot : Number(slot) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= 9) return 'Slot must be from 1 to 9.';
    game.player.hotbar[index] = block.id;
    return `Added ${block.name} to slot ${index + 1}.`;
  });
  registry.register('seed', '/seed', 'Show the current world seed', (_, game) => `World seed: ${game.world.seed}`);
  return registry;
}
