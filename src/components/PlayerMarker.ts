import type { Player } from '../types/game';

/** Builds the DOM element MapLibre uses for the player marker. */
export function createPlayerMarkerElement(player: Pick<Player, 'name' | 'color'>): HTMLElement {
  const el = document.createElement('div');
  el.className = 'player-marker';
  el.style.setProperty('--player-color', player.color);
  el.innerHTML = `
    <div class="player-marker__ring"></div>
    <svg class="player-marker__body" viewBox="0 0 32 40" aria-hidden="true">
      <ellipse cx="16" cy="37" rx="9" ry="2.5" fill="rgba(0,0,0,0.35)"/>
      <rect x="9" y="15" width="14" height="14" rx="4" fill="var(--player-color)" stroke="#14171f" stroke-width="2"/>
      <rect x="10" y="28" width="5" height="8" rx="2" fill="#2b3245" stroke="#14171f" stroke-width="2"/>
      <rect x="17" y="28" width="5" height="8" rx="2" fill="#2b3245" stroke="#14171f" stroke-width="2"/>
      <circle cx="16" cy="9" r="7" fill="#f3c9a0" stroke="#14171f" stroke-width="2"/>
      <path d="M9 8 Q16 0 23 8 Z" fill="#3a7bd5" stroke="#14171f" stroke-width="2"/>
      <circle cx="13.5" cy="10" r="1.2" fill="#14171f"/>
      <circle cx="18.5" cy="10" r="1.2" fill="#14171f"/>
    </svg>
    <div class="player-marker__name"></div>
  `;
  el.querySelector('.player-marker__name')!.textContent = player.name;
  return el;
}
