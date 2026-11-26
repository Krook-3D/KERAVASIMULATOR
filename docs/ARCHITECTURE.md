# Kerava Simulator: arkkitehtuuri ja MVP-suunnitelma

Tämä dokumentti on projektin tekninen pohja. Se on tarkoituksella lyhyt: tarkennetaan sitä mukaa kun järjestelmiä rakennetaan.

## 0. Pelin suunta

Kerava Simulator on **RuneScape-henkinen progression-peli, ei GTA-tyylinen sandbox**. Tunnelman referenssinä on paikallinen selainpeli Myyr York, mutta pelimekaniikat, ulkoasu ja sisältö suunnitellaan omiksi.

Mitä tämä tarkoittaa käytännössä:

- **Skillaus on ydin.** Pelaaja kävelee paikkaan ja tekee toistuvia aktiviteetteja (kalastaa joella, treenaa salilla, kokkaa kotona). Jokainen toisto kestää hetken ja antaa XP:tä, itemeitä tai rahaa.
- **Pitkäjänteinen kehitys.** Levelit avaavat uusia paikkoja, parempia aktiviteetteja ja questeja. Tavoite on "vielä yksi level", ei nopea kaaos.
- **Kartta on maailma, jossa kävellään.** Klikkaa ja kävele, ei ajoneuvoja, takaa-ajoja tai reaaliaikaista toimintaa.
- **Questit kertovat tarinan.** Monivaiheisia, paikallisia ja huumorilla höystettyjä tehtäviä NPC:iltä.
- **Talous perustuu keräämiseen ja myymiseen.** Raaka-aineita kerätään, jalostetaan (esim. kala → kypsennetty kala) ja myydään.
- **Ei:** ajamista, ammuskelua, poliisijahteja tai rikossandboxia.

Tämän takia vaiheisiin 6–7 lisätään **aktiviteettijärjestelmä**: POI:lla on aktiviteetteja, joilla on vaatimus (skill-level, työkalu), kesto, energiankulutus ja palkinto (XP, itemit). Se on pelin tärkein silmukka heti questien rinnalla.

## 1. Tekninen arkkitehtuuri

```text
┌──────────────────────────── Selain ────────────────────────────┐
│  React UI (components/, pages/)                                │
│      │  lukee tilaa ja kutsuu actioneita                       │
│      ▼                                                         │
│  Game store (game/store)  ← yksi pelitila, puhtaat reducerit   │
│      │                                                         │
│      ▼                                                         │
│  Domain-järjestelmät (game/*)  puhdasta TypeScriptiä, ei Reactia│
│   player · skills · xp · quests · inventory · items · economy  │
│   npc · map · achievements                                     │
│      │                         ▲                               │
│      ▼                         │ staattiset määrittelyt        │
│  services/persistence     data/ (POI:t, questit, itemit, NPC:t)│
│   MVP: localStorage                                            │
│   myöhemmin: REST API ──────────────┐                          │
└─────────────────────────────────────┼──────────────────────────┘
                                      ▼
                     server/ (Node.js + TypeScript, REST)
                     PostgreSQL + PostGIS   (vaihe 11)
```

Periaatteet:

- **Pelilogiikka ei asu React-komponenteissa.** `src/game/` on puhdasta TypeScriptiä: funktiot ottavat tilan ja palauttavat uuden tilan. Tämä tekee logiikasta testattavaa ja siirrettävää palvelimelle myöhemmin.
- **Sisältö on dataa.** Questit, itemit, NPC:t ja POI:t ovat `src/data/`-kansiossa tyypitettyinä määrittelyinä. Uusi kaupunki (Helsinki, Vantaa…) on uusi data-paketti, ei uutta koodia.
- **Määrittely vs. instanssi.** `ItemDef` kuvaa mikä item on, `InventorySlot` kertoo mitä pelaajalla on. Sama questeille (`QuestDef` vs. `QuestProgress`).
- **Persistence on vaihdettava kerros.** MVP tallentaa `localStorage`en. `services/persistence.ts` on rajapinta, jonka toteutus vaihdetaan myöhemmin REST-kutsuiksi.
- **Ei backendia ennen kuin sitä tarvitaan.** Kaikki MVP-ominaisuudet toimivat selaimessa. Backend tulee vaiheessa 11, kun tallennus siirtyy palvelimelle.

Stack:

| Kerros | Valinta | Miksi |
| --- | --- | --- |
| Frontend | React 19, Vite, TypeScript | Nopea kehitys, laaja ekosysteemi |
| Kartta | MapLibre GL JS + OpenStreetMap | Avoin, ei API-avaimia, tukee myöhemmin omaa vektorityyliä |
| Tila | Oma reducer-pohjainen store (React `useReducer` + context) | Ei ylimääräisiä riippuvuuksia MVP:ssä |
| Tallennus (MVP) | localStorage | Riittää "progress säilyy refreshissä" -vaatimukseen |
| Backend (myöhemmin) | Node.js + TypeScript, REST | Jakaa tyypit frontendin kanssa |
| Tietokanta (myöhemmin) | PostgreSQL + PostGIS | Paikkatietokyselyt (lähimmät POI:t, alueet) |

## 2. Kansiorakenne

```text
src/
  main.tsx              sovelluksen käynnistys
  App.tsx               pääruudun asettelu
  components/           UI-komponentit (HUD, paneelit, napit)
  pages/                kokonaiset näkymät (GamePage, CharacterCreatePage)
  game/
    player/             pelaajan luonti, health/energy
    skills/             skill-määrittelyt ja XP:n lisäys
    xp/                 XP-käyrä ja level-laskenta
    quests/             questien eteneminen
    inventory/          lisää/poista itemeitä
    items/              item-apufunktiot
    economy/            raha, ostot ja myynnit
    npc/                dialogi ja NPC-logiikka
    map/                kartan konfiguraatio ja liikkuminen
    store/              pelitila, actionit ja reducer
  data/                 POI:t, questit, itemit, NPC:t (Kerava-paketti)
  services/             persistence (localStorage → REST)
  types/                jaetut tyypit (Player, Skill, Item, Quest…)
  styles/               globaalit tyylit ja teemamuuttujat
server/                 (vaihe 11) api/, services/, database/, models/, auth/
docs/                   arkkitehtuuri ja suunnitelmat
```

Kansioita luodaan vasta kun niihin tulee koodia, joten tyhjiä placeholder-kansioita ei ole.

## 3. MVP:n feature-lista

Pelaaja pystyy (järjestyksessä):

1. **Avaamaan pelin** selaimessa (`npm run dev`).
2. **Luomaan hahmon**: nimi + ulkonäön väri. Aloitus: 1 lvl, 0 XP, 50 €, 100 health, 100 energy, lähtöpaikka Keravan asema.
3. **Näkemään Keravan kartan**: zoomaus ja panorointi, rajattu Keravan alueelle.
4. **Liikkumaan kartalla**: klikkaa POI:ta tai karttaa, hahmo kävelee sinne. Liikkuminen kuluttaa energiaa ja antaa Running/Endurance-XP:tä matkan mukaan.
5. **Näkemään 10 POI:ta** omilla ikoneillaan (ks. alla).
6. **Hyväksymään questin** NPC:ltä dialogin kautta.
7. **Suorittamaan questin**: tavoitteet tyyppiä `visit`, `talk`, `collect`, `activity`.
8. **Saamaan XP:tä** (character + skill).
9. **Saamaan rahaa** questeista, aktiviteeteista ja myymällä.
10. **Kehittämään skillin**: 5 skilliä (Strength, Endurance, Running, Cooking, Fishing), level-up-ilmoitus.
11. **Käyttämään inventoryä**: lista, määrät, arvot, kuvaukset, käytä/syö/myy.
12. **Tallentamaan progressionsa**: automaattinen tallennus localStorageen.

Sisällön määrä MVP:ssä:

| Sisältö | Määrä | Esimerkit |
| --- | --- | --- |
| POI | 10 (ehdotus, tarkennetaan vaiheessa 7) | Keravan asema, Kauppakadun kävelykatu, kirjasto, kuntosali, Keravanjoki (kalastus), Keravan urheilupuisto, Kirsikkapuisto, Heikkilän kotiseutumuseo, ruokakauppa, pelaajan koti |
| Questit | 5 | Keskustan mysteeri, Ensimmäinen työpäivä, Kadonnut reppu, Joen kuningas, Salin legenda |
| Itemit | 15 | Kahvi, Energiajuoma, Karjalanpiirakka, Lenkkarit, Kalastusvavat, Ahven, Kuntosalikortti, Bussikortti, Vanha Nokia, Kerava Hoodie, Ostoskassi, Keravan kartta, Mystinen avain, Keskustan kuitti, Harvinainen Kerava-item |
| NPC | 5 | Asemamies Arto, Kirjastonhoitaja Leena, Salivalmentaja Jonne, Kalastaja-Pertti, Kauppias Sari |
| Skillit | 5 | Strength, Endurance, Running, Cooking, Fishing |

Ei MVP:ssä: equipment-slotit (tyyppi on valmiina), achievementit, daily/weekly, minipelit, GPS, backend, multiplayer.

## 4. Ensimmäinen tietomalli

Tyypit ovat tiedostossa `src/types/game.ts`. Tiivistelmä:

```ts
type SkillId = 'strength' | 'endurance' | 'running' | 'cooking' | 'fishing';

interface Player {
  id: string;
  name: string;
  color: string;            // hahmon väri kartalla
  xp: number;               // character XP, level lasketaan XP:stä
  money: number;            // €, kokonaisluku
  health: number;           // 0–maxHealth
  energy: number;           // 0–maxEnergy
  position: LngLat;         // [lng, lat]
  skills: Record<SkillId, SkillState>;
  inventory: InventorySlot[];
  equipment: Partial<Record<EquipmentSlot, string>>; // itemId
  quests: Record<string, QuestProgress>;
  visitedPoiIds: string[];
  createdAt: number;
}

interface SkillState { xp: number }          // level johdetaan XP:stä

interface ItemDef {
  id: string; name: string; description: string;
  category: 'food' | 'tool' | 'material' | 'equipment' | 'quest' | 'collectible' | 'misc';
  value: number; rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  stackable: boolean;
  effects?: { energy?: number; health?: number };
  equipSlot?: EquipmentSlot;
}
interface InventorySlot { itemId: string; quantity: number }

interface Poi {
  id: string; name: string; description: string;
  position: LngLat; kind: 'station' | 'shop' | 'gym' | 'park' | 'water' | 'library' | 'sports' | 'culture' | 'food' | 'home';
  npcIds: string[]; activityIds: string[];
  unlock?: Requirement;     // locked/unlocked POI:t
}

interface NpcDef {
  id: string; name: string; description: string; poiId: string;
  dialogue: DialogueNode[]; questIds: string[]; shop?: ShopDef;
}

interface QuestDef {
  id: string; title: string; description: string; giverNpcId: string;
  requirements?: Requirement[];
  objectives: Objective[];  // visit | talk | collect | activity
  rewards: Reward;          // xp, money, items, skillXp, reputation
}
interface QuestProgress { status: 'active' | 'completed'; objectiveIndex: number }
```

Tallennusmuoto: `{ version: 1, player: Player }` localStoragessa avaimella `kerava-sim:save`. `version` mahdollistaa migraatiot.

## 5. XP-käyrä

Oma käyrä (ei RuneScapen taulukkoa): kumulatiivinen XP tasolle `L` on

```text
xpForLevel(L) = 50 · (L − 1) · (L + 2) / 2   →   L1: 0, L2: 100, L3: 250, L4: 450, L5: 700, L10: 2700, L20: 10450
```

Sama kaava character levelille ja skilleille, maksimi aluksi 50. Käyrää on helppo säätää yhdestä paikasta (`src/game/xp/`).

## 6. UI-rakenne

Kartta täyttää koko ruudun, käyttöliittymä on sen päällä kelluvina "pelipaneeleina", ei admin-sivupalkkeina.

```text
┌───────────────────────────────────────────────────────────┐
│ KERAVA SIMULATOR   [Lv 5 ███████░░] [💰 425 €] [⚡ 80]   │  ← HUD (yläpalkki)
│                                                           │
│                                              ┌──────────┐ │
│               KARTTA (koko ruutu)            │ QUESTIT  │ │  ← questiseuranta
│          📍 POI   🧍 pelaaja   💬 NPC         │ > Keskus │ │
│                                              └──────────┘ │
│  ┌───────────────┐                                        │
│  │ POI-kortti /  │  ← aukeaa kun POI valitaan             │
│  │ NPC-dialogi   │                                        │
│  └───────────────┘                                        │
│   [ KARTTA ] [ HAHMO ] [ SKILLIT ] [ REPPU ] [ QUESTIT ]  │  ← alapalkki
└───────────────────────────────────────────────────────────┘
```

- **HUD**: nimi, level + XP-palkki, raha, energia.
- **Alapalkki** avaa paneelin (Character, Skills, Inventory, Quests) kartan päälle. Mobiilissa paneeli on koko ruudun levyinen.
- **POI-kortti**: nimi, kuvaus, NPC:t, aktiviteetit ("Kalasta", "Treenaa").
- **Dialogi**: NPC:n nimi, repliikki, vastausvaihtoehdot.

Visuaalinen tyyli: tumma pohja, kirkkaat korostusvärit (keltainen ja sininen kuin Keravan vaakunassa), pyöristetyt mutta paksureunaiset "pelikortit", pikselimäinen otsikkofontti ja selkeä leipäteksti. Kartta värisävytetään hieman, jotta se näyttää pelimaailmalta eikä navigaattorilta.

## 7. Karttaratkaisu

- **MapLibre GL JS** renderöi kartan. Pohjana OpenStreetMapin rasteritiilet (`tile.openstreetmap.org`) ja OSM-attribuutio.
- Kartta keskitetään Keravan asemalle (`[25.1037, 60.4044]`) ja rajataan `maxBounds`illa Keravan alueelle, zoom 12–18.
- **Pelaaja, POI:t ja NPC:t** ovat MapLibren `Marker`eita, joiden sisältö on omaa HTML:ää. Siksi ne on helppo tyylittää pelimäisiksi.
- **Liikkuminen** (vaihe 6–7): klikkaus asettaa kohteen, hahmo liikkuu suoraviivaisesti animaationa. Myöhemmin voidaan reitittää OSM-katuverkkoa pitkin.
- **Locked-alueet**: GeoJSON-polygonit omana layerinaan, harmaana kunnes avattu.
- **Myöhemmin**: oma vektorityyli (esim. OpenFreeMap tai omat tiilet), jotta kartasta saadaan täysin pelin näköinen. OSM:n julkisia tiilipalvelimia ei saa kuormittaa raskaasti tuotannossa, joten ennen julkaisua vaihdetaan omaan tai kaupalliseen tiilipalveluun.
- **GPS-tila** on myöhempi lisäys: sama `position`-kenttä, lähde vain vaihtuu.

## 8. Kehitysjärjestys

| Vaihe | Sisältö | Valmis kun |
| --- | --- | --- |
| 1 | Projektin pohja: Vite + React + TS, MapLibre-kartta, pelaajamarkkeri | Selaimessa näkyy Keravan kartta ja hahmo |
| 2 | Pelin UI-runko: HUD, alapalkki, paneelit | Paneelit aukeavat ja sulkeutuvat |
| 3 | Player-järjestelmä: hahmon luonti, store | Oma nimi näkyy HUDissa |
| 4 | Skillit | Skill-paneeli näyttää 5 skilliä |
| 5 | XP ja levelit | XP:n lisäys nostaa leveliä, level-up-ilmoitus |
| 6 | Kartalla liikkuminen | Klikkaus liikuttaa hahmoa, energia kuluu |
| 7 | POI- ja aktiviteettijärjestelmä | 10 POI:ta, POI-kortti, toistettavat skill-aktiviteetit (kesto, energia, XP, saalis) |
| 8 | Questit | 5 questia läpipelattavissa |
| 9 | Inventory ja itemit | 15 itemiä, käytä/myy |
| 10 | NPC:t ja dialogi | 5 NPC:tä, kaupat |
| 11 | Tallennus: localStorage, sitten backend + PostgreSQL | Progress säilyy refreshissä |
| 12 | Viimeistely | Äänet, animaatiot, tasapainotus |

Huom: localStorage-tallennus tuodaan jo vaiheessa 3, koska se on halpa ja tekee testaamisesta helpompaa. Vaihe 11 tarkoittaa siirtoa palvelimelle.
