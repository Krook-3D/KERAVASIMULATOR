import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LngLat, Player } from '../types/game';
import { BASE_STYLE, KERAVA_BOUNDS, MAP_ZOOM } from '../game/map/config';
import { isInsideBounds, lerpLngLat, travelDurationMs } from '../game/map/movement';
import { createPlayerMarkerElement } from './PlayerMarker';

interface GameMapProps {
  player: Player;
  onMove: (position: LngLat) => void;
}

export function GameMap({ player, onMove }: GameMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: player.position,
      zoom: MAP_ZOOM.initial,
      minZoom: MAP_ZOOM.min,
      maxZoom: MAP_ZOOM.max,
      maxBounds: KERAVA_BOUNDS,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const playerEl = createPlayerMarkerElement(player);
    const playerMarker = new maplibregl.Marker({ element: playerEl, anchor: 'bottom' })
      .setLngLat(player.position)
      .addTo(map);

    const targetEl = document.createElement('div');
    targetEl.className = 'target-marker';
    const targetMarker = new maplibregl.Marker({ element: targetEl });

    let current: LngLat = player.position;
    let frame = 0;

    const walkTo = (target: LngLat) => {
      cancelAnimationFrame(frame);
      const from = current;
      const duration = Math.max(250, travelDurationMs(from, target));
      const start = performance.now();
      playerEl.classList.add('is-walking');
      playerEl.classList.toggle('is-facing-left', target[0] < from[0]);
      targetMarker.setLngLat(target).addTo(map);

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        current = lerpLngLat(from, target, t);
        playerMarker.setLngLat(current);
        if (t < 1) {
          frame = requestAnimationFrame(step);
        } else {
          playerEl.classList.remove('is-walking');
          targetMarker.remove();
          onMoveRef.current(target);
        }
      };
      frame = requestAnimationFrame(step);
    };

    map.on('click', (e) => {
      const target: LngLat = [e.lngLat.lng, e.lngLat.lat];
      if (isInsideBounds(target, KERAVA_BOUNDS)) walkTo(target);
    });

    return () => {
      cancelAnimationFrame(frame);
      map.remove();
    };
    // The map is created once; player updates flow through the marker.
  }, []);

  return <div ref={containerRef} className="game-map" />;
}
