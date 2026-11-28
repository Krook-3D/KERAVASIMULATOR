# Kerava Simulator

Selaimessa pelattava 3D-roolipeli (K18), joka sijoittuu Keravalle. Pelaaja luo hahmon, saapuu junalla asemalle ilman lippua ja kehittää kymmentä taitoa tekemällä asioita kaupungissa: salilla, keittiössä, kaduilla, rakennustyömaalla ja Kerava-Pörssissä. Peli on oma, RuneScape-tyyliseen kehitykseen pohjautuva kokonaisuus, eikä se kopioi muita pelejä.

Kattava raportti kaikista ominaisuuksista ja niiden toteutuksesta: [Kerava Simulator: ominaisuudet ja toteutus](https://claude.ai/artifact/63zi2Hn8nwMu9B7tkzC6yF).

## Pelin käynnistys

Vaatii Node.js 22+.

```bash
npm install
npm run dev        # peli osoitteessa http://localhost:5173
npm test           # pelisääntöjen yksikkötestit (vitest)
npm run build      # tyyppitarkistus ja tuotantobuild
```

Oikean Keravan kadut, rakennukset, sillat ja alikulut haetaan OpenStreetMapista. Ilman tätä peli käyttää sisäänrakennettua varakaupunkia.

```bash
npm run fetch:osm          # kirjoittaa public/data/kerava-world.json (oletus 700 m säde asemasta)
npm run fetch:osm -- 1200  # isompi alue
```

### Moninpelipalvelin (valinnainen)

Yksinpeli toimii ilman palvelinta ja tallentuu selaimeen. Verkkopeli (tilit, muut pelaajat, chat, kaupankäynti ja Kerava-Pörssi) tarvitsee PostgreSQL:n ja palvelimen:

```bash
cd server
npm install
npm run migrate        # luo taulut (oletus: postgres://kerava:kerava@localhost:5432/kerava)
npm start              # http://localhost:8787, Vite välittää /api-kutsut sinne
```

Asetukset luetaan ympäristömuuttujista (mallit tiedostossa `server/.env.example`, jota ei lueta automaattisesti).

Lisätiedot: [server/README.md](server/README.md) ja [docs/MULTIPLAYER.md](docs/MULTIPLAYER.md).

## Ohjaus

| Näppäin | Toiminto |
| --- | --- |
| Klikkaus pelialueelle | Lukitsee hiiren, ja hiiri kääntää kameraa |
| Nuolet tai WASD | Liikkuminen kameran suuntaan |
| E | Käytä lähintä kohdetta (ovi, hylly, laite, NPC) |
| Hiiren oikea nappi | Kohteen toimintovalikko |
| Välilyönti | Pakotilanteissa: hakkaa paetaksesi |
| M | Äänet päälle tai pois |
| Esc | Vapauttaa hiiren |

## Mitä pelissä on

- **Kerava 3D:nä:** maasto ja mäet, asema ja lähijuna, radan ylitykset, kadut suojateineen ja jalkakäytävineen, metsät, katulamput, minikartta ja vuorokausirytmi (36 minuutin päivä, ilta, yö ja tähdet).
- **Kymmenen taitoa:** Voima, Kestävyys, Juoksu, Ruoanlaitto, Kalastus, Hustlaus, Art, Kamppailu, Rakentaminen ja Kyttien pakoilu, tasot 1–50.
- **Hahmo:** hahmonluonti, parturi, vartalo joka muuttuu treenin mukaan, karma-aura ja kolmannen persoonan kamera.
- **Sisätilat:** Prisma, Alepa, Motonet, K-Rauta, kuntosali, uimahalli, Ahjo Training Center, parturi, poliisiasema, putka, asema ja tunneli.
- **Aktiviteetit:** painot, uinti, säkki, paini ja sparri, kahdeksan reseptin kokkaus, vapaalla kädellä maalattavat graffitit ja rakentaminen.
- **Esineet:** 102 esinettä ja 30-paikkainen reppu. Kaupungissa on 150 löytöpaikkaa, ja pakettipudotukset tuovat aina legendaarisen esineen (Kultainen Rolux, kultainen sorkkarauta, Kultainen Nokka 3310 tai kultaharkko).
- **Kaupat ja rikollisuus:** ostaminen tai varastaminen, karma, hälytystaso, vartijat, poliisipartiot ja putka. Fiktiivinen katukauppa jengien kanssa, jossa on huijausriski.
- **Kaupungin elämä:** noin 90 asukasta ja kuusi sekakokoonpanoista jengiä, haarautuvat keskustelut, provosointi ja tappelut.
- **Questit:** Viilattu vapaus -vankilapako ja kahdeksan maastokätköä, joilla on omistajat.
- **Liikkuminen:** bussit pysäkeiltä, lähijuna Keravan ja Savion välillä sekä lipuntarkastajat.
- **Tontit ja talot:** 42 ostettavaa tonttia, neljä rakennusvaihetta, seitsemän laajennusta (piha, terassi, aita, eristys, sauna, autotalli ja aurinkopaneelit), maalaus, lepo kotona ja vuokraus. Materiaalit saa Motonetista ja K-Raudasta.
- **Moninpeli:** tilit, muut pelaajat ja chat, pelaajien välinen kauppa kaksoisvahvistuksella sekä Kerava-Pörssi torilla: tilauskirja, välitystili ja noutolaatikko.
- **Äänet:** kaikki tehosteet ja ympäristöäänet syntetisoidaan selaimessa, joten äänitiedostoja ei ladata.

## Tekniikka

- **Selain:** React 19, Vite, TypeScript (strict), Three.js ja React Three Fiber, drei, postprocessing, Web Audio API.
- **Palvelin:** Node.js 22, Fastify, ws, zod ja PostgreSQL.
- **Rakenne:**
  - `src/game/` sisältää pelisäännöt puhtaina, testattavina funktioina.
  - `src/components/world/` sisältää 3D-maailman. Pelijärjestelmät ovat hookeja kansiossa `GameWorld/systems/`.
  - `src/data/` sisältää esineet ja taidot.
  - `src/audio/` sisältää äänimoottorin.
  - `shared/` sisältää säännöt, jotka selain ja palvelin jakavat.
  - `server/` on moninpelipalvelin.
- **Testit:** 66 pelisääntötestiä (`npm test`) ja 69 palvelintestiä (`cd server && npm test`).
- **Debug:** `?debug=1` osoitteen perässä tuo konsoliin komennot `window.__kerava` (teleport, kamera, tontit, kaupat), `__keravaDrop()` ja `__keravaHour(h)`.

## Dokumentaatio

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): arkkitehtuuri, tietomalli ja järjestelmien kuvaus
- [docs/MULTIPLAYER.md](docs/MULTIPLAYER.md): moninpelin suunnitelma ja vaiheet
- [TODO.md](TODO.md): tehtävälista ja seuraavat askeleet

Karttadata © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Kaikki hahmot, järjestöt ja tapahtumat ovat keksittyjä.

---

# Alkuperäinen suunnitteluohje (English design brief)

The section below is the original design brief the project was started from. It is kept for reference; the current state of the game is described above.

## Project Context

Kerava Simulator is a browser-based open-world life simulator / RPG set in the real city of Kerava, Finland.

The project takes inspiration from games such as RuneScape and local browser-based games such as Myyr York, but it is an original game with its own mechanics, visual identity, progression system and humor.

The goal is to create a playable digital version of Kerava where the player creates a character, explores the city, completes quests, develops skills, collects items, earns money and gradually unlocks new content.

The game should feel like a real game rather than a generic web application.

---

## Core Concept

The player lives in Kerava and develops their character through activities.

The basic gameplay loop is:

```text
EXPLORE
   ↓
DO ACTIVITIES
   ↓
EARN XP / MONEY / ITEMS
   ↓
LEVEL UP
   ↓
UNLOCK CONTENT
   ↓
COMPLETE HARDER QUESTS
   ↓
EXPLORE MORE
```

The real-world city of Kerava is the foundation of the game world.

The map should eventually contain real streets, locations, parks, shops, services, landmarks and other points of interest.

The first version should focus only on Kerava.

Do not expand to Helsinki, Espoo, Vantaa or the rest of Finland until the Kerava gameplay foundation works.

---

# Game Identity

The game should combine:

- RPG progression
- life simulation
- exploration
- local humor
- quests
- skill development
- inventory management
- economy
- map exploration
- character progression

The game should have a humorous Finnish/Kerava atmosphere while still having enough serious game systems to support long-term progression.

The game should NOT simply become:

- a map application
- a fitness tracker
- a todo app
- a generic dashboard
- a RuneScape clone

The goal is a distinct game.

---

# Player

Every player has a persistent character.

Basic player data:

```text
id
name
level
xp
money
health
energy
skills
inventory
equipment
quests
achievements
reputation
location
```

The player should be able to see their character progression clearly.

---

# Skills

Skills are one of the core progression systems.

Initial skills:

```text
Strength
Endurance
Running
Cooking
Fishing
```

Additional skills may be introduced later.

Each skill contains:

```text
level
xp
xpToNextLevel
activities
unlocks
rewards
```

Skills should interact with the rest of the game.

For example:

```text
Running level
    ↓
unlocks better running activities

Cooking level
    ↓
unlocks better recipes

Fishing level
    ↓
unlocks better fishing locations/items
```

Do not create dozens of skills before the core skill system has been tested.

---

# XP & Leveling

The game uses a custom XP system inspired by RPGs.

Do NOT copy RuneScape's exact XP curve.

Example:

```text
Level 1 → 0 XP
Level 2 → 100 XP
Level 3 → 250 XP
Level 4 → 450 XP
...
```

The exact progression curve can be adjusted during development.

Level-ups should provide meaningful rewards.

Possible rewards:

- new activities
- new quests
- new items
- new areas
- better rewards
- cosmetic unlocks
- titles

---

# Quest System

Quests are a major gameplay system.

A quest can contain:

```text
quest id
title
description
NPC
requirements
objectives
locations
rewards
XP
money
items
completion state
```

Example:

```text
Quest:
Keskustan mysteeri

Objectives:
1. Visit Kerava station
2. Talk to NPC
3. Find an item
4. Return to NPC

Rewards:
250 XP
50 €
1 item
```

Quests should use Kerava-specific locations whenever possible.

Quest writing should be humorous, local and Finnish.

---

# NPC System

NPCs are used for:

- quests
- shops
- dialogue
- services
- tutorials
- story
- humor

NPC data should be modular.

Example:

```text
id
name
description
location
dialogue
quests
shop
services
```

Do not hardcode NPC behavior directly into UI components.

---

# Items

Items are persistent game objects.

Item categories:

```text
Food
Tools
Materials
Equipment
Quest Items
Collectibles
Misc
```

Items should have reusable definitions.

Example:

```text
id
name
description
category
value
rarity
effects
requirements
```

Avoid duplicating item logic throughout the application.

---

# Inventory

Players have an inventory containing item instances.

The inventory system must support:

- adding items
- removing items
- item quantities
- item descriptions
- item values
- future equipment support

Inventory logic should live in the game domain layer rather than being scattered across React components.

---

# Economy

The game uses an internal currency represented as €.

Players can earn money through:

- quests
- jobs
- activities
- selling items
- minigames
- exploration

Money can be spent on:

- food
- equipment
- tools
- clothing
- services
- transportation
- other game systems

The economy must be designed so that progression does not become meaningless because money is too easy to obtain.

---

# Map

The map is a central part of Kerava Simulator.

The initial map should use real Kerava geography.

Preferred technology:

```text
OpenStreetMap
Three.js + React Three Fiber (3D, RuneScape-style third-person view)
```

The map should eventually support:

- player location
- POIs
- quest locations
- NPC locations
- shops
- activities
- discovered locations
- locked/unlocked areas

The first version does NOT need real GPS tracking.

Start with an interactive game map.

GPS can be added later.

---

# Real-World Locations

Real-world locations can become gameplay locations.

Examples:

- Kerava station
- city centre
- parks
- sports locations
- shops
- restaurants
- libraries
- schools
- forests
- recreational areas
- other notable locations

Do not assume every real-world location needs to become an interactive location.

Only use locations that improve gameplay.

---

# Local Humor

Kerava Simulator should have a strong local identity.

Possible content:

- Finnish humor
- Kerava references
- absurd NPCs
- local stereotypes used carefully
- strange quests
- easter eggs
- collectible items
- fictional organizations
- fictional characters

The humor should support the game instead of replacing gameplay.

---

# Technology

Preferred initial stack:

## Frontend

```text
React
Vite
TypeScript
```

## Map

```text
Three.js + React Three Fiber (3D, RuneScape-style third-person view)
OpenStreetMap
```

## Backend

```text
Node.js
TypeScript
```

## Database

```text
PostgreSQL
PostGIS
```

Use a clean API architecture.

Possible future technologies:

```text
WebSockets
Redis
authentication
cloud hosting
mobile wrapper
GPS
multiplayer
```

Do not introduce technologies without a clear reason.

---

# Architecture Principles

The project should be modular.

Separate:

```text
UI
Game logic
Data
API
Database
```

Game logic should not be tightly coupled to React components.

Prefer reusable domain systems such as:

```text
PlayerSystem
SkillSystem
QuestSystem
InventorySystem
ItemSystem
EconomySystem
NPCSystem
MapSystem
AchievementSystem
```

Each system should have clear responsibilities.

Avoid creating one enormous component or one enormous file.

---

# Project Structure

A possible structure:

```text
src/
  components/
  pages/
  game/
    player/
    skills/
    quests/
    inventory/
    items/
    economy/
    npc/
    map/
    achievements/
  data/
  services/
  api/
  types/
  utils/

server/
  api/
  services/
  database/
  models/
  auth/
```

The exact structure can evolve if a better architecture is discovered.

Do not reorganize the project unnecessarily.

---

# UI / UX

The game should look like a browser game.

Avoid making it look like:

- SaaS software
- admin dashboard
- corporate application

Desired feeling:

```text
modern
game-like
urban
Finnish
slightly retro
humorous
clean
```

The UI should prioritize gameplay information.

Important screens:

```text
Game
Map
Character
Skills
Inventory
Quests
Shop
Achievements
```

---

# Development Rules

## 1. Build incrementally

Never attempt to implement the entire game at once.

Build small working systems.

Example:

```text
Player
↓
XP
↓
Skill
↓
Quest
↓
Reward
↓
Inventory
↓
Map
```

---

## 2. Keep the game playable

After every major feature, the application should still run.

Do not leave the project in a permanently broken state while implementing multiple systems.

---

## 3. Use TypeScript properly

Avoid unnecessary:

```text
any
```

Define clear types/interfaces for game entities.

---

## 4. Keep data separate from UI

Game definitions such as items, quests, NPCs and skills should not be hardcoded inside React presentation components.

---

## 5. Git

Use Git throughout development.

Make focused commits.

Example:

```text
feat: add player system
feat: add skill progression
feat: add quest system
feat: add Kerava map
fix: persist player XP
```

Do not create giant commits containing unrelated changes.

---

# MVP

The first playable MVP should contain:

## Player

- character creation
- name
- level
- XP
- money

## Skills

- Strength
- Endurance
- Running
- Cooking
- Fishing

## Map

- Kerava
- basic interactive map
- approximately 10 POIs

## Quests

- approximately 5 quests

## NPCs

- approximately 5 NPCs

## Items

- approximately 15 items

## Inventory

- basic inventory system

## Progression

- XP
- levels
- rewards

## Persistence

Player progression must survive page refreshes.

---

# MVP Success Criteria

The MVP is successful when a player can:

```text
Open the website
    ↓
Create a character
    ↓
See Kerava
    ↓
Explore the map
    ↓
Find a POI
    ↓
Accept a quest
    ↓
Complete the quest
    ↓
Receive XP
    ↓
Level up a skill
    ↓
Receive money/item
    ↓
See the reward in inventory
    ↓
Refresh the page
    ↓
Progress remains saved
```

This complete loop is more important than the number of features.

---

# Future Expansion

The architecture should allow future additions such as:

- Helsinki
- Espoo
- Vantaa
- entire Finland
- GPS gameplay
- multiplayer
- clans
- trading
- player-to-player economy
- seasonal events
- daily quests
- weekly challenges
- achievements
- leaderboards
- minigames
- mobile version
- real-world events
- businesses and sponsored locations

Do not implement these prematurely.

---

# Current Development Priority

Always prioritize:

1. Playability
2. Core game loop
3. Clean architecture
4. Good UX
5. Persistence
6. Expandability
7. Visual polish

Do not spend significant time polishing features that are not yet connected to the core gameplay loop.

---

# Claude Code Working Instructions

You are working as the primary development agent for Kerava Simulator.

Before making large changes:

1. Inspect the existing project.
2. Understand the current architecture.
3. Reuse existing systems where appropriate.
4. Do not overwrite working functionality unnecessarily.
5. Implement one coherent feature at a time.
6. Test the result.
7. Fix errors before moving forward.
8. Update documentation when architecture changes.

When uncertain between a simple and a complex implementation, prefer the simplest implementation that does not block future expansion.

Do not overengineer the MVP.

The goal is not to build the final version immediately.

The goal is to create a solid foundation for a real browser game.

---

# Immediate Goal

The immediate goal is to create the first playable Kerava Simulator prototype.

Start by inspecting the repository and determining what already exists.

Then establish:

```text
React + TypeScript
        ↓
Game shell
        ↓
Player system
        ↓
Skill system
        ↓
XP system
        ↓
Map
        ↓
Quest system
        ↓
Inventory
        ↓
Persistence
```

Do not build advanced multiplayer, GPS or a complete economy yet.

First make the basic game loop work.

## Project principle

**Build the smallest version that is genuinely fun to interact with, then expand it into a real game.**
