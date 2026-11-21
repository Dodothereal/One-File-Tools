import { createOverworld } from './overworld.js';
import { createNether } from './nether.js';

export const dimensions = new Map();

export function registerDimension(id, definition) {
  dimensions.set(id, { id, ...definition });
}

registerDimension('overworld', { name: 'Overworld', create: createOverworld, sky: [0.53, 0.73, 0.89] });
registerDimension('nether', {
  name: 'Nether', create: createNether, spawn: [0, 0],
  sky: [.25, .035, .025], zenith: [.12, .015, .02], fog: [.18, .025, .018],
  daylight: .18, clouds: false,
});
registerDimension('end', { name: 'End' });
registerDimension('city', { name: 'City' });
