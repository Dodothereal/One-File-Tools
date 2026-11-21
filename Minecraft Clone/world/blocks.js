export const blocks = [];
export const tiles = [];

export function registerTile(colors, pattern = 'grain') {
  return tiles.push({ colors, pattern }) - 1;
}

export function registerBlock(key, name, texture, properties = {}) {
  if (blocks.some(block => block.key === key) || blocks.length === 256) {
    throw new Error(`Cannot register block: ${key}`);
  }
  const id = blocks.length;
  blocks.push({ id, key, name, texture, solid: true, ...properties });
  return id;
}

const grassTop = registerTile(['#7d9c3e', '#a2bf54', '#657f35', '#8dac45']);
const earth = registerTile(['#79543b', '#93694a', '#6d4c37', '#a2754d']);
const grassSide = registerTile(['#79543b', '#93694a', '#6d4c37', '#a2754d'], 'grass');
const stone = registerTile(['#7e8287', '#8e9296', '#6d7276', '#939597']);
const sand = registerTile(['#dbbe83', '#dfc88d', '#e9d29c', '#cbb278']);
const bark = registerTile(['#60442d', '#795633', '#4b3525', '#936b43'], 'bark');
const rings = registerTile(['#ad8551', '#c39761', '#8b6240', '#dbad6c'], 'rings');
const leaves = registerTile(['#426b35', '#578442', '#36582e', '#72964b']);
const water = registerTile(['#337bae', '#4b9bc0', '#2773a5', '#418ab4'], 'water');
const bedrock = registerTile(['#303234', '#4b4b4f', '#5c5d62', '#29292c']);
const brick = registerTile(['#b86b53', '#cb8164', '#804b41', '#deb19a'], 'brick');
const prism = registerTile(['#297d75', '#5caf98', '#26675f', '#96dbc1'], 'brick');
const snow = registerTile(['#dcecf3', '#e9f6f8', '#cadfe9', '#f5faff']);

export const AIR = registerBlock('air', 'Air', 0, { solid: false });
export const GRASS = registerBlock('grass', 'Grass', [grassSide, grassTop, earth]);
export const DIRT = registerBlock('dirt', 'Dirt', earth);
export const STONE = registerBlock('stone', 'Stone', stone);
export const SAND = registerBlock('sand', 'Sand', sand);
export const LOG = registerBlock('log', 'Oak log', [bark, rings, rings]);
export const LEAVES = registerBlock('leaves', 'Oak leaves', leaves);
export const WATER = registerBlock('water', 'Water', water, { solid: false, liquid: true });
export const BEDROCK = registerBlock('bedrock', 'Bedrock', bedrock, { unbreakable: true });
export const BRICK = registerBlock('terracotta_brick', 'Terracotta brick', brick);
export const PRISM = registerBlock('verdigris', 'Verdigris tile', prism);
export const SNOW = registerBlock('snow', 'Snow', snow);

export function faceTile(id, face) {
  const { texture } = blocks[id];
  return Array.isArray(texture) ? texture[face === 2 ? 1 : face === 3 ? 2 : 0] : texture;
}
