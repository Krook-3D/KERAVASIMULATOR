import type { SkillId } from '../types/game';

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  description: string;
}

export const SKILLS: SkillDef[] = [
  { id: 'strength', name: 'Voima', icon: '💪', description: 'Kuntosali, kantaminen ja Aseman Areenan tönäisyt.' },
  { id: 'endurance', name: 'Kestävyys', icon: '🫀', description: 'Pidemmät lenkit, enemmän energiaa, parempi torjunta.' },
  { id: 'running', name: 'Juoksu', icon: '👟', description: 'Nopeampi liikkuminen ja ketterämpi väistö.' },
  { id: 'cooking', name: 'Ruoanlaitto', icon: '🍳', description: 'Raaka-aineista ruokaa, joka palauttaa energiaa.' },
  { id: 'fishing', name: 'Kalastus', icon: '🎣', description: 'Keravanjoen ahvenet ja legendaarinen hauki.' },
];
