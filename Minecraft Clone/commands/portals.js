import { buildPortal } from '../world/portals.js';

export function registerPortalCommands(registry) {
  registry.register('portal', '/portal <nether|end|city>', 'Build a portal in front of you', ([kind], game) => buildPortal(game, kind));
  return registry;
}
