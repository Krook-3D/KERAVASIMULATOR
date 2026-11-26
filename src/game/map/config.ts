import type { StyleSpecification } from 'maplibre-gl';
import type { LngLat } from '../../types/game';

/** Kerava railway station, the default spawn point. */
export const KERAVA_STATION: LngLat = [25.1037, 60.4044];

/** Rough bounding box of Kerava: [[west, south], [east, north]]. */
export const KERAVA_BOUNDS: [LngLat, LngLat] = [
  [25.03, 60.37],
  [25.18, 60.45],
];

export const MAP_ZOOM = { initial: 15.5, min: 12.5, max: 18.5 };

/**
 * OpenStreetMap raster tiles. Fine for development; switch to an own or
 * commercial tile service before a public launch (OSM tile usage policy).
 */
export const BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
      paint: {
        // Nudge the map towards a game-world look instead of a navigator.
        'raster-saturation': -0.35,
        'raster-contrast': 0.08,
        'raster-brightness-max': 0.92,
      },
    },
  ],
};
