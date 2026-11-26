# TODO

Vaiheet: ks. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#8-kehitysjärjestys).

## Vaihe 1: Projektin pohja ✅
- [x] Arkkitehtuuri, kansiorakenne, MVP-lista, tietomalli, UI-rakenne, karttaratkaisu
- [x] Vite + React + TypeScript
- [x] MapLibre-kartta Keravasta (OSM-tiilet), rajattu Keravan alueelle
- [x] Pelaajahahmo kartalla (Keravan asema)
- [x] Hahmo kävelee klikattuun kohtaan

## Vaihe 2: Pelin UI-runko
- [ ] HUD: level, XP-palkki, raha, energia
- [ ] Alapalkki: Kartta / Hahmo / Skillit / Reppu / Questit
- [ ] Paneelikomponentti kartan päälle
- [ ] Visuaalinen teema (fontit, värit)

## Vaihe 3: Player
- [ ] Game store (reducer + context)
- [ ] Hahmon luonti -ruutu (nimi, väri)
- [ ] localStorage-tallennus (`kerava-sim:save`, versio 1)

## Vaihe 4–5: Skillit ja XP
- [ ] XP-käyrä `src/game/xp`
- [ ] 5 skilliä, skill-paneeli
- [ ] Level-up-ilmoitus

## Vaihe 6–7: Liikkuminen ja POI:t
- [ ] Energia kuluu liikkuessa, Running/Endurance XP matkasta
- [ ] 10 POI:ta `src/data/pois.ts`
- [ ] POI-kortti ja aktiviteetit
- [ ] Aktiviteettijärjestelmä: vaatimus, kesto, energiankulutus, XP + saalis (RuneScape-henkinen skillaus)

## Vaihe 8–10: Questit, inventory, NPC:t
- [ ] 5 questia, quest-tracker
- [ ] 15 itemiä, inventory-paneeli (käytä/myy)
- [ ] 5 NPC:tä, dialogi, kauppa

## Myöhemmin
- [ ] Backend (Node + TS, REST) ja PostgreSQL/PostGIS
- [ ] Oma vektorikarttatyyli / oma tiilipalvelu ennen julkaisua
- [ ] Achievementit, daily/weekly, minipelit, GPS
