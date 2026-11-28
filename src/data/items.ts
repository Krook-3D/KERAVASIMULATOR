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
  spraymaali: { name: 'Spraymaali, musta', description: 'Spraymaalitölkki graffiteihin. Pidä kädessä ja maalaa seinään.', category: 'tool', value: 6, rarity: 'common', stackable: true, hands: 1, icon: '🎨', price: 7 },
  spray_punainen: { name: 'Spraymaali, punainen', description: 'Spraymaalitölkki graffiteihin. Pidä kädessä ja maalaa seinään.', category: 'tool', value: 6, rarity: 'common', stackable: true, hands: 1, icon: '🎨', price: 7 },
  spray_sininen: { name: 'Spraymaali, sininen', description: 'Spraymaalitölkki graffiteihin. Pidä kädessä ja maalaa seinään.', category: 'tool', value: 6, rarity: 'common', stackable: true, hands: 1, icon: '🎨', price: 7 },
  spray_keltainen: { name: 'Spraymaali, keltainen', description: 'Spraymaalitölkki graffiteihin. Pidä kädessä ja maalaa seinään.', category: 'tool', value: 6, rarity: 'common', stackable: true, hands: 1, icon: '🎨', price: 7 },
  spray_vihrea: { name: 'Spraymaali, vihreä', description: 'Spraymaalitölkki graffiteihin. Pidä kädessä ja maalaa seinään.', category: 'tool', value: 6, rarity: 'common', stackable: true, hands: 1, icon: '🎨', price: 7 },
  spray_valkoinen: { name: 'Spraymaali, valkoinen', description: 'Spraymaalitölkki graffiteihin. Pidä kädessä ja maalaa seinään.', category: 'tool', value: 6, rarity: 'common', stackable: true, hands: 1, icon: '🎨', price: 7 },
  spray_pinkki: { name: 'Spraymaali, pinkki', description: 'Spraymaalitölkki graffiteihin. Pidä kädessä ja maalaa seinään.', category: 'tool', value: 6, rarity: 'common', stackable: true, hands: 1, icon: '🎨', price: 7 },
  puukko: { name: 'Puukko', description: 'Perinteinen suomalainen puukko tupessa. Työkalu, ei lelu.', category: 'tool', value: 12, rarity: 'uncommon', hands: 1, icon: '🔪' },
  shankki: { name: 'Shänkki', description: 'Itse teroitettu. Ei kannata jäädä kiinni tämän kanssa.', category: 'tool', value: 8, rarity: 'uncommon', hands: 1, harm: 4, icon: '🗡️' },
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
  kultaranneke: { name: 'Kultaranneke', description: 'Painava kultainen ranneke, leimat kunnossa. Aito.', category: 'collectible', value: 180, rarity: 'rare', equipSlot: 'accessory', icon: '🔗' },
  terasrolux: { name: 'Rolux Teräs', description: 'Teräksinen Rolux. Raskas, hiljaa tikittävä ja aito.', category: 'collectible', value: 450, rarity: 'rare', equipSlot: 'accessory', icon: '⌚' },
  // fakes: look the part from a distance, worth next to nothing
  feikkiketju: { name: 'Kultaketju (feikki)', description: 'Kiiltää kuin aito, kunnes kaula muuttuu vihreäksi.', category: 'collectible', value: 4, rarity: 'common', equipSlot: 'accessory', icon: '📿' },
  feikkiranneke: { name: 'Kultaranneke (feikki)', description: 'Kevyt kuin muovi. Koska se on muovia.', category: 'collectible', value: 3, rarity: 'common', equipSlot: 'accessory', icon: '🔗' },
  feikkirolux: { name: 'Rolux (feikki)', description: 'Sekuntiviisari nykii ja logossa lukee ROLUKS. Torilta parilla kympillä.', category: 'collectible', value: 8, rarity: 'common', equipSlot: 'accessory', icon: '⌚' },
  // package drops only
  kultasorkkarauta: { name: 'Kultainen sorkkarauta', description: 'Kullattu sorkkarauta. Avaa samat paikat kuin tavallinenkin, mutta tyylillä.', category: 'tool', value: 2000, rarity: 'legendary', hands: 1, icon: '🦯' },
  kultanokka: { name: 'Kultainen Nokka 3310', description: 'Kullattu Nokka 3310. Matopeli on nyt luksusta.', category: 'collectible', value: 1800, rarity: 'legendary', icon: '📱' },
  kultaharkko: { name: 'Kultaharkko', description: 'Mistä tämä on tänne tullut?', category: 'collectible', value: 2500, rarity: 'legendary', icon: '🥇' },

  // ---- junk
  tolkki: { name: 'Tyhjä tölkki', description: 'Pantti 15 senttiä.', category: 'misc', value: 0.15, rarity: 'common', stackable: true, icon: '🥫' },
  pullo: { name: 'Pantillinen pullo', description: 'Pantti 40 senttiä.', category: 'misc', value: 0.4, rarity: 'common', stackable: true, icon: '🍾' },
  kebabkuponki: { name: 'Kebab-kuponki', description: '"Toinen rulla puoleen hintaan." Vanhentunut?', category: 'misc', value: 1, rarity: 'common', stackable: true, icon: '🎟️' },
  lottokuponki: { name: 'Lottokuponki', description: 'Raaputtamaton. Tänään se on sinun päiväsi.', category: 'misc', value: 2, rarity: 'uncommon', stackable: true, icon: '🎫' },
  rikkinainenpuhelin: { name: 'Rikkinäinen puhelin', description: 'Näyttö säpäleinä. Osat voi myydä.', category: 'misc', value: 5, rarity: 'common', icon: '📵' },
  potkulautaakku: { name: 'Potkulaudan akku', description: 'Sähköpotkulaudan akku. Raskas.', category: 'material', value: 25, rarity: 'uncommon', icon: '🔋' },

  // ---- building materials (Motonet)
  lauta: { name: 'Lauta', description: 'Höylätty rakennuslauta 2×4. Rungot, seinät ja puutyöt.', category: 'material', value: 3, rarity: 'common', stackable: true, price: 6, icon: '🪵' },
  sementti: { name: 'Sementtisäkki', description: '25 kg säkki. Sekoita vedellä, valuta perustukseen.', category: 'material', value: 4, rarity: 'common', stackable: true, price: 9, icon: '🧱' },
  kattopelti: { name: 'Kattopelti', description: 'Profiloitu teräspelti. Ei vuoda, kolisee sateella.', category: 'material', value: 7, rarity: 'common', stackable: true, price: 14, icon: '🔩' },
  ikkuna: { name: 'Ikkuna', description: 'Kolmilasinen ikkuna karmeineen.', category: 'material', value: 18, rarity: 'uncommon', stackable: true, price: 35, icon: '🪟' },
  // K-Rauta: extensions and finishing for a finished house
  terassilauta: { name: 'Terassilauta', description: 'Painekyllästetty lauta. Kestää grillibileet ja sateen.', category: 'material', value: 2, rarity: 'common', stackable: true, price: 5, icon: '🪵' },
  aitaelementti: { name: 'Aitaelementti', description: 'Valmis säleaitaelementti 1,8 m. Naapuri ei enää kurki.', category: 'material', value: 10, rarity: 'common', stackable: true, price: 22, icon: '🚧' },
  multasakki: { name: 'Multasäkki', description: '50 litraa puutarhamultaa.', category: 'material', value: 2, rarity: 'common', stackable: true, price: 5, icon: '🟫' },
  kukkasipulit: { name: 'Kukkasipulit', description: 'Tulppaaneja ja narsisseja. Kevät tulee.', category: 'material', value: 3, rarity: 'common', stackable: true, price: 7, icon: '🌷' },
  eriste: { name: 'Mineraalivilla', description: 'Eristelevy. Kutittaa, mutta lämmittää.', category: 'material', value: 5, rarity: 'common', stackable: true, price: 11, icon: '🧽' },
  kiuas: { name: 'Sähkökiuas', description: '6 kW kiuas kivineen. Löylyä!', category: 'material', value: 140, rarity: 'uncommon', stackable: true, price: 290, icon: '♨️' },
  tiili: { name: 'Tiili', description: 'Punatiili. Kestää sukupolvia.', category: 'material', value: 0.6, rarity: 'common', stackable: true, price: 1.5, icon: '🧱' },
  nostoovi: { name: 'Autotallin nosto-ovi', description: 'Lamellinen nosto-ovi kaukosäätimellä.', category: 'material', value: 120, rarity: 'uncommon', stackable: true, price: 240, icon: '🚪' },
  talomaali: { name: 'Talomaali', description: '10 litran ämpäri ulkomaalia. Värin saa valita.', category: 'material', value: 10, rarity: 'common', stackable: true, price: 24, icon: '🪣' },
  aurinkopaneeli: { name: 'Aurinkopaneeli', description: '400 W paneeli. Sähkölasku pienenee, vuokra nousee.', category: 'material', value: 90, rarity: 'uncommon', stackable: true, price: 180, icon: '🔆' },

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
  // ---- gym roina (fictional, see game/gym/roina.ts)
  tankkioljy: { name: 'Tankkiöljy', description: 'Pieni ruskea pullo, etiketissä hauis ja salama. Fiktiivinen salituote.', category: 'drug', value: 0, rarity: 'rare', stackable: true, harm: 2, icon: '🧴' },
  massamix: { name: 'Massamix-X', description: '"Ammattilaisille." Pakkaus on käsin teipattu. Fiktiivinen.', category: 'drug', value: 0, rarity: 'rare', stackable: true, harm: 3, icon: '💉' },
  kuivatin: { name: 'Kuivatin 9000', description: 'Lupaa sixpackin viikossa. Fiktiivinen.', category: 'drug', value: 0, rarity: 'uncommon', stackable: true, harm: 2, icon: '💊' },
  palautin: { name: 'Peptidi P-17 "Palautin"', description: 'Kylmälaukussa säilytettävä ampulli. Fiktiivinen.', category: 'drug', value: 0, rarity: 'uncommon', stackable: true, harm: 1, icon: '🧪' },
  tuplaus: { name: 'GH-Tuplaus', description: 'Kallein kaikista. Pete kutsuu tätä "kultakaivokseksi". Fiktiivinen.', category: 'drug', value: 0, rarity: 'epic', stackable: true, harm: 3, icon: '⚗️' },
  leikkuri: { name: 'Leikkuri-T', description: 'Pete sanoo että tämä "tasoittaa". Fiktiivinen.', category: 'drug', value: 0, rarity: 'uncommon', stackable: true, harm: 1, icon: '💠' },
  // ---- street goods (fictional, see game/street/streetDeals.ts)
  jokivihrea: { name: 'Jokivarren Vihreä', description: 'Pieni minigrip-pussi, jossa jotain vihreää. Fiktiivinen katukama.', category: 'drug', value: 0, rarity: 'uncommon', stackable: true, harm: 3, icon: '🌿' },
  asemanpolly: { name: 'Asemanpölly', description: 'Taiteltu paperinpala. Fiktiivinen katukama.', category: 'drug', value: 0, rarity: 'rare', stackable: true, harm: 4, icon: '🧂' },
  lahijunasieni: { name: 'Lähijunasieni', description: 'Kuivattuja "sieniä" rasiassa. Fiktiivinen katukama.', category: 'drug', value: 0, rarity: 'rare', stackable: true, harm: 3, icon: '🍄' },
  feikkipussi: { name: 'Feikkipussi', description: 'Oreganoa ja talkkia. Sinua huijattiin.', category: 'misc', value: 0, rarity: 'common', stackable: true, icon: '🫙' },
  oljy: { name: 'Moottoriöljy', description: 'Litra 5W-30.', category: 'material', value: 4, rarity: 'common', stackable: true, price: 12, icon: '🛢️' },
};

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(Object.entries(defs).map(([id, d]) => [id, { id, stackable: false, ...d }]));

export const itemName = (id: string) => ITEMS[id]?.name ?? id;
export const itemIcon = (id: string) => ITEMS[id]?.icon ?? '📦';

export const RARITY_NAMES: Record<Rarity, string> = { common: 'Tavallinen', uncommon: 'Epätavallinen', rare: 'Harvinainen', epic: 'Eeppinen', legendary: 'Legendaarinen' };
export const RARITY_COLORS: Record<Rarity, string> = { common: '#c8ccd2', uncommon: '#5ee07a', rare: '#3a9bff', epic: '#c084fc', legendary: '#ffb43c' };

/** Items that can turn up lying around the map, weighted by rarity. */
/** Found only in package drops, never lying around. */
export const DROP_ONLY = new Set(['kultasorkkarauta', 'kultanokka']);
export const WORLD_LOOT = Object.values(ITEMS).filter((i) => i.category !== 'quest' && i.category !== 'food' && i.category !== 'drug' && !i.price && i.id !== 'oljy' && i.id !== 'feikkipussi' && !DROP_ONLY.has(i.id));
/** What a package drop can hold: every legendary item. */
export const DROP_POOL = Object.values(ITEMS).filter((i) => i.rarity === 'legendary' && i.category !== 'quest').map((i) => i.id);
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, uncommon: 26, rare: 10, epic: 3.4, legendary: 0.6 };

/** Paint colour of each spray can. */
export const SPRAY_COLORS: Record<string, string> = {
  spraymaali: '#1b1d22',
  spray_punainen: '#e23b3b',
  spray_sininen: '#3a7bd5',
  spray_keltainen: '#ffd23f',
  spray_vihrea: '#2ecc71',
  spray_valkoinen: '#f4f4f4',
  spray_pinkki: '#ff5fb2',
};
export const isSpray = (id?: string) => !!id && id in SPRAY_COLORS;
