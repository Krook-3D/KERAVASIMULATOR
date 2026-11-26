# TODO

Vaiheet: ks. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#8-kehitysjärjestys).

## Vaihe 1: Projektin pohja ✅
- [x] Arkkitehtuuri, kansiorakenne, MVP-lista, tietomalli, UI-rakenne, karttaratkaisu
- [x] Vite + React + TypeScript
- [x] 3D-maailma (React Three Fiber): maa, tiet, rata, vedet, puistot, rakennukset
- [x] OSM-hakuskripti `npm run fetch:osm` + väliaikainen keskusta ilman dataa
- [x] Low-poly-pelaajahahmo Keravan asemalla, kävelyanimaatio
- [x] Klikkaa ja kävele, seinätörmäys
- [x] Kolmannen persoonan kamera: raahaus, rulla, nuolet / WASD
- [x] Läpinäkyvä reikä rakennuksissa kameran ja pelaajan välissä

## Grafiikka ja intro ✅
- [x] Taivas, pilvet, ympäristövalo, varjot, AO/bloom (Korkea/Kevyt-valinta HUDissa)
- [x] Proseduraaliset julkisivut ikkunoineen, harjakatot, suomalainen värimaailma
- [x] Jalkakäytävät, tiemerkinnät, katuvalot, parkkiautot, rata ratapölkkyineen
- [x] Kuuset, männyt ja koivut
- [x] Keravan asema: laituri, katos, asemarakennus, kyltit, penkit, matkustajat
- [x] Lähijuna liukuovineen, kiertää asemalla
- [x] Intro: lipuntarkastaja heittää pelaajan ulos junasta ("Voihan vittu."), ohitettavissa
- [ ] Omat glTF-mallit myöhemmin, äänet ja musiikki
- [ ] Hahmolle ja junalle törmäys, reitinhaku

## Vaihe 2: Pelin UI-runko ✅
- [x] HUD: level, XP-palkki, raha, energia
- [x] Alapalkki: Kartta / Hahmo / Skillit / Reppu / Questit
- [x] Paneelikomponentti kartan päälle
- [x] Visuaalinen teema (fontit, värit)

## Vaihe 3: Player ✅
- [x] Game store (reducer + context)
- [x] Hahmon luonti -ruutu (nimi, väri, K18-vahvistus)
- [x] localStorage-tallennus (`kerava-sim:save`, versio 1)

## Vaihe 4–5: Skillit ja XP
- [ ] XP-käyrä `src/game/xp`
- [ ] 5 skilliä, skill-paneeli
- [ ] Level-up-ilmoitus

## Vaihe 6–7: Liikkuminen ja POI:t
- [ ] Aja `npm run fetch:osm` ja commitoi oikea Keravan data
- [ ] Reitinhaku rakennusten ympäri
- [ ] Minikartta
- [ ] Energia kuluu liikkuessa, Running/Endurance XP matkasta
- [ ] 10 POI:ta `src/data/pois.ts`
- [ ] POI-kortti ja aktiviteetit
- [ ] Aktiviteettijärjestelmä: vaatimus, kesto, energiankulutus, XP + saalis (RuneScape-henkinen skillaus)

## Vaihe 8–10: Questit, inventory, NPC:t
- [ ] 5 questia, quest-tracker
- [ ] 15 itemiä, inventory-paneeli (käytä/myy)
- [ ] 5 NPC:tä, dialogi, kauppa

## Vaihe 10b: Aseman Areena (vain Keravan asemalla)
- [ ] `src/game/duel/`: tila, liikkeet (Tönäisy / Torjunta / Väistö), stamina, vuoron ratkaisu
- [ ] 3–5 NPC-haastajaa `src/data/duelists.ts`
- [ ] Panos ja asemamaksu, palkinnot (XP, raha, rankki, collectible)
- [ ] DuelScreen-UI
- [ ] Myöhemmin: PvP backendin kautta

## Vaihe 10c: Katukauppa, heat ja poliisi (K18)
- [ ] Fiktiiviset aineet ja välittäjä-NPC:t `src/data/street.ts`
- [ ] Markkina: alue- ja päiväkohtaiset hinnat, satunnaistapahtumat
- [ ] Kotivarasto (home-POI) ja repun kantoraja
- [ ] Heat-mittari HUDiin, nousu ja lasku
- [ ] Poliisipartiot kartalle, jahti-minipeli (Running/Endurance)
- [ ] Satunnaiset kotietsinnät: todennäköisyys heatin ja kotivaraston mukaan
- [ ] Kuulustelu: dialogi skill-check-vaihtoehdoilla (Charisma, Knowledge, reputation)
- [ ] Vankila: tuomion kesto, vankila-aktiviteetit ja -NPC:t, takavarikko
- [ ] Charisma- ja Knowledge-skillit
- [ ] Katukaupan maine ja rangit

## Myöhemmin
- [ ] Backend (Node + TS, REST) ja PostgreSQL/PostGIS
- [ ] Maailma chunkeiksi, koko Kerava
- [ ] Omat glTF-mallit (hahmo, puut, maamerkit)
- [ ] Achievementit, daily/weekly, minipelit, GPS
