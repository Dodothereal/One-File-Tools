export const presets = {
  Potato: { distance: 4, detail: 2, scale: .55, clouds: false },
  Low: { distance: 6, detail: 2, scale: .75, clouds: false },
  Balanced: { distance: 10, detail: 3, scale: .85, clouds: true },
  High: { distance: 16, detail: 4, scale: 1, clouds: true },
  Ultra: { distance: 32, detail: 5, scale: 1, clouds: true },
  'Ultra++': { distance: 64, detail: 6, scale: 1, clouds: true },
};

const KEY = 'minecraft-clone.graphics.v1';
const defaults = { ...presets.Balanced, preset: 'Balanced', fov: 78, sensitivity: 1 };
const within = (value, low, high, fallback) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback;

export function normalizeSettings(raw = {}) {
  return {
    preset: Object.hasOwn(presets, raw.preset) ? raw.preset : defaults.preset,
    distance: Math.round(within(raw.distance, 2, 64, defaults.distance)),
    detail: Math.round(within(raw.detail, 1, 7, defaults.detail)),
    scale: within(raw.scale, .5, 1, defaults.scale),
    fov: within(raw.fov, 60, 105, defaults.fov),
    sensitivity: within(raw.sensitivity, .25, 3, defaults.sensitivity),
    clouds: typeof raw.clouds === 'boolean' ? raw.clouds : defaults.clouds,
  };
}

export function loadSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(KEY)) ?? {});
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
}
