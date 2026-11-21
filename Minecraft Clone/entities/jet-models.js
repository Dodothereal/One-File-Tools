import { meshBoxes } from '../engine/mesh.js';
import { registerTile } from '../world/blocks.js';

const colors = {
  silver: ['#afbabd', '#a4afb4', '#c6d3d8'],
  steel: ['#536776', '#5c7585', '#4c5f6c'],
  alloy: ['#4d3d72', '#634e94', '#413360'],
  dark: ['#222f3a', '#2a3c48', '#313747'],
  glass: ['#345e72', '#3e7890', '#58a1b3'],
  red: ['#d85843', '#db624e', '#b64031'],
  amber: ['#ffb154', '#fff1b0', '#ff9661'],
  cyan: ['#63f1ff', '#b9fcff', '#37bded'],
  violet: ['#ab83ff', '#d6baff', '#7651f4'],
  void: ['#302051', '#211333', '#3c1e57'],
};
const materials = Object.fromEntries(Object.entries(colors).map(([key, palette]) => [key, registerTile(palette)]));
const luminous = new Set(['amber', 'cyan', 'violet']);
const box = (x, y, z, w, h, l, paint) => ({
  origin: [x-w/2, y, z-l/2], size: [w,h,l], tile: materials[paint], paint: colors[paint][0], glow: luminous.has(paint),
});
const mirrored = (x, y, z, w, h, l, color) =>
  [box(-x,y,z,w,h,l,color), box(x,y,z,w,h,l,color)];
const sweep = (steps, step, first, advance, chord, taper, color) =>
  Array.from({ length: steps }, (_,i) => mirrored(.55 + (i+.5)*step, -.19, first-i*advance,
    step, .25, chord-i*taper, color)).flat();

export const jets = {
  kestrel: {
    name: 'Kestrel', designation: 'A-07', era: 'Vintage interceptor', accent: '#ffb154',
    description: 'Silver swept wings and tight turns.',
    special: 'Blaze Rocket', payload: 'One heavy rocket. Blasts a small crater.',
    speed: [12, 30, 46], turn: 1.34, cooldown: 2.3, span: 3.45, length: 3.6, seat: 1.35,
    shape: [
      box(0,-.49,-.27,1.34,.98,5.15,'silver'), box(0,-.36,2.49,1.08,.76,1.2,'silver'),
      box(0,-.24,3.23,.63,.49,.74,'red'), box(0,.4,.63,.97,.58,1.63,'glass'),
      box(0,-.36,-2.85,1.04,.78,.55,'dark'), box(0,-.28,-3.13,.66,.62,.18,'amber'),
      ...sweep(5,.57,.06,.31,2.6,.4,'silver'), ...mirrored(3.3,-.165,-1.18,.34,.2,.88,'red'),
      ...mirrored(1,-.08,-2.3,1.24,.22,.96,'silver'),
      box(0,.31,-2.28,.28,1.07,1.12,'silver'), box(0,1.36,-2.52,.29,.25,.63,'red'),
    ],
  },
  wraith: {
    name: 'Wraith', designation: 'M-24', era: 'Modern strike jet', accent: '#63f1ff',
    description: 'Twin engines and a wide delta wing.',
    special: 'Pulse Salvo', payload: 'Three energy bolts sweep a wide strip.',
    speed: [16, 37, 56], turn: 1.11, cooldown: 3, span: 4.15, length: 4.25, seat: 1.9,
    shape: [
      box(0,-.48,-.26,1.7,.95,6.54,'steel'), box(0,-.36,3.34,1.32,.72,1.27,'steel'),
      box(0,-.23,4.02,.72,.43,.48,'dark'), box(0,.44,1.27,.97,.55,1.6,'glass'),
      ...sweep(6,.6,.02,.27,3.87,.52,'steel'), ...mirrored(3.98,-.15,-1.42,.36,.18,.93,'cyan'),
      ...mirrored(1.11,-.36,-1.78,.83,.85,4.03,'dark'),
      ...mirrored(1.11,-.31,-3.91,.57,.65,.23,'cyan'),
      ...mirrored(1.17,.4,-2.49,.32,1.19,1.37,'steel'),
      ...mirrored(1.34,1.52,-2.7,.32,.31,.81,'steel'),
      ...mirrored(2.48,-.45,-.75,.51,.3,1.61,'dark'),
    ],
  },
  eventide: {
    name: 'Eventide', designation: 'X-99', era: 'Future voidcraft', accent: '#c69bff',
    description: 'Split wings and a glowing reactor.',
    special: 'Singularity', payload: 'A gravity well collapses into a deep crater.',
    speed: [19, 46, 68], turn: 1.23, cooldown: 5, span: 4.65, length: 4.6, seat: 1.8,
    shape: [
      box(0,-.44,-.32,1.42,.88,7.55,'alloy'), box(0,-.27,3.79,1.04,.55,1.52,'dark'),
      box(0,-.13,4.46,.44,.25,.24,'violet'), box(0,.41,1.16,.91,.55,1.72,'glass'),
      ...sweep(5,.81,-.23,.53,2.95,.45,'alloy'),
      ...mirrored(3.12,-.17,-2.36,1.8,.22,1.23,'dark'),
      ...mirrored(4.20,-.28,-1.57,.63,.65,3.57,'alloy'),
      ...mirrored(4.20,-.17,-3.41,.43,.40,.16,'violet'),
      ...mirrored(4.20,.365,-1.38,.25,.08,2.84,'violet'),
      ...mirrored(2.00,.08,-1.16,.66,.08,1.94,'violet'),
      ...mirrored(1.23,-.33,-3,.54,.71,2.1,'dark'),
      box(0,-.31,-4.18,1,.64,.22,'violet'),
    ],
  },
};

export function jetMeshes(renderer) {
  return Object.fromEntries(Object.entries(jets).map(([id, jet]) => [id, renderer.upload(meshBoxes(jet.shape))]));
}

export function effectMeshes(renderer) {
  const beam = (color, size, length) => meshBoxes([box(0,-size/2,length/2,size,size,length,color)]);
  const ring = meshBoxes(Array.from({length: 24}, (_,i) => {
    const angle = i * Math.PI / 12;
    return box(Math.cos(angle), Math.sin(angle)-.055, 0, .22,.22,.1,'violet');
  }));
  return Object.fromEntries(Object.entries({
    tracer: beam('amber', .13, 3),
    rocket: meshBoxes([box(0,-.21,0,.42,.42,.95,'red'), box(0,-.095,-.87,.19,.19,1.29,'amber')]),
    pulse: beam('cyan', .26, 2.45),
    well: meshBoxes([box(0,-.48,0,.96,.96,.96,'void'), box(0,.48,0,.59,.08,.59,'violet')]),
    ring,
    spark: meshBoxes([box(0,-.12,0,.24,.24,.24,'amber')]),
    ion: meshBoxes([box(0,-.12,0,.24,.24,.24,'cyan')]),
  }).map(([id, mesh]) => [id, renderer.upload(mesh)]));
}
