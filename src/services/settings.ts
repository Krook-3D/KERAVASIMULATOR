/** Per-device settings (not part of the save file). */
const GFX_KEY = 'kerava-sim:gfx';

export type GraphicsQuality = 'high' | 'low';

export function loadGraphicsQuality(): GraphicsQuality {
  try {
    return localStorage.getItem(GFX_KEY) === 'low' ? 'low' : 'high';
  } catch {
    return 'high';
  }
}

export function saveGraphicsQuality(q: GraphicsQuality): void {
  try {
    localStorage.setItem(GFX_KEY, q);
  } catch {
    // ignore
  }
}
