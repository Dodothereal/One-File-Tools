export function frameTime(at, previous, limit) {
  if (!limit || previous === undefined) return at;
  const interval = 1000 / limit;
  const next = previous + interval;
  if (at < next - .5) return undefined;
  return at - next >= interval ? at : next;
}
