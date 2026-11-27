import type { ItemDef, Rarity } from '../types/game';

/**
 * Item catalogue. Everything is fictional or generic; brand-like names are
 * parodies. `hands` marks items you can hold (1 = either hand, 2 = both).
 */
type Def = Omit<ItemDef, 'id' | 'stackable'> & { stackable?: boolean };

const defs: Record<string, Def> = {
  // ---- quest
  viila: { name: 'Viila', description: 'Pieni metalliviila, leivottu serkun tuomaan pullaan.', category: 'quest', value: 0, rarity: 'uncommon', icon: '🪚', hands: 1 },
  pulla: { name: 'Serkun pulla', description: 'Vähän kova. Nyt tiedät miksi.', category: 'food', value: 1, rarity: 'common', stackable: true, effects: { energy: 10 }, icon: '🥐' },

  // ---- world finds: tools and weapons-ish (held in the hands)
  ruuvimeisseli: { name: 'Ruuvimeisseli', description: 'Ristipää. Avaa ruuveja ja joskus muutakin.', category: 'tool', value: 3, rarity: 'common', hands: 1, icon: '🪛' },
  jakoavain: { name: 'Jakoavain', description: 'Raskas ja luotettava.', category: 'tool', value: 4, rarity: 'common', hands: 1, icon: '🔧' },
  taskulamppu: { name: 'Taskulamppu', description: 'Paristot puoliksi täynnä.', category: 'tool', value: 4, rarity: 'common', hands: 1, icon: '🔦' },
  koysi: { name: 'Köysi', description: 'Kymmenen metriä punottua köyttä.', category: 'tool', value: 5, rarity: 'common', hands: 1, icon: '🪢' },
  ketju: { name: 'Ketju', description: 'Ruosteinen pyöränlukon ketju.', category: 'tool', value: 6, rarity: 'common', hands: 1, icon: '⛓️' },
  spraymaali: { name: 'Spraymaali', description: 'Tölkki mustaa spraymaalia. Graffiteihin.', category: 'tool', value: 6, rarity: 'common', stackable: true, hands: 1, icon: '🎨', price: 7 },
  puukko: { name: 'Puukko', description: 'Perinteinen suomalainen puukko tupessa. Työkalu, ei lelu.', category: 'tool', value: 12, rarity: 'uncommon', hands: 1, icon: '🔪' },
  shankki: { name: 'Shänkki', description: 'Itse teroitettu. Ei kannata jäädä kiinni tämän kanssa.', category: 'tool', value: 8, rarity: 'uncommon', hands: 1, icon: '🗡️' },
  sorkkarauta: { name: 'Sorkkarauta', description: 'Avaa laatikot, ovet ja keskustelut.', category: 'tool', value: 14, rarity: 'uncommon', hands: 1, icon: '🦯' },
  pesapallomaila: { name: 'Pesäpallomaila', description: 'Kotimaisen pesäpallon maila. Lyöntiin tarkoitettu.', category: 'tool', value: 15, rarity: 'uncommon', hands: 2, icon: '🏏' },
  voimapihdit: { name: 'Voimapihdit', description: 'Katkaisee lukot ja ketjut kuin voita.', category: 'tool', value: 35, rarity: 'rare', hands: 2, icon: '✂️' },
  rallakka: { name: 'Rälläkkä', description: 'Akkukäyttöinen kulmahiomakone. Kipinät lentää.', category: 'tool', value: 80, rarity: 'epic', hands: 2, icon: '⚙️' },
  kiikarit: { name: 'Kiikarit', description: 'Hyvä tiedusteluun.', category: 'tool', value: 18, rarity: 'uncommon', hands: 2, icon: '🔭' },
  avainnippu: { name: 'Avainnippu', description: 'Kymmenen avainta. Mihin ne käyvät?', category: 'misc', value: 10, rarity: 'uncommon', icon: '🗝️' },

  // ---- wearables and valuables
  commandopipo: { name: 'Commandopipo', description: 'Musta pipo silmäreiillä. Talvella lämmin, poliisille epäilyttävä.', category: 'equipment', value: 4, rarity: 'common', equipSlot: 'head', icon: '🥷' },
  lippis: { name: 'Lippis', description: 'Lippalakki lippa taaksepäin.', category: 'equipment', value: 3, rarity: 'common', equipSlot: 'head', icon: '🧢' },
  aurinkolasit: { name: 'Aurinkolasit', description: 'Peililinssit. Sisälläkin.', category: 'equipment', value: 9, rarity: 'uncommon', equipSlot: 'accessory', icon: '🕶️' },
  tyomiehenliivi: { name: 'Huomioliivi', description: 'Keltainen huomioliivi. Kukaan ei kysy mitään.', category: 'equipment', value: 6, rarity: 'uncommon', equipSlot: 'body', icon: '🦺' },
  kultaketju: { name: 'Kultaketju', description: 'Paksu kaulaketju. Aito? Ehkä.', category: 'collectible', value: 120, rarity: 'rare', equipSlot: 'accessory', icon: '📿' },
  hopearasia: { name: 'Hopeinen savukerasia', description: 'Kaiverrettu nimikirjaimin "E.K."', category: 'collectible', value: 60, rarity: 'rare', icon: '🚬' },
  nokka3310: { name: 'Nokka 3310', description: 'Vanha kännykkä, akku kestää viikon. Kerääjien himoitsema.', category: 'collectible', value: 70, rarity: 'rare', icon: '📱' },
  timanttisormus: { name: 'Timanttisormus', description: 'Joku etsii tätä varmasti.', category: 'collectible', value: 400, rarity: 'epic', icon: '💍' },
  kultakello: { name: 'Kultainen Rolux', description: 'Kultainen rannekello. Painava, kiiltävä ja täysin hillitön.', category: 'collectible', value: 1500, rarity: 'legendary', equipSlot: 'accessory', icon: '⌚' },
  kultaharkko: { name: 'Kultaharkko', description: 'Mistä tämä on tänne tullut?', category: 'collectible', value: 2500, rarity: 'legendary', icon: '🥇' },

  // ---- junk
  tolkki: { name: 'Tyhjä tölkki', description: 'Pantti 15 senttiä.', category: 'misc', value: 0.15, rarity: 'common', stackable: true, icon: '🥫' },
  pullo: { name: 'Pantillinen pullo', description: 'Pantti 40 senttiä.', category: 'misc', value: 0.4, rarity: 'common', stackable: true, icon: '🍾' },
  kebabkuponki: { name: 'Kebab-kuponki', description: '"Toinen rulla puoleen hintaan." Vanhentunut?', category: 'misc', value: 1, rarity: 'common', stackable: true, icon: '🎟️' },
  lottokuponki: { name: 'Lottokuponki', description: 'Raaputtamaton. Tänään se on sinun päiväsi.', category: 'misc', value: 2, rarity: 'uncommon', stackable: true, icon: '🎫' },
  rikkinainenpuhelin: { name: 'Rikkinäinen puhelin', description: 'Näyttö säpäleinä. Osat voi myydä.', category: 'misc', value: 5, rarity: 'common', icon: '📵' },
  potkulautaakku: { name: 'Potkulaudan akku', description: 'Sähköpotkulaudan akku. Raskas.', category: 'material', value: 25, rarity: 'uncommon', icon: '🔋' },

  // ---- groceries (shops)
  maito: { name: 'Maito', description: 'Litra kevytmaitoa.', category: 'food', value: 0.5, rarity: 'common', stackable: true, price: 1.2, icon: '🥛', effects: { energy: 4 } },
  kananmunat: { name: 'Kananmunat', description: 'Kuuden kennon pakkaus.', category: 'food', value: 1, rarity: 'common', stackable: true, price: 2.5, icon: '🥚' },
  jauhot: { name: 'Vehnäjauhot', description: 'Leivontaan.', category: 'food', value: 0.5, rarity: 'common', stackable: true, price: 1.3, icon: '🌾' },
  makkara: { name: 'Lenkkimakkara', description: 'Grillattuna paras.', category: 'food', value: 1, rarity: 'common', stackable: true, price: 3.2, icon: '🌭', effects: { energy: 6 } },
  peruna: { name: 'Perunat', description: 'Kilon pussi.', category: 'food', value: 0.5, rarity: 'common', stackable: true, price: 1.5, icon: '🥔' },
  juusto: { name: 'Juusto', description: 'Kermajuustoa, 500 g.', category: 'food', value: 2, rarity: 'common', stackable: true, price: 5.9, icon: '🧀', effects: { energy: 5 } },
  leipa: { name: 'Ruisleipä', description: 'Reikäleipä, tietysti.', category: 'food', value: 0.8, rarity: 'common', stackable: true, price: 2.2, icon: '🍞', effects: { energy: 8 } },
  kahvi: { name: 'Kahvipaketti', description: 'Vaalea paahto, 500 g.', category: 'food', value: 2, rarity: 'common', stackable: true, price: 5.5, icon: '☕' },
  energiajuoma: { name: 'Energiajuoma', description: 'Tölkki sokeria ja kofeiinia.', category: 'food', value: 0.8, rarity: 'common', stackable: true, price: 1.9, icon: '🥤', effects: { energy: 15 } },
  karkkipussi: { name: 'Karkkipussi', description: 'Irtokarkkeja, enimmäkseen salmiakkia.', category: 'food', value: 1, rarity: 'common', stackable: true, price: 3.5, icon: '🍬', effects: { energy: 10 } },
  pakastepizza: { name: 'Pakastepizza', description: 'Kinkku-ananas. Kiistanalainen.', category: 'food', value: 1, rarity: 'common', stackable: true, price: 3.9, icon: '🍕', effects: { energy: 12 } },
  kerma: { name: 'Kuohukerma', description: '2 dl, risottoon ja kastikkeisiin.', category: 'food', value: 0.47, rarity: 'common', stackable: true, price: 1.4, icon: '🥛', effects: { energy: 3 } },
  jauheliha: { name: 'Jauheliha', description: '400 g naudan jauhelihaa.', category: 'food', value: 1.5, rarity: 'common', stackable: true, price: 4.5, icon: '🥩' },
  broileri: { name: 'Broilerin fileet', description: 'Marinoimaton, 450 g.', category: 'food', value: 1.97, rarity: 'common', stackable: true, price: 5.9, icon: '🍗' },
  pulla_k: { name: 'Korvapuusti', description: 'Kaupan leipomon tuore pulla.', category: 'food', value: 0.5, rarity: 'common', stackable: true, price: 1.5, icon: '🥐', effects: { energy: 8 } },
  sipuli: { name: 'Sipuli', description: 'Keltasipuli, 500 g.', category: 'food', value: 0.3, rarity: 'common', stackable: true, price: 0.9, icon: '🧅' },
  tomaatti: { name: 'Tomaatit', description: 'Kotimaisia kirsikkatomaatteja.', category: 'food', value: 0.83, rarity: 'common', stackable: true, price: 2.5, icon: '🍅', effects: { energy: 2 } },
  omena: { name: 'Omena', description: 'Punainen ja rapea.', category: 'food', value: 0.2, rarity: 'common', stackable: true, price: 0.6, icon: '🍎', effects: { energy: 3 } },
  pasta: { name: 'Spagetti', description: '500 g pastaa.', category: 'food', value: 0.37, rarity: 'common', stackable: true, price: 1.1, icon: '🍝' },
  riisi: { name: 'Riisi', description: 'Jasmiiniriisi, 1 kg.', category: 'food', value: 0.73, rarity: 'common', stackable: true, price: 2.2, icon: '🍚' },
  mausteet: { name: 'Maustepurkki', description: 'Mustapippuria ja suolaa.', category: 'food', value: 0.63, rarity: 'common', stackable: true, price: 1.9, icon: '🧂' },
  sipsit: { name: 'Sipsipussi', description: 'Ranch-maustetut.', category: 'food', value: 0.8, rarity: 'common', stackable: true, price: 2.4, icon: '🥔', effects: { energy: 5 } },
  jaatelo: { name: 'Jäätelö', description: 'Vanilja, 1 l.', category: 'food', value: 1.3, rarity: 'common', stackable: true, price: 3.9, icon: '🍨', effects: { energy: 6 } },
  // ---- cooked food
  grillimakkara: { name: 'Grillimakkara', description: 'Sinappia päälle ja nautiskele.', category: 'food', value: 2.8, rarity: 'common', stackable: true, icon: '🌭', effects: { energy: 22 } },
  munakas: { name: 'Munakas', description: 'Kuohkea ja kultainen.', category: 'food', value: 2.5, rarity: 'common', stackable: true, icon: '🍳', effects: { energy: 20 } },
  perunamuusi: { name: 'Perunamuusi', description: 'Voita ja maitoa, kuten mummolla.', category: 'food', value: 3.2, rarity: 'common', stackable: true, icon: '🥔', effects: { energy: 26 } },
  letut: { name: 'Letut', description: 'Hillon kanssa parhaat.', category: 'food', value: 4.0, rarity: 'common', stackable: true, icon: '🥞', effects: { energy: 32 } },
  lihapullat: { name: 'Lihapullat', description: 'Kotitekoiset, oikeat lihapullat.', category: 'food', value: 5.2, rarity: 'common', stackable: true, icon: '🧆', effects: { energy: 42 } },
  bolognese: { name: 'Spagetti bolognese', description: 'Pitkään haudutettu kastike.', category: 'food', value: 6.9, rarity: 'common', stackable: true, icon: '🍝', effects: { energy: 55 } },
  broileririisi: { name: 'Broileririisi', description: 'Proteiinia salille.', category: 'food', value: 7.5, rarity: 'common', stackable: true, icon: '🍛', effects: { energy: 60 } },
  lammitettypizza: { name: 'Grillattu pizza', description: 'Rapea pohja, sula juusto.', category: 'food', value: 3.0, rarity: 'common', stackable: true, icon: '🍕', effects: { energy: 24 } },
  palanut: { name: 'Palanut annos', description: 'Hiiltä. Syötävä, juuri ja juuri.', category: 'food', value: 0.4, rarity: 'common', stackable: true, icon: '🔥', effects: { energy: 3 } },
  oljy: { name: 'Moottoriöljy', description: 'Litra 5W-30.', category: 'material', value: 4, rarity: 'common', stackable: true, price: 12, icon: '🛢️' },
};

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(Object.entries(defs).map(([id, d]) => [id, { id, stackable: false, ...d }]));

export const itemName = (id: string) => ITEMS[id]?.name ?? id;
export const itemIcon = (id: string) => ITEMS[id]?.icon ?? '📦';

export const RARITY_NAMES: Record<Rarity, string> = { common: 'Tavallinen', uncommon: 'Epätavallinen', rare: 'Harvinainen', epic: 'Eeppinen', legendary: 'Legendaarinen' };
export const RARITY_COLORS: Record<Rarity, string> = { common: '#c8ccd2', uncommon: '#5ee07a', rare: '#3a9bff', epic: '#c084fc', legendary: '#ffb43c' };

/** Items that can turn up lying around the map, weighted by rarity. */
export const WORLD_LOOT = Object.values(ITEMS).filter((i) => i.category !== 'quest' && i.category !== 'food' && !i.price && i.id !== 'oljy');
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, uncommon: 26, rare: 10, epic: 3.4, legendary: 0.6 };
