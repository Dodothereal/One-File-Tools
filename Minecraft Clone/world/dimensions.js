import { createOverworld } from './overworld.js';

export const dimensions = new Map();

export function registerDimension(id, definition) {
  dimensions.set(id, { id, ...definition });
}

registerDimension('overworld', { name: 'Overworld', create: createOverworld, sky: [0.53, 0.73, 0.89] });
registerDimension('nether', { name: 'Nether' });
registerDimension('end', { name: 'End' });
registerDimension('city', { name: 'City' });
