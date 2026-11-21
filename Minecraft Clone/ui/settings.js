const quality = (distance, detail, scale, clouds, ao, fog, water, post, fpsLimit, budget) =>
  ({ distance, detail, scale, clouds, ao, fog, water, post, fpsLimit, budget });
export const presets = {
  Potato: quality(4, 1, .5, false, false, 'low', false, false, 60, 2),
  Low: quality(6, 2, .65, false, false, 'low', false, false, 60, 3),
  Balanced: quality(10, 3, .85, true, true, 'high', true, true, 60, 4),
  High: quality(16, 4, 1, true, true, 'high', true, true, 120, 4),
  Ultra: quality(32, 5, 1, true, true, 'high', true, true, 0, 5),
  'Ultra++': quality(64, 6, 1, true, true, 'high', true, true, 0, 5),
};
export const graphicsKeys = Object.keys(presets.Balanced);
export const settingRules = {
  distance: [2, 64, 1], detail: [1, 7, 1], scale: [.5, 1, .05],
  fov: [60, 105, 1], sensitivity: [.25, 3, .05], budget: [1, 12, .5],
  clouds: 'boolean', ao: 'boolean', water: 'boolean', post: 'boolean', overlay: 'boolean',
  fog: ['low', 'high'], fpsLimit: [0, 30, 60, 120],
};

const KEY = 'minecraft-clone.graphics.v2';
const defaults = { ...presets.Balanced, preset: 'Balanced', fov: 78, sensitivity: 1, overlay: false };

export function normalizeSettings(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  const selected = Object.hasOwn(presets, raw.preset) ? raw.preset
    : Object.hasOwn(presets, raw.basePreset) ? raw.basePreset : 'Balanced';
  const fallback = { ...defaults, ...presets[selected] };
  const result = { preset: selected, basePreset: selected };
  for (const [key, rule] of Object.entries(settingRules)) {
    const value = raw[key];
    if (rule === 'boolean') result[key] = typeof value === 'boolean' ? value : fallback[key];
    else if (key === 'fog' || key === 'fpsLimit') result[key] = rule.includes(value) ? value : fallback[key];
    else {
      result[key] = typeof value === 'number' && Number.isFinite(value)
        ? Math.min(rule[1], Math.max(rule[0], value)) : fallback[key];
      if (key === 'distance' || key === 'detail') result[key] = Math.round(result[key]);
    }
  }
  result.preset = graphicsKeys.every(key => result[key] === presets[selected][key]) ? selected : 'Custom';
  return result;
}

export function loadSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem('minecraft-clone.graphics.v1')));
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
}
