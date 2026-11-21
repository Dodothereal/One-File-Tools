export function hash(seed, x, z, y = 0) {
  let n = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(y, 1103515245);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const smooth = t => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;

export function noise(seed, x, z, y = 0) {
  const a = Math.floor(x), b = Math.floor(z), c = Math.floor(y);
  const u = smooth(x - a), v = smooth(z - b), w = smooth(y - c);
  const plane = k => mix(
    mix(hash(seed, a, b, k), hash(seed, a + 1, b, k), u),
    mix(hash(seed, a, b + 1, k), hash(seed, a + 1, b + 1, k), u), v,
  );
  return w === 0 ? plane(c) : mix(plane(c), plane(c + 1), w);
}
