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
- [x] Minikartta (kääntyy kameran mukana, kello, paketti- ja Pörssi-merkit)
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

## Maailma, sisätilat ja ensimmäinen quest ✅
- [x] 3D-maasto, metsät Talmaan päin, joki
- [x] Silta aseman yli, reitinhaku sillan kautta
- [x] Sisätilat: asematunneli, asemahalli, Prisma, vankila, kuntosali, uimahalli
- [x] Quest "Viilattu vapaus"
- [x] Kuntosali: penkki, kyykky, maastaveto, levyjen lastaus, voimarajat

## Seuraavaksi (jono)
- [x] Joukkoliikenne: bussipysäkit, määränpäävalikko, bussi hakee
- [x] Savio: asema, lähijuna Kerava ↔ Savio, Alepa
- [x] SHERWOOD-alkuvalikko, taustalla ilmakuva Keravasta
- [x] Hahmoeditori ja parturi
- [x] Kokkaus raaka-aineilla, Art-skilli graffiteilla
- [x] Karma ja aura, kaupan vartijat, poliisiasema ja putka
- [x] Esineet common → legendary, 30 paikan reppu, ostoskori
- [x] Maastokätköt, jotka aloittavat questin
- [ ] Tarinan pääketjut alueittain (ks. ARCHITECTURE luku 11)
- [x] Laaja grafiikkakierros, kasvojen yksityiskohdat
- [x] Esineiden 3D-mallit ja ikonit kuntoon
- [x] Koodin laadun tarkistus (yksikkötestit `npm test`)
- [x] Kaupungin elämä: jengit huutelevat, kansalaiset ja perheet, kaikille voi puhua (2–3 valintaa)
- [x] Motonet (spraymaalit, työkalut), Savion Alepa samalla kauppamekaniikalla
- [x] Salin roina-talous (fiktiiviset tuotteet, abstraktit vaikutukset)
- [x] GameWorld.tsx pilkotaan hookeiksi (useShop, useGraffiti, useStashes…)

## Moninpeli ja talous (ks. [docs/MULTIPLAYER.md](docs/MULTIPLAYER.md))
- [x] Suunnitelma: tilit, palvelinauktoriteetti, läsnäolo, kauppa, Pörssi torilla, talouden tasapaino, huijausten esto
- [x] M1 Palvelimen pohja `server/`: Fastify, PostgreSQL-skeema, migraatiot, tilit (K18), sessiot, hahmot
- [x] M2 WebSocket: läsnäolo ja näkyvyysalueet, liikkeen validointi, lähichat, nopeusrajat
- [x] M3 Kirjanpito: raha ja tavarat vain ledgerin kautta, tarkastus
- [x] M4 Pelaajien kauppa: kaksoisvahvistus, atominen commit, dupetustestit
- [x] M5 Client online-tilaan: kirjautuminen, muut pelaajat, chat, kauppaikkuna
- [ ] M5b Online-lompakko ja yksinpelin tallennus yhteen (nyt verkkokaupassa liikkuu palvelimen raha ja reppu, ei paikallinen tallennus)
- [ ] M6 Aktiviteetit, NPC-kaupat ja questit palvelimelle
- [x] M7 Kerava-Pörssi torilla: tietokantaintegraatio, escrow, noutolaatikko, ohjehinta, hintahistoria, Torikauppias (NPC), paviljonki ja Pörssi-ikkuna
- [ ] Online-tavaroiden lähteet palvelimelle (M6): kokkaus, löydöt, työt, jotta muutakin kuin kaupan tavaraa liikkuu
- [ ] M8 Talouden mittarit, admin-työkalut, moderointi, varmuuskopiot
- [ ] M9 Katukauppa ja poliisi palvelimella, Areena PvP

## Marraskuun loppu 2026 ✅
- [x] Pakettipudotukset: laskuvarjolaatikko 6–12 min välein, aina legendaarinen esine (Kultainen sorkkarauta ja Kultainen Nokka 3310 vain paketeista)
- [x] K-Rauta Motonetin viereen, 10 uutta rakennustarviketta
- [x] Talon laajennukset (kukkapenkit, terassi, aita, lisäeristys, pihasauna, autotalli, aurinkopaneelit), maalaus, lepo kotona, vuokraus
- [x] Vuorokausirytmi: aurinko liikkuu, ilta, yö, tähdet, valaistut ikkunat, katulamput, kello
- [x] Kauppahallien julkisivut (Motonet, K-Rauta, salit, uimahalli)
- [x] Bugikierros: quest-esine mahtuu aina reppuun, raha senttitarkkuudella
- [x] Äänet: kaikki tehosteet syntetisoidaan selaimessa (src/audio), ympäristöäänet vuorokauden ja paikan mukaan, askeleet, juna, äänenvoimakkuus valikossa, M mykistää
- [ ] Taustamusiikki
- [ ] Kalastus-skillille oma aktiviteetti (skilli on listalla, mutta sitä ei vielä voi harjoittaa)

## Myöhemmin
- [ ] PostGIS
- [ ] Maailma chunkeiksi, koko Kerava
- [ ] Omat glTF-mallit (hahmo, puut, maamerkit)
- [ ] Achievementit, daily/weekly, minipelit, GPS
