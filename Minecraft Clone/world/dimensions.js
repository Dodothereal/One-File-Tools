import { createOverworld } from './overworld.js';
import { createNether } from './nether.js';
import { createEnd } from './end.js';
import { createCity } from './city.js';

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
registerDimension('end', {
  name: 'End', create: createEnd, spawn: [18, 0],
  sky: [.025, .015, .055], zenith: [.012, .008, .03], fog: [.075, .035, .12],
  daylight: .22, clouds: false,
});
registerDimension('city', {
  name: 'City', create: createCity, spawn: [10, 12],
  sky: [.43, .30, .46], zenith: [.12, .16, .32], fog: [.22, .20, .31], clouds: true,
});
