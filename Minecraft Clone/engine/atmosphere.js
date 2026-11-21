const mix = (a, b, t) => a.map((n, i) => n + (b[i] - n) * t);

export function atmosphere(dimension, settings, daylight, underwater = false) {
  if (underwater) {
    const fog = mix([.015, .06, .10], [.035, .25, .32], daylight);
    return { horizon: fog, zenith: fog, fog, fogRange: [0, 24], stars: false, sun: false };
  }
  const horizon = mix([.06, .09, .16], dimension.sky ?? [.53, .73, .89], daylight);
  const zenith = mix([.015, .025, .08], dimension.zenith ?? [.18, .42, .69], daylight);
  const fog = dimension.fog ?? horizon;
  const distance = dimension.enclosed
    ? Math.min(settings.distance, settings.detail) * 16
    : settings.distance * 16;
  return {
    horizon: dimension.enclosed ? fog : horizon,
    zenith: dimension.enclosed ? fog : zenith,
    fog, fogRange: [distance * .60, distance],
    stars: dimension.stars !== false,
    sun: dimension.sun !== false,
  };
}
