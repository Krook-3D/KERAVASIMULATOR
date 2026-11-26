/**
 * Opening cutscene: the player arrives by commuter train without a ticket and
 * gets thrown out onto the Kerava platform. Times are on the train clock
 * (seconds since the scene started), see trainSchedule.ts.
 */
export interface IntroLine {
  from: number;
  to: number;
  speaker: 'narrator' | 'inspector' | 'player';
  text: string;
}

export const INTRO_LINES: IntroLine[] = [
  { from: 0.5, to: 9.5, speaker: 'narrator', text: 'Lähijuna saapuu Keravan asemalle.' },
  { from: 11.8, to: 13.8, speaker: 'inspector', text: 'Lipuntarkastus. Lippu tai matkakortti, kiitos.' },
  { from: 13.8, to: 15.7, speaker: 'player', text: 'Lippu? Joo… se on tässä jossain… toisen takin taskussa.' },
  { from: 15.7, to: 17.6, speaker: 'inspector', text: 'Ei lippua, ei kyytiä. Tervetuloa Keravalle!' },
  { from: 18.6, to: 21.4, speaker: 'player', text: 'Voihan vittu.' },
];

export const INTRO_TIMES = {
  playerAppears: 11.5,
  throwStart: 17.0,
  throwEnd: 17.75,
  standUp: 19.0,
  stoodUp: 19.6,
  end: 21.5,
};

export const INSPECTOR_NAME = 'Lipuntarkastaja';

export function lineAt(t: number): IntroLine | null {
  return INTRO_LINES.find((l) => t >= l.from && t < l.to) ?? null;
}
