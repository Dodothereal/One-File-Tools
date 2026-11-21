export function raycast(origin, direction, reach, accepts) {
  const cell = origin.map(Math.floor);
  const sign = direction.map(Math.sign);
  const delta = direction.map(n => n === 0 ? Infinity : Math.abs(1 / n));
  const edges = cell.map((n, i) => direction[i] === 0 ? Infinity :
    (n + (sign[i] > 0 ? 1 : 0) - origin[i]) / direction[i]);
  let distance = 0, adjacent = null;
  while (distance <= reach) {
    if (accepts(...cell)) return { block: cell, adjacent, distance };
    const i = edges[0] <= edges[1] && edges[0] <= edges[2] ? 0 : edges[1] <= edges[2] ? 1 : 2;
    adjacent = cell.slice();
    distance = edges[i];
    edges[i] += delta[i];
    cell[i] += sign[i];
  }
  return null;
}
