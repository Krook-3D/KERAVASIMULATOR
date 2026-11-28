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
- **Ei:** ajamista tai ammuskelua. Rikollisuus on mukana vain riskiin perustuvana talousjärjestelmänä (ks. luku 10), ei GTA-tyylisenä toimintana.
- **Peli on K18.** Hahmon luonnissa vahvistetaan ikä.

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
| 3D-maailma | Three.js + React Three Fiber + drei | RuneScape-tyylinen 3D-näkymä selaimessa, Reactin kanssa yhteensopiva |
| Maailman data | OpenStreetMap (Overpass API → staattinen JSON) | Oikeat Keravan rakennukset, tiet, rata, vedet ja puistot |
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
    world/              3D-scene: maailma, pelaaja, kamera
      GameWorld/        pelinäkymän orkestroija, systems/-hookit, hud/
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
    map/                koordinaatit ja Keravan rajat
    world/              3D-maailma: projektio, OSM-data, geometria, törmäys
    store/              pelitila, actionit ja reducer
  data/                 POI:t, questit, itemit, NPC:t (Kerava-paketti)
  services/             persistence (localStorage → REST)
  types/                jaetut tyypit (Player, Skill, Item, Quest…)
  styles/               globaalit tyylit ja teemamuuttujat
server/                 (vaihe 11) api/, services/, database/, models/, auth/
scripts/                fetch-osm.mjs: hakee Keravan OSM-datan maailmaksi
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
| Skillit | 7 | Strength, Endurance, Running, Cooking, Fishing, Hustlaus, Kyttien pakoilu |

Ei MVP:ssä: equipment-slotit (tyyppi on valmiina), achievementit, daily/weekly, minipelit, GPS, backend, multiplayer.

## 4. Ensimmäinen tietomalli

Tyypit ovat tiedostossa `src/types/game.ts`. Tiivistelmä:

```ts
type SkillId = 'strength' | 'endurance' | 'running' | 'cooking' | 'fishing' | 'hustling' | 'evasion';

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

3D-maailma täyttää koko ruudun, käyttöliittymä on sen päällä kelluvina "pelipaneeleina", ei admin-sivupalkkeina.

```text
┌───────────────────────────────────────────────────────────┐
│ KERAVA SIMULATOR   [Lv 5 ███████░░] [💰 425 €] [⚡ 80]   │  ← HUD (yläpalkki)
│                                                           │
│                                              ┌──────────┐ │
│           3D-MAAILMA (koko ruutu)            │ QUESTIT  │ │  ← questiseuranta
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
- **Alapalkki** avaa paneelin (Character, Skills, Inventory, Quests) maailman päälle. Myöhemmin oikeaan yläkulmaan tulee minikartta. Mobiilissa paneeli on koko ruudun levyinen.
- **POI-kortti**: nimi, kuvaus, NPC:t, aktiviteetit ("Kalasta", "Treenaa").
- **Dialogi**: NPC:n nimi, repliikki, vastausvaihtoehdot.

Visuaalinen tyyli: tumma pohja, kirkkaat korostusvärit (keltainen ja sininen kuin Keravan vaakunassa), pyöristetyt mutta paksureunaiset "pelikortit", pikselimäinen otsikkofontti ja selkeä leipäteksti. Maailma on low-poly-tyylinen: tasavärit, flat shading, selkeät muodot.

## 7. Maailmaratkaisu (3D)

Peli pelataan kolmannen persoonan 3D-näkymässä kuten RuneScapessa: klikkaa maata ja hahmo kävelee sinne, kameraa käännetään raahaamalla tai nuolinäppäimillä ja zoomataan rullalla.

- **Renderöinti**: Three.js React Three Fiberin kautta (`src/components/world/`). Pelilogiikka (`src/game/world/`) ei riipu Reactista.
- **Koordinaatit**: pelaajan sijainti tallennetaan oikeina koordinaatteina (`[lng, lat]`). `projection.ts` muuntaa ne maailman metreiksi, origo Keravan asemalla (+x itä, +z etelä). Sama sijaintikenttä toimii myöhemmin GPS:n kanssa.
- **Maailman data**: `npm run fetch:osm` hakee Overpass API:sta Keravan keskustan (oletus 700 m säde asemasta) rakennukset, tiet, radan, vedet ja puistot ja tallentaa ne tiedostoon `public/data/kerava-world.json`. Rakennusten korkeus tulee OSM:n `height`/`building:levels`-tiedoista, muuten arvioidaan tyypin mukaan. Ilman tiedostoa peli käyttää väliaikaista, käsin tehtyä keskustaa.
- **Geometria**: kaikki rakennukset yhdistetään yhdeksi meshiksi ja tiet yhdeksi meshiksi tyypeittäin, jolloin koko kaupunki piirtyy muutamalla draw callilla.
- **Liikkuminen**: suora kävely kohteeseen, seinien läpi ei pääse (hahmo liukuu seinää pitkin). Vaiheessa 6 lisätään reitinhaku (A* ruudukolla tai OSM-tieverkolla), jotta hahmo kiertää rakennukset kuten RuneScapessa.
- **Kamera**: orbit-kamera seuraa pelaajaa. Kameran ja pelaajan välissä olevaan rakennukseen piirretään läpinäkyvä "reikä", jotta hahmo näkyy aina.
- **POI:t, NPC:t ja questit**: 3D-objekteja ja kelluvia ikoneita maailmassa, sijainnit oikeina koordinaatteina.
- **Isompi alue myöhemmin**: maailma jaetaan ruutuihin (chunks), joita ladataan pelaajan ympäriltä. Näin koko Kerava ja myöhemmin muut kaupungit mahtuvat peliin.
- **Grafiikka**: alkuun primitiiveistä tehty oma low-poly-hahmo. Myöhemmin omat glTF-mallit (hahmo, puut, kyltit, Keravan maamerkit). Ei kopioituja assetteja.
- **Attribuutio**: © OpenStreetMap contributors (ODbL) näkyy pelissä.

## 8. Kehitysjärjestys

| Vaihe | Sisältö | Valmis kun |
| --- | --- | --- |
| 1 | Projektin pohja: Vite + React + TS, 3D-maailma, pelaajahahmo, kamera | Selaimessa näkyy 3D-Kerava ja hahmo, jota voi liikuttaa |
| 2 | Pelin UI-runko: HUD, alapalkki, paneelit | Paneelit aukeavat ja sulkeutuvat |
| 3 | Player-järjestelmä: hahmon luonti, store | Oma nimi näkyy HUDissa |
| 4 | Skillit | Skill-paneeli näyttää 5 skilliä |
| 5 | XP ja levelit | XP:n lisäys nostaa leveliä, level-up-ilmoitus |
| 6 | Liikkuminen | Reitinhaku rakennusten ympäri, juoksu, energia kuluu, minikartta |
| 7 | POI- ja aktiviteettijärjestelmä | 10 POI:ta, POI-kortti, toistettavat skill-aktiviteetit (kesto, energia, XP, saalis) |
| 8 | Questit | 5 questia läpipelattavissa |
| 9 | Inventory ja itemit | 15 itemiä, käytä/myy |
| 10 | NPC:t ja dialogi | 5 NPC:tä, kaupat |
| 10b | Aseman Areena (ks. luku 9) | NPC-duelit asemalla, panokset, rankit |
| 10c | Katukauppa, heat ja poliisi (ks. luku 10) | Osto/myynti, kotivarasto, heat-mittari, jahdit, kotietsinnät, kuulustelu ja vankila |
| 11 | Tallennus: localStorage, sitten backend + PostgreSQL | Progress säilyy refreshissä |
| 12 | Viimeistely | Äänet, animaatiot, tasapainotus |

Huom: localStorage-tallennus tuodaan jo vaiheessa 3, koska se on halpa ja tekee testaamisesta helpompaa. Vaihe 11 tarkoittaa siirtoa palvelimelle.

## 9. Aseman Areena (duel-järjestelmä)

Kaksintaisteluareena, joka on **vain Keravan asemalla**. Idea on tuttu RPG-peleistä, mutta nimi, säännöt ja toteutus ovat omia.

Perusidea:

- Areena on aseman POI:n aktiviteetti ("Aseman Areena"). Muualla Keravalla duelleja ei ole, joten asema on pelin sosiaalinen keskipiste.
- MVP-versiossa vastustajat ovat **NPC-haastajia** (esim. "Lähijuna-Lasse", "Kioskin Kimmo", "Pendelöijä-Paula"), jokaisella oma taso ja tyyli. PvP pelaajien välillä tulee myöhemmin backendin ja WebSocketien myötä.
- **Panos**: pelaaja voi laittaa rahaa peliin (ei pakollinen). Voittaja saa potin, areena ottaa pienen "asemamaksun" (rahanielu taloudelle).
- **Vuoropohjainen kaksintaistelu**, jokaisella kierroksella valitaan yksi liike:
  - **Tönäisy**: voittaa Väistön, häviää Torjunnalle. Vahinko skaalautuu **Strengthistä**.
  - **Torjunta**: voittaa Tönäisyn, häviää Väistölle. Kestävyys skaalautuu **Endurancesta**.
  - **Väistö**: voittaa Torjunnan, häviää Tönäisylle. Onnistumisprosentti skaalautuu **Runningista**.
  - Jokainen liike kuluttaa **staminaa**. Kun stamina loppuu, pelaaja voi vain levätä kierroksen.
- Ottelu päättyy kun toisen "kunto" (health) loppuu tai 10 kierrosta on käyty (silloin voittaa se, jolla on enemmän kuntoa jäljellä).
- Hävinnyt ei kuole: hän "lähtee seuraavalla junalla" ja menettää vain panoksen ja energiaa.
- Palkinnot: Strength/Endurance/Running-XP:tä, raha, **areenan rankki** (Pronssi → Hopea → Kulta → "Aseman legenda") ja harvinaisia collectibleja (esim. "Areenan VR-lippu").
- Vaatimus: character level 3, jotta uudet pelaajat ensin tutustuvat perusjärjestelmiin.

Tekninen toteutus: puhdas `src/game/duel/`-moduuli (tila, liikkeet, vuoron ratkaisu, NPC-tekoäly), data `src/data/duelists.ts`, UI `components/DuelScreen`. Sama vuororatkaisu siirtyy myöhemmin palvelimelle PvP:tä varten.

Paikka kehitysjärjestyksessä: **vaihe 10b**, heti NPC-järjestelmän jälkeen, koska se tarvitsee skillit, XP:n, rahan, NPC:t ja POI-aktiviteetit.

## 10. Katukauppa, heat ja poliisi (K18)

Aikuisille suunnattu riskitalous: pelaaja voi välittää ja myydä fiktiivisiä laittomia aineita, mutta mitä enemmän tekee, sitä kovemmin poliisi kiinnostuu. Järjestelmä on pelimekaniikka (riski vs. tuotto), ei realistinen kuvaus.

**Sisältö pidetään fiktiivisenä.** Aineet ovat keksittyjä (esim. "Jokivarren Vihreä", "Asemanpölly", "Lähijunasieni"), niillä ei ole oikeita valmistusohjeita, annosteluja tai hintoja. Diilauspaikat ovat yleisiä alueita (kujat, puistot, aseman tunneli), eivät oikeita nimettyjä yrityksiä, jotta oikeita keravalaisia liikkeitä ei leimata.

Järjestelmät:

- **Hinnat ja markkina** (`src/game/street/market.ts`): jokaisella aineella on perushinta, joka vaihtelee alueittain ja päivittäin. Ostetaan halvalla yhdeltä välittäjä-NPC:ltä ja myydään kalliimmalla toisaalla. Satunnaiset tapahtumat (esim. "Festarit Kirsikkapuistossa", "Poliisin iskuviikko") heiluttavat hintoja.
- **Kotivarasto**: pelaajan koti (`home`-POI) on varasto. Repussa kulkee vain rajattu määrä, ylimäärä jää kotiin.
- **Heat-mittari 0–100** (`src/game/street/heat.ts`): nousee jokaisesta kaupasta, isoista määristä ja kaupoista lähellä poliisia. Laskee ajan myötä ja "rauhallisilla" teoilla (töissä käynti, salilla treenaus). Heat näkyy HUDissa.
- **Poliisipartiot kartalla**: partio-markkerit liikkuvat katuja pitkin. Jos pelaaja kävelee partion lähelle heatin ollessa korkea, alkaa **jahti**: lyhyt minipeli, jossa Running ja Endurance ratkaisevat pääseekö karkuun.
- **Kiinni jääminen ja selittely**: jos poliisi saa kiinni (jahti epäonnistuu tai jää kiinni itse teosta), avautuu **kuulusteludialogi**. Pelaaja valitsee vastauksia, ja osa vaihtoehdoista on skill-checkejä, joiden onnistuminen riippuu Charismasta, Knowledgesta ja reputationista (esim. "[Charisma 5] Olin vaan viemässä mummolle karjalanpiirakoita"). Onnistunut selitys päästää varoituksella tai pelkällä sakolla, epäonnistunut vie vankilaan. Mitä enemmän tavaraa mukana ja mitä korkeampi heat, sitä vaikeampia checkit ovat.
- **Vankila**: tuomio kestää pelin sisäistä aikaa (pituus riippuu määrästä ja aiemmista tuomioista). Vankilassa voi tehdä rajattuja aktiviteetteja (punnerrukset → Strength, kirjasto → Knowledge, keittiövuoro → Cooking) ja tavata omia NPC:itä ja questeja. Tuomion voi lyhentää hyvällä käytöksellä. Takavarikko vie mukana olleet aineet ja osan rahoista, heat nollautuu.
- **Kotietsinnät**: satunnaistapahtuma, jonka todennäköisyys kasvaa heatin ja kotona olevan määrän mukaan (`raidChance = f(heat, kotivarasto)`). Ratsia vie kotivaraston ja sakottaa. Pelaaja voi vähentää riskiä hajauttamalla varastoa tai pitämällä heatin matalana.
- **Rangit**: katukaupan maine ("Rivikaupustelija" → "Välittäjä" → "Keravan tukkuri") avaa isompia kauppoja ja parempia kontakteja.
- **Skillit**: **Hustlaus** parantaa hintoja ja avaa isompia diilejä, **Kyttien pakoilu** helpottaa jahdeista karkaamista ja hidastaa heatin nousua.
- **Liitännät muihin järjestelmiin**: Charisma parantaa hintoja ja selittelyä (Charisma ja Knowledge tuodaan skilleihin tämän vaiheen yhteydessä), Running auttaa jahdeissa, raha ja maine vaikuttavat questeihin. Aseman Areenalla voi myöhemmin olla katukauppaan liittyviä haastajia.

Tekninen toteutus: puhdas `src/game/street/`-moduuli (market, heat, police, raids, interrogation, jail). Kuulustelu käyttää samaa dialogijärjestelmää kuin NPC:t, laajennettuna skill-check-vaihtoehdoilla, data `src/data/street.ts`. Satunnaisuus kulkee yhden siemenellisen RNG:n kautta, jotta tapahtumat ovat testattavia ja myöhemmin palvelimen ratkaistavissa.

Paikka kehitysjärjestyksessä: **vaihe 10c**, NPC:iden ja inventoryn jälkeen, koska se tarvitsee kaupat, kotivaraston, liikkumisen ja energian. Ikävahvistus on jo hahmon luonnissa.

## 11. Tarina: alueet ja pomot

Kerava jaetaan alueisiin, ja jokaisella alueella on oma valtarakenne. Kaikki hahmot, jengit ja aineet ovat keksittyjä; oikeita yrityksiä tai ihmisiä ei käytetä rikosten yhteydessä.

Jokaisella alueella on kolme pomoa:

- **Katupomo** pyörittää alueen fiktiivistä katukauppaa.
- **Kyttäpomo** on alueen ylikonstaapeli, jolla on oma tapa toimia.
- **Naapurustopomo** on taloyhtiön puheenjohtaja, kioskin omistaja tai kaupunginosayhdistyksen aktiivi, joka "tietää kaiken".

Pomot antavat questeja, ja niiden välinen suhde muuttuu pelaajan valintojen mukaan. Jos auttaa yhtä, toinen suuttuu.

| Alue | Katupomo | Kyttäpomo | Naapurustopomo | Teema |
| --- | --- | --- | --- | --- |
| Asema ja keskusta | "Laituri-Lasse", hallitsee tunnelia ja aseman kulmia | Ylikonstaapeli Kärkkäinen, pikkutarkka ja sääntöjen mies | Kioskin Raija, kuulee kaiken ensimmäisenä | Lähtöalue, opetusquestit, Jonne-ketju |
| Savio (etelässä radan varrella, oma asema ja Alepa) | "Pomo-Pirkko", vanha konkari | Komisario Lindqvist, väsynyt mutta reilu | Taloyhtiön pj Heikkinen | Vanhat teollisuushallit, varastot, ensimmäiset ratsiat |
| Kaleva ja joenvarsi | "Joki-Jape", kasvattajien välikäsi | Vanhempi konstaapeli Mäkelä, lahjottava? | Kalastusseuran Eino | Kalastus, joenvarren piilopaikat |
| Talma (metsät ja pellot) | "Mehtäläinen", eristäytynyt kasvattaja | Maaseutupartio Hyvönen | Kyläyhdistyksen Marjatta | Maastokätköt, kasvattajien talot, metsäjahdit |
| Ahjo ja Kaskela | "Kaskelan Kuningas", nuori ja kunnianhimoinen | Rikoskomisario Salo, iso kala | Omakotiyhdistyksen Pekka | Myöhäisen pelin alue, isot diilit |

### Kasvattajat ja ratsiat

Osa NPC:istä on **kasvattajia**, joiden talossa on fiktiivinen kasvattamo. Talo on oma pieni sisätila, ja pelaaja voi:

1. **Tiedustella**: naapurustopomo tai vihjeet questeista kertovat mistä talosta on kyse ja milloin asukas on poissa.
2. **Raidata**: sisään päästään lukkojen, ikkunoiden tai kellarin kautta. Työkalut (sorkkarauta, voimapihdit) avaavat eri reittejä. Sisällä on vartijakoira, kamerat tai paikalle palaava asukas.
3. **Valita**: saaliin voi myydä katupomolle, viedä kyttäpomolle (karma nousee, katupomon suhde laskee) tai pitää itse.

Ratsiat nostavat heatia, ja katupomo voi kostaa (questi alkaa).

### Questien rakenne

- **Pääketju alueittain**: 3–5 questia per alue. Ketju aukeaa kun edellinen alue on "rauhoitettu" jonkin pomon puolelle.
- **Sivuquestit** syntyvät järjestelmistä: kiinnijäänti näpistyksestä, maastokätkön löytäminen, kostot ja velat.
- **Ensimmäinen quest** on "Viilattu vapaus" (asema ja keskusta): Jonne antaa pussin, poliisi pidättää, vankilassa saa viilan tapaamisessa ja karkaa vartijoiden huomaamatta.

## 12. Uudet järjestelmät (suunnitelma)

- **Karma ja aura**: karma −100…+100. Varastaminen laskee karmaa, ja kiinni jääminen näpistyksestä laskee sitä kolminkertaisesti. Matala karma heikentää auraa: hahmon ympärillä näkyvä hehku himmenee ja muuttuu tummaksi, NPC:t suhtautuvat nuivemmin ja hinnat nousevat. Hyvät teot ja ostaminen omilla rahoilla pitävät karman ylhäällä.
- **Kaupat ja näpistys**: Prismassa ja muissa kaupoissa voi kerätä tuotteita ostoskoriin ja maksaa kassalla, tai piilottaa ne reppuun. Kaupan vartija huomaa noin joka 3.–4. näpistyksen (satunnainen), ja silloin pelaaja viedään poliisiasemalle.
- **Poliisiasema**: oma sisätila, jossa on päivystys, kuulusteluhuone ja putka-osasto. Kuulustelussa voi puhua itsensä ulos skill-checkeillä.
- **Esineet ja reppu**: kartalle siroteltuja esineitä harvinaisuusasteikolla common → uncommon → rare → epic → legendary (esim. commandopipo, köysi, ketju, pesäpallomaila, sorkkarauta, voimapihdit, rälläkkä, kultakello "Rolux"). Repussa on 30 paikkaa. Työkalut avaavat ratsioissa reittejä.
- **Maastokätköt**: syrjäisiltä maastoalueilta löytyy toisten kätköjä. Ottaminen voi tuoda perään kytät tai rikolliset, ja tilanteesta pitää puhua itsensä ulos tai seuraa ongelmia. Jokainen kätkö käynnistää questin.
- **Kokkaus ja Art**: kokkaus vaatii raaka-aineet kaupasta (ostettuna tai näpistettynä). Uusi skilli **Art** kehittyy graffiteja maalaamalla vartijoiden huomaamatta, ja spraymaalit ostetaan ensin kaupasta.
- **Joukkoliikenne**: bussipysäkeiltä valitaan määränpää valikosta, bussi tulee hakemaan ja vie perille (pikamatkustus).
- **Hahmoeditori ja parturi**: tarkka hahmon muokkaus luonnissa; myöhemmin kampausta ym. voi muuttaa vain parturissa.

## 13. Toteutettu tekniikka (marraskuu 2026)

- **Maasto** (`src/game/world/terrain.ts`): korkeuskenttä 6 m ruuduin. Oikea korkeusdata haetaan `fetch:osm`-skriptissä Open-Meteon elevation-rajapinnasta, muuten proseduraaliset mäet Talmaan päin. Tiet ja rata tasoitetaan, asema-alue on tasainen, joet ja lammet kaiverretaan. Tiet käyttävät kaivertamatonta pintaa, joten ne ylittävät joet siltoina.
- **Silta** (`station.ts`: `BRIDGE`, `planRoute`): kävelysilta raiteiden yli. Reitinhaku vie sillan kautta, kun klikkaa raiteiden toiselle puolelle.
- **Sisätilat** (`src/game/interiors/interiors.ts`, `src/components/world/interiors/`): erilliset kattomattomat näkymät omissa koordinaateissaan, ovet yhdistävät ne maailmaan. Seinät madaltuvat, kun kamera on niiden takana (cutaway). Sisätilat: asematunneli, asemahalli, Prisma, vankila, kuntosali, uimahalli.
- **Kuntosali** (`src/game/gym/lifting.ts`): penkki, kyykky ja maastaveto. Levyt haetaan itse telineestä pareittain. Voima-taso rajaa kannettavan levyn painon ja nostettavan maksimin; lähellä maksimia onnistuminen on todennäköisyys.
- **Vankilapako** (`src/game/quests/`): vartijat ovat ajan puhtaita funktioita (testattavat näkökartiot), viilaus tapahtuu kun kukaan ei katso.
- **Debug**: `?debug=1` paljastaa `window.__kerava`-olion (teleport, goTo, setRoute, click, pos, local, loot, npcs, talk, shop, steal, wall, paint, stashes, give…).
- **Testit**: `npm test` (vitest) ajaa pelilogiikan yksikkötestit tiedostossa `src/game/logic.test.ts`: reppu ja kädet, kauppa ja näpistys, karma, kokkaus, graffitit ja roina.

## 14. Pelijärjestelmät (toteutettu marraskuu 2026)

Kaikki pelaajan tila on reducerissa (`src/game/store/gameReducer.ts`) ja tallentuu localStorageen (`kerava-sim:save`). Satunnaisuus ja ajastimet ovat `src/components/world/GameWorld/systems/`-hookeissa, puhtaat säännöt `src/game/*`-moduuleissa.

| Järjestelmä | Säännöt | Näkymä |
| --- | --- | --- |
| Esineet ja reppu | `src/data/items.ts` (~75 esinettä common → legendary), `INVENTORY_SIZE = 30`, `equipItem` vasen/oikea käsi, kahden käden esineet vievät molemmat | `InventoryPanel`, `items/itemModels.ts`, `LootField` (150 löytöpaikkaa, `game/world/loot.ts`) |
| Kaupat | `src/game/shop/shop.ts`: Prisma, Alepa, Motonet. Ostoskori, oikea klikkaus Osta/Varasta. `catchChance = min(0.95, 0.1 + 0.11 × näpistykset + 0.003 × hälytys)` → keskimäärin joka 3.–4. jää kiinni | `shop/ShopHud.tsx` |
| Hälytystaso | varastetut × 7 + aineet × 3, kaupassa +8 ja +6 / näpistys | `AlertMeter` |
| Karma ja aura | −100…+100. Näpistys −2, kiinnijäänti 3 × käynnin näpistykset, graffiti alueen mukaan | `KarmaChip`, `KarmaAura` |
| Poliisi ja putka | `toPutka(karma, syy)`: aika, takavarikko, karma. Poliisi pysäyttää aineiden kanssa keskustassa | `PoliceInterior` |
| NPC:t | `src/game/npc/population.ts`: 6 jengiä (sekalainen porukka), 90 kävelijää (kansalaiset, perheet, lenkkeilijät, vanhukset). `talk.ts`: huudot ja 2–3 vaihtoehdon dialogit hustlaus-checkeillä | `npc/Crowd.tsx` (max 30 lähintä) |
| Kokkaus | `src/game/cooking/recipes.ts`: 8 reseptiä, palamistodennäköisyys 33 % → 3 % tason myötä. Grillit ja nuotiot `game/world/grills.ts` | `CookHud`, `CookSpots` |
| Art / graffiti | `src/game/art/graffiti.ts`: seinän haku, alueen laatu (rähjäinen +3, siisti −4), todistajat (45 % ei välitä, 33 % suuttuu, 22 % soittaa poliisit, jengit arvostavat), poliisi 14 s:ssa | `art/GraffitiCanvas` (vapaa hiirimaalaus), `art/GraffitiWall` (tallennus `kerava-sim:graffiti`, max 16) |
| Maastokätköt | `src/game/quests/stashes.ts`: 8 kätköä (rikolliset, poliisi, geokätköilijä), ottaminen tuo takaa-ajajat ja questin | `Stashes`, `Pursuers` |
| Salin roina | `src/game/gym/roina.ts`: fiktiiviset parodiatuotteet, pelilliset vaikutukset (XP-kertoimet, energia), rasitus laskee 3 / min ja korkealla syö terveyttä | buff-palkki HUDissa |

Grafiikka: vesi ja vaahto shaderina (`materials.ts`), lumpeet ja kaislat (`WaterDetails`), ruoho ja kukat pelaajan lähellä (`GroundDetail`), puut korkeusvarjostuksella ja tuulessa huojuen (`Trees`), linnut (`Birds`), kasvojen yksityiskohdat (`humanoid/buildHumanoid.ts`), jälkikäsittely (`Effects`).

### GameWorld-kansio (refaktoroitu marraskuu 2026)

`GameWorld.tsx` oli 1 557 riviä; nyt se on noin 380-rivinen orkestroija kansiossa `src/components/world/GameWorld/`. Logiikkaa ei muutettu, vain siirretty.

| Tiedosto | Vastuu |
| --- | --- |
| `GameWorld.tsx` | jaettu tila (reitti, scene, dialogi, fade, toast), `GameCtx`-olion kokoaminen, hookien kutsujärjestys, Canvas + HUD |
| `gameWorld.types.ts`, `constants.ts` | `GameCtx`, `WorldDoor`, `Spot`, `TrainStop`; vakiot (vankila, hotspot-säteet, kyltit) |
| `useWorldSetup.ts` | kartta: maailman lataus, maasto ja törmäys, ovet, loot, NPC:t, pysäkit, kätköt, seinät |
| `systems/use*.ts` | pelijärjestelmät hookeina: kauppa ja putka, graffiti, kätköt, kokkaus, sali ja uimahalli, bussi ja juna, vankilapako, roina, parturi, poliisipartio, NPC-puhe, klikkaukset ja hotspotit |
| `GameMap.tsx`, `NPCLayer.tsx`, `WorldObjects.tsx`, `QuestLayer.tsx`, `InteriorScene.tsx`, `Player.tsx` | pelkkä 3D-renderöinti propsien perusteella |
| `GameHUD.tsx`, `hud/*` | 2D-overlayt (intro, liikenne, sali/uima/parturi, kauppa, art, buffit) |
| `useDebugHook.ts` | `window.__kerava` (`?debug=1`) |

Jokainen järjestelmähook saa `GameCtx`-olion (player, dispatch, scene, teleport, say…) ja palauttaa tilansa ja toimintonsa. Moninpelissä nämä toiminnot ovat luonteva paikka vaihtaa paikallinen `dispatch` palvelimelle lähetettäviksi intenteiksi.

Moninpeli: palvelin on omassa haarassaan (PR #2, `server/` ja `shared/`), suunnitelma ja tila tiedostossa `docs/MULTIPLAYER.md`.

### Äänet (`src/audio/`)
Kaikki äänet syntetisoidaan Web Audio API:lla (oskillaattorit, suodatettu kohina, verhokäyrät), joten äänitiedostoja ei ladata.
- `engine.ts`: AudioContext, väylät (tehosteet, käyttöliittymä, ympäristö), rajoitin, asetukset (`kerava-sim:audio`), primitiivit `tone` ja `noise`, `distanceGain`.
- `sounds.ts`: noin 45 kertaääntä reseptinä (`SOUNDS`), `sfx(id)` toistaa ja estää saman äänen pinoutumisen.
- `ambience.ts`: tuuli, liikenne, linnut päivällä, sirkat yöllä, sisätilojen ilmanvaihto, uimahallin vesi, junan jyrinä etäisyyden mukaan, paistinpannun ja spraypurkin loopit.
- `index.ts`: `installAudio` (ääni avautuu ensimmäisestä klikkauksesta, napit naksahtavat, M mykistää), `soundForAction` (GameProviderin dispatch soittaa toiminnon äänen) ja `soundForProgress` (tasonnousun fanfaari).
- Pelissä: `components/world/AudioDirector.tsx` (ympäristö ja juna, useFrame 10 Hz) ja `systems/useSoundscape.ts` (ovet, ilmoitukset, treenit, kokkaus, graffitit, rakentaminen, pakot, pudotukset, bussi, chat). Askeleet tulevat `PlayerCharacter`ista kävelyvaiheen mukaan, alusta riippuu tilasta.

### Autot (`src/game/vehicle/cars.ts`)
- Kolme mallia (`CAR_MODELS`): hinta, huippunopeus, kiihtyvyys ja ohjautuvuus. Fysiikka on yksinkertainen polkupyörämalli `stepCar`, joka törmää seiniin ja rataan ja palauttaa iskunopeuden (`crashHurt` → HP).
- Oma auto tallentuu: `Player.car {model, color, x, z, yaw}`; toiminnot `buyCar`, `sellCar` (50 %), `parkCar`.
- Pelissä: `systems/useDriving.ts` (Keravan Autotori Motonetin pihalla, kyytiin E, pois E, kolarit), `components/world/DrivableCar.tsx` (ajo useFramessa, kamera kääntyy auton taakse, moottorin ääni `setEngine`), `CarLot.tsx` ja nopeusmittari `.speedo`.

