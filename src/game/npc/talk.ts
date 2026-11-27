import type { Npc, NpcKind } from './population';
import { CREWS } from './population';

/**
 * What NPCs shout as you pass and what they say when you talk to them.
 * Every conversation branches 2–3 ways; the choice steers where it goes and
 * what it costs or gives (karma, money, Hustlaus XP, a bruise or a tip).
 */
export const BARKS: Record<NpcKind, string[]> = {
  crew: [
    'Osta ykkönen!', 'Wallah billahi, en valehtele!', 'Dillah allahi, se on fakta.', 'Mitä sä kyttäät?', 'Bro, chillaa vähän.',
    'Jäbä, onks sul röökii?', 'Täh, ootsä kyttä vai?', 'Läpällä vaan bro.', 'Siisti fitti, mistä sait?', 'Yalla yalla, painu!',
    'Se on vitun lit.', 'Ei oo mun ongelma.', 'Mä vannon, mä en ollu siellä.', 'Wallah, toi on sairas.', 'Mitä sä tuijotat?',
    'Bro, sä näytät ihan siviilikytältä.', 'Ihan sama, hei.', 'Mennään Prismalle chillaa.', 'Nou stress, nou stress.', 'Ookoo ookoo.',
  ],
  citizen: ['Huomenta!', 'Onpa taas liukasta.', 'Missähän se bussi viipyy…', 'Kerava on kyllä kasvanut.', 'Pitää muistaa ostaa maitoa.', 'Moi moi.', 'Kiire, kiire.', 'Taas sataa.'],
  family: ['Tule nyt, ei jäädä tähän.', 'Pidä kädestä kiinni.', 'Kotona sitten syödään.', 'Muistitko pipon?'],
  jogger: ['Huh huh…', 'Vielä kolme kilsaa…', 'Sori, tilaa!', 'Hyvä fiilis!'],
  elder: ['Ennen oli paremmin.', 'Nuoriso nykyään…', 'Hyvää päivänjatkoa.', 'Onkohan apteekki auki?'],
  kid: ['Äiti, mä haluun jäätelöä!', 'Isi, kato!', 'Mä oon nopein!', 'Onks toi poliisi?'],
};

export interface TalkEffect {
  karma?: number;
  money?: number;
  health?: number;
  hustlingXp?: number;
  /** Shown as a toast afterwards. */
  toast?: string;
}

export interface TalkOption {
  text: string;
  /** Next node id in the same tree. */
  next?: string;
  /** Ends the talk with this last line from the NPC. */
  reply?: string;
  effect?: TalkEffect;
  /** Needs Hustlaus at least this level; otherwise `failReply` + `failEffect`. */
  hustle?: number;
  failReply?: string;
  failEffect?: TalkEffect;
}

export interface TalkNode {
  text: string;
  options: TalkOption[];
}

export type TalkTree = Record<string, TalkNode> & { start: TalkNode };

const crewTrees = (crewName: string, area: string): TalkTree[] => [
  {
    start: {
      text: `Ey, sä et oo täältä. Tää on ${crewName}n mesta. Mitä sä haluut?`,
      options: [
        { text: 'Chillaa bro, mä vaan kävelen ohi.', next: 'chill' },
        { text: 'Mä etin hommia. Tiedätteks jotain?', next: 'work' },
        { text: 'Teidän mesta? Ei täällä oo kenenkään mestoja.', next: 'tough' },
      ],
    },
    chill: {
      text: 'Okei okei. Wallah, sä vaikutat ihan fiksulta. Kävele vaan.',
      options: [
        { text: 'Respect.', reply: 'Respect, jäbä.', effect: { hustlingXp: 8 } },
        { text: 'Onks täällä mitään kivaa tekemistä?', next: 'tip' },
      ],
    },
    tip: {
      text: `Dillah allahi, kuulin et metsässä Talman päässä on jotain kiiltävää maassa. Joku hukkas sinne jotain arvokasta.`,
      options: [
        { text: 'Kiitti vinkistä.', reply: 'Muista kuka kerto.', effect: { hustlingXp: 10, toast: '💡 Vinkki: Talman metsissä on harvinaisia löytöjä.' } },
        { text: 'Miks sä kerrot mulle?', reply: 'Koska mä en jaksa kävellä sinne. Yalla.' },
      ],
    },
    work: {
      text: `Hommia? ${area}ssa hommia saa vaan jos joku takaa sut. Kuka sut takaa?`,
      options: [
        { text: '[Hustlaus 5] Mä tunnen Laituri-Lassen.', hustle: 5, reply: 'Ai Lassen? No miks et heti sanonu. Tuu myöhemmin, puhutaan.', effect: { hustlingXp: 25, toast: '🤝 Jengi muistaa sinut.' }, failReply: 'Joo joo, ja mä tunnen presidentin. Painu.', failEffect: { hustlingXp: 4 } },
        { text: 'Ei kukaan. Mä oon oma itteni.', reply: 'Sit sä oot ei-kukaan täällä. Kasva ensin.', effect: { hustlingXp: 4 } },
      ],
    },
    tough: {
      text: 'Mitä sä sanoit? Toista se.',
      options: [
        { text: 'Sori, huono vitsi.', reply: 'Niin olikin. Häivy.', effect: { hustlingXp: 2 } },
        { text: 'Kuulit kyllä.', reply: '*Tönäisee sinut maahan* Ei tänne tulla aukomaan.', effect: { health: -8, toast: '🤕 Sait tönäisyn. −8 HP' } },
        { text: '[Hustlaus 8] Rauhottukaa. Mä en oo kenenkään puolella.', hustle: 8, reply: 'Hmm. Sulla on munaa. Okei, mee.', effect: { hustlingXp: 30 }, failReply: '*Nauraa* Joo varmaan. Mee ny vaan.', failEffect: { hustlingXp: 5 } },
      ],
    },
  },
  {
    start: {
      text: 'Osta ykkönen? Halvalla. Wallah billahi, paras laatu koko Keravalla.',
      options: [
        { text: 'Ei kiitos, mä en käytä.', reply: 'Okei, okei. Ei paineita, bro.', effect: { karma: 1 } },
        { text: 'Mitä se on?', next: 'what' },
        { text: 'Mä voin soittaa poliisit.', next: 'snitch' },
      ],
    },
    what: {
      text: '"Kerava Kush", bro. Ei kysytä enempää. Kakskyt euroo. Mut sä näytät vähän kytältä.',
      options: [
        { text: 'Kyttä? Mä? En todellakaan.', reply: 'Joo joo. Tuu takas kun oot varma, nyt ei oo tavaraa mukana.', effect: { hustlingXp: 6 } },
        { text: 'Unohda koko juttu.', reply: 'Mitä juttua? Ei mitään juttua ollu.', effect: { karma: 1 } },
      ],
    },
    snitch: {
      text: 'Soita vaan. Ei täällä mitään oo. Dillah allahi, puhdas kuin pulmunen.',
      options: [
        { text: 'Hyvä niin.', reply: 'Ja sä et nähny mitään.', effect: { karma: 2 } },
        { text: 'Katsotaan mitä ne sanoo.', reply: '*Koko porukka häipyy kulman taakse*', effect: { karma: 3 } },
      ],
    },
  },
  {
    start: {
      text: 'Bro bro bro! Lainaa vitonen, mä maksan huomenna. Wallah.',
      options: [
        { text: 'Tässä, ota. (−5 €)', reply: 'Legenda! Sä oot oikee jäbä.', effect: { money: -5, karma: 3, hustlingXp: 4 } },
        { text: 'Mulla ei oo itellänikään.', reply: 'Sama, bro. Sama.' },
        { text: '[Hustlaus 3] Sä oot mulle jo velkaa.', hustle: 3, reply: 'Täh? …Okei okei, tässä kaks euroo, älä kerro kellekään.', effect: { money: 2, hustlingXp: 15 }, failReply: 'Mitä sä selität? Mä en oo ikinä nähny sua.', failEffect: { hustlingXp: 3 } },
      ],
    },
  },
];

const citizenTrees: TalkTree[] = [
  {
    start: {
      text: 'Anteeksi, tiedätkö missä täällä on lähin bussipysäkki?',
      options: [
        { text: 'Tuolla päin, ihan lähellä. Näytän.', reply: 'Kiitos tosi paljon! Hyvää päivänjatkoa.', effect: { karma: 3 } },
        { text: 'En tiedä, sori.', reply: 'Ei se mitään, kysyn joltain muulta.' },
        { text: 'Kympillä kerron.', next: 'greedy' },
      ],
    },
    greedy: {
      text: 'Kympillä? Ihanko tosissasi?',
      options: [
        { text: 'Läppä. Tuolla se on.', reply: 'Hah, säikäytit. Kiitos!', effect: { karma: 2 } },
        { text: '[Hustlaus 6] Ihan tosissani. Aika on rahaa.', hustle: 6, reply: '…No, tässä kaks euroa. Kerro nyt.', effect: { money: 2, karma: -2, hustlingXp: 10 }, failReply: 'Uskomatonta. Kysyn joltain muulta.', failEffect: { karma: -1 } },
      ],
    },
  },
  {
    start: {
      text: 'Päivää. Onpa harmaa ilma taas, vai mitä?',
      options: [
        { text: 'Niin on. Mut kesä tulee kohta.', reply: 'Toivotaan! Mukavaa päivää.', effect: { karma: 1 } },
        { text: 'Mitä täällä Keravalla tapahtuu?', next: 'news' },
      ],
    },
    news: {
      text: 'No, kuulemma asemalla pyörii taas jotain porukkaa iltaisin. Ja Prismaan tuli lisää vartijoita, kun näpistetään niin paljon.',
      options: [
        { text: 'Hyvä tietää.', reply: 'Pidä varasi. Heippa!' },
        { text: 'Vartijoita? Kuinka monta?', reply: 'En tiedä tarkkaan. Mutta kamerat näkevät kaiken, sanotaan.', effect: { toast: '💡 Mitä enemmän varastat putkeen, sitä todennäköisemmin jäät kiinni.' } },
      ],
    },
  },
  {
    start: {
      text: 'Hei, oletko nähnyt pientä mustaa kissaa? Se karkasi aamulla.',
      options: [
        { text: 'En ole, mutta pidän silmät auki.', reply: 'Kiitos! Sen nimi on Pippuri.', effect: { karma: 2 } },
        { text: 'Kissat tulee kyllä kotiin itse.', reply: 'Toivottavasti olet oikeassa…' },
      ],
    },
  },
];

const familyTree: TalkTree = {
  start: {
    text: 'Hei! Ollaan menossa puistoon. Voinko auttaa jotenkin?',
    options: [
      { text: 'Kivan näköinen perhe. Hyvää päivää!', reply: 'Kiitos, samoin sinulle!', effect: { karma: 2 } },
      { text: 'Onko lapsilla jäätelöt jo syöty?', next: 'ice' },
      { text: 'Onko sulla pari euroa lainata?', reply: 'Ei, anteeksi. Mennään, lapset.', effect: { karma: -1 } },
    ],
  },
  ice: {
    text: 'Älä muistuta, ne on kysyneet sitä koko matkan!',
    options: [
      { text: 'Prismasta saa hyvää vaniljaa.', reply: 'Hah, kiitos vinkistä… nyt meidän on pakko mennä sinne.', effect: { karma: 1 } },
      { text: 'Tsemppiä!', reply: 'Kiitos, tarvitaan sitä.' },
    ],
  },
};

const joggerTree: TalkTree = {
  start: {
    text: '*Huohottaa* Joo? Nopeesti, mulla on tempo päällä.',
    options: [
      { text: 'Hyvä vauhti! Jatka vaan.', reply: 'Kiitti! *juoksee*', effect: { karma: 1 } },
      { text: 'Miten pääsee kuntoon?', reply: 'Kuntosali Rauta ja uimahalli. Ja ei herkkuja. Moi!', effect: { toast: '💡 Kuntosali nostaa Voimaa, uinti Kestävyyttä.' } },
    ],
  },
};

const elderTree: TalkTree = {
  start: {
    text: 'Päivää, nuori ihminen. Ennen tässä kohtaa oli vielä peltoa, tiesitkö?',
    options: [
      { text: 'En tiennyt! Kertokaa lisää.', next: 'story' },
      { text: 'Joo joo, kiire on.', reply: 'Kaikilla on kiire nykyään.' },
      { text: 'Tarvitsetteko apua kassien kanssa?', reply: 'Voi kuinka ystävällistä! Kiitos, kyllä pärjään. Tässä, ota pari euroa.', effect: { karma: 4, money: 2 } },
    ],
  },
  story: {
    text: 'Kerava oli pieni kauppala. Asemalla oli sahoja ja tiilitehtaita, ja kaikki tunsivat toisensa. Nyt on niin paljon uusia ihmisiä.',
    options: [
      { text: 'Se on kai hyvä asia?', reply: 'Niin kai. Elämää se on. Hyvää päivänjatkoa.', effect: { karma: 2 } },
      { text: 'Kiitos tarinasta.', reply: 'Kiitos kun kuuntelit.', effect: { karma: 1 } },
    ],
  },
};

const kidTree: TalkTree = {
  start: {
    text: 'Ootsä joku julkkis? Sulla on siistit vaatteet!',
    options: [
      { text: 'Joo, ihan kuuluisa.', reply: 'Vau! Saanko nimmarin? …Äiti kutsuu, moi!' },
      { text: 'En oo. Missä sun vanhemmat on?', reply: 'Tossa! *osoittaa* Moikka!', effect: { karma: 1 } },
    ],
  },
};

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/** The conversation an NPC has with you (stable per NPC). */
export function talkTreeFor(npc: Npc): TalkTree {
  const h = hash(npc.id);
  switch (npc.kind) {
    case 'crew': {
      const crew = CREWS.find((c) => c.id === npc.crew);
      const trees = crewTrees(crew?.name ?? 'jengi', crew?.area ?? 'Kerava');
      return trees[h % trees.length]!;
    }
    case 'citizen':
      return citizenTrees[h % citizenTrees.length]!;
    case 'family':
      return familyTree;
    case 'jogger':
      return joggerTree;
    case 'elder':
      return elderTree;
    case 'kid':
      return kidTree;
  }
}

export function speakerName(npc: Npc): string {
  if (npc.kind === 'crew') return `${npc.name} · ${CREWS.find((c) => c.id === npc.crew)?.name ?? 'jengi'}`;
  return npc.name;
}
