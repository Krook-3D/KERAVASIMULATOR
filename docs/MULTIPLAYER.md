# Kerava Simulator: moninpeli, talous ja kaupankäynti

Tämä dokumentti kuvaa, miten Kerava Simulator julkaistaan netissä moninpelinä: tilit, palvelin, pelaajien näkyminen toisilleen, pelaajien välinen kauppa, Pörssi (oma kaupankäyntijärjestelmä) ja talouden tasapaino. Tavoite on, että talous on mietitty loppuun asti ennen kuin ensimmäinen pelaaja kirjautuu sisään, koska rikki mennyttä taloutta (dupetus, inflaatio, botit) on lähes mahdoton korjata jälkikäteen.

Toteutus on aloitettu kansioissa `server/` ja `shared/`. Luku 22 kertoo mitä on jo tehty.

## 0. Periaatteet

1. **Palvelin on totuus.** Client näyttää, palvelin päättää. Client ei koskaan lähetä "minulla on nyt 500 €" tai "sain ahvenen". Se lähettää aikeita ("kävele tänne", "aloita kalastus", "lisää kauppaan 3 ahventa") ja palvelin tarkistaa, onko aie sallittu.
2. **Raha ja tavarat liikkuvat vain tietokantatransaktiossa.** Jokainen muutos kirjataan kirjanpitoon (`ledger`). Muistissa oleva tila (kaupan ikkuna, läsnäolo) on vain väliaikaista. Jos palvelin kaatuu kesken kaupan, kumpikaan ei menetä mitään eikä mitään synny tyhjästä.
3. **Raha ei synny eikä katoa huomaamatta.** Jokaisella rahan lähteellä (faucet) ja nielulla (sink) on nimi, ja niitä mitataan päivittäin. Talouden säätö on konfiguraatiota, ei koodimuutoksia.
4. **Oletuksena epäluottamus.** Jokaisella viestillä on skeema, koko- ja nopeusraja. Kaikki mikä voi mennä rikki menee rikki: tuplaklikkaukset, verkon katkot, samanaikaiset pyynnöt kahdesta välilehdestä.
5. **Modulaarinen monoliitti.** Yksi Node.js-palvelinprosessi, jonka sisällä selkeät moduulit (auth, presence, trade, market, economy). Moduulit puhuvat toisilleen rajapintojen kautta, joten ne voi myöhemmin erottaa omiksi palveluikseen. Ei mikropalveluja ennen kuin niitä tarvitaan.
6. **Offline-peli säilyy.** Nykyinen selainpeli localStorage-tallennuksella on edelleen yksinpelitila. Online-hahmo on erillinen eikä yksinpelin tallennusta voi tuoda verkkoon (muuten localStoragen muokkaamalla saisi rikkaan online-hahmon).

## 1. Arkkitehtuuri

```text
 Selain (React + Three.js)
   │  HTTPS: /api/auth/*, /api/characters/*, /api/market/* (REST, JSON)
   │  WSS:   /ws  (reaaliaikainen: liike, läsnäolo, chat, kauppa)
   ▼
 Reverse proxy (Caddy): TLS, gzip, staattiset tiedostot, IP-rajat
   ▼
 server/ (Node.js 22 + TypeScript, Fastify + ws)
   ├─ auth/       tilit, salasanat, sessiot
   ├─ characters/ online-hahmot
   ├─ economy/    raha- ja tavaraoperaatiot + kirjanpito (ainoa paikka joka muuttaa saldoja)
   ├─ presence/   kuka on missä, näkyvyysalueet, liikkeen validointi
   ├─ trade/      pelaajien välinen kauppa (tilakone + atominen commit)
   ├─ market/     Pörssi: tarjouskirja, täsmäytys, escrow, hintahistoria
   ├─ chat/       lähichat, yksityisviestit, suodatus
   ├─ ws/         yhteydet, protokolla, skeemavalidointi, nopeusrajat
   └─ db/         PostgreSQL-yhteys, migraatiot
   ▼
 PostgreSQL 16 (+ PostGIS myöhemmin)   ·   myöhemmin Redis (maailmojen välinen pub/sub)

 shared/  tyypit ja säännöt, joita sekä client että palvelin käyttävät
          (protokolla, itemien kaupattavuus, verot, etäisyydet)
```

Valinnat ja perustelut:

| Asia | Valinta | Miksi |
| --- | --- | --- |
| HTTP | Fastify | Nopea, TypeScript-tyypit, hyvä plugin-ekosysteemi |
| WebSocket | `ws` | Kevyt ja vakaa, ei turhaa abstraktiota (Socket.IO:n fallbackeja ei tarvita) |
| Validointi | zod | Skeema ja TypeScript-tyyppi samasta lähteestä, tarkistetaan että vastaa `shared/protocol.ts`:ää |
| Tietokanta | PostgreSQL, `pg` + käsin kirjoitettu SQL | Transaktiot, rivilukot ja rajoitteet ovat talouden turvaverkko. ORM piilottaisi juuri ne asiat joita pitää kontrolloida |
| Salasanat | Node `crypto.scrypt` | Muistiraskas hash ilman natiiviriippuvuuksia |
| Sessiot | Satunnainen token, tietokantaan vain SHA-256-tiiviste | Voi mitätöidä heti (bannit, uloskirjautuminen kaikkialta), ei JWT:n mitätöintiongelmaa |
| Testit | vitest + oikea PostgreSQL | Talouden bugit näkyvät vain oikeilla transaktioilla |

## 2. Tilit ja kirjautuminen

**Rekisteröinti**: sähköposti, salasana (vähintään 10 merkkiä, ei yleisimpien vuotaneiden listalta), käyttäjänimi tilille ei näy muille. **K18-vahvistus** tallennetaan tilille (aikaleima + ehtojen versio). Peliin ei pääse ilman sitä.

**Salasanat**: scrypt (N=2^15, r=8, p=1, 64-tavuinen avain, 16-tavuinen suola). Tallennusmuoto `scrypt$N$r$p$suola$hash`, joten parametreja voi nostaa myöhemmin ja vanhat hashit päivittyvät kirjautuessa.

**Sessiot**:
- Kirjautuminen palauttaa 32-tavuisen satunnaisen tokenin. Tietokantaan tallennetaan vain `sha256(token)`, joten tietokantavuoto ei anna kenellekään sisäänpääsyä.
- Selain saa tokenin `HttpOnly; Secure; SameSite=Strict` -evästeenä. WebSocket-yhteys avataan samalta originilta, ja eväste tulee mukana automaattisesti. Lisäksi `Origin`-otsake tarkistetaan (estää cross-site WebSocket -kaappauksen).
- Session kesto 30 päivää, liukuva. Salasanan vaihto mitätöi kaikki muut sessiot.

**Brute force**: kirjautumisyrityksiä rajoitetaan sekä IP:n että tilin mukaan (5 epäonnistunutta / 15 min / tili, 30 / 15 min / IP). Virheviesti on aina sama "väärä sähköposti tai salasana", ettei tilien olemassaoloa voi urkkia.

**Myöhemmin**: sähköpostin vahvistus ennen kaupankäyntiä, salasanan palautus, TOTP-kaksivaiheinen tunnistautuminen (pakollinen ennen kuin voi myydä yli X arvosta), "tunnistamaton laite" -ilmoitus.

**Tilan tilat**: `active`, `muted` (ei chattia), `trade_banned` (ei kauppaa, ei Pörssiä), `banned`. Bannit ovat aikarajallisia tai pysyviä, ja jokaisella on syy ja moderaattori kirjattuna.

**GDPR**: tilin poisto anonymisoi henkilötiedot (sähköposti, IP:t) mutta säilyttää kirjanpitorivit anonyymisti, koska muuten toisten pelaajien kauppahistoria rikkoutuisi.

## 3. Online-hahmot

- Yksi hahmo per tili alkuun (tilaa on valmiina useammalle: `characters.account_id` ei ole uniikki, vaan raja on asetus).
- Hahmon nimi: 3–12 merkkiä, kirjaimet (myös ä, ö, å), numerot, väli ja alaviiva; uniikki kirjainkoosta riippumatta; kiellettyjen sanojen lista; nimiä ei voi vaihtaa ilman moderaattoria tai maksullista nimenvaihtoa myöhemmin.
- Aloitus kuten yksinpelissä: 50 €, 100 health, 100 energy, Keravan asema.
- Hahmon tila on tietokannassa normalisoituna: raha `characters.money`, tavarat `inventory_items`, skillit `character_skills`, questit `character_quests`. Ei yhtä isoa JSON-blobia, koska silloin rivilukot ja rajoitteet eivät toimisi.

## 4. Palvelinauktoriteetti: mitä client saa päättää

| Asia | Client | Palvelin |
| --- | --- | --- |
| Kameran kulma, grafiikka, UI | päättää | ei välitä |
| Liike | lähettää sijainnin ja kohteen | tarkistaa nopeuden ja alueen, korjaa sijainnin jos huijaa |
| Aktiviteetit (kalastus, sali) | pyytää aloitusta | tarkistaa etäisyyden POI:hin, vaatimukset, energian, ajastaa keston, arpoo saaliin ja antaa XP:n |
| Questit | pyytää etenemistä ("puhu NPC:lle") | tarkistaa tavoitteen ja antaa palkinnon |
| NPC-kaupat | pyytää ostoa/myyntiä | hinta, varasto ja raha lasketaan palvelimella |
| Raha, tavarat, XP | **ei koskaan** | ainoa lähde |
| Satunnaisuus | ei | palvelimen RNG (saalis, jahdit, ratsiat, duelit) |

**Liikkeen validointi**: client lähettää sijaintinsa enintään 10 kertaa sekunnissa. Palvelin laskee edellisestä hyväksytystä sijainnista kuljetun matkan ja vertaa sitä `maksiminopeus × aika × 1.25` (toleranssi verkon heilunnalle). Ylitys hylätään ja client saa `correction`-viestin palvelimen tietämällä sijainnilla. Toistuvat ylitykset kirjataan epäilyttävinä (speedhack). Maailman rajat tarkistetaan aina. Törmäystarkistus palvelimella tulee myöhemmin (sama `collision.ts` siirretään `shared/`:iin), aluksi riittää nopeus + rajat, koska seinän läpi kävely ei anna taloudellista hyötyä niin kauan kuin aktiviteetit vaativat etäisyyden POI:hin.

**Aktiviteettien ajoitus**: aktiviteetti kestää esim. 4 s. Palvelin kirjaa aloitusajan ja antaa palkinnon vasta kun aika on kulunut ja pelaaja on yhä paikalla. Client voi näyttää animaation, mutta nopeampi client ei saa enempää saalista. Tämä estää automaattisen "pikaskillaamisen". Bottien tunnistuksesta luvussa 16.

## 5. Protokolla

Viestit ovat JSON-objekteja `{ "t": "tyyppi", ... }`. Tyypit on määritelty tiedostossa `shared/protocol.ts`, palvelin validoi jokaisen saapuvan viestin zod-skeemalla (`server/src/ws/schemas.ts`). Tuntematon tai virheellinen viesti → `error`-viesti, toistuvat virheet → yhteys katkaistaan.

- **Versio**: ensimmäinen palvelimen viesti on `welcome { protocol, you, tickRate }`. Jos clientin protokollaversio on vanha, client pyytää päivittämään sivun.
- **Pyyntö–vastaus**: toimenpiteet joilla on seuraus (kaupan muutos, Pörssin tarjous) sisältävät `rid`-kentän (request id). Palvelin vastaa samalla `rid`:llä. Pörssin REST-pyynnöissä käytetään `Idempotency-Key`-otsaketta: sama avain kahdesti ei luo kahta tarjousta.
- **Koko**: viesti enintään 4 KB, chat-viesti 200 merkkiä.
- **Heartbeat**: palvelin pingaa 15 s välein, 2 vastaamatonta → yhteys suljetaan ja pelaaja poistuu maailmasta (kauppa perutaan).
- **Yksi yhteys per hahmo**: uusi kirjautuminen samalle hahmolle sulkee vanhan yhteyden (`kicked: logged_in_elsewhere`). Tämä estää kahden välilehden samanaikaiset toimet, jotka ovat klassinen dupetuskeino.

Esimerkkejä viesteistä:

```text
client → palvelin                          palvelin → client
move { x, z, tx?, tz? }                    welcome { protocol, you, tickRate }
chat { text }                              snapshot { players[] }      (kun alue vaihtuu)
trade.request { targetId }                 player.join / player.leave / player.move
trade.respond { tradeId, accept }          chat { from, name, text }
trade.offer { tradeId, items[], money }    trade.requested { tradeId, fromId, name }
trade.accept { tradeId, stage }            trade.update { trade }
trade.cancel { tradeId }                   trade.completed / trade.cancelled { reason }
ping                                       correction { x, z }
                                           error { code, message, rid? }
```

## 6. Läsnäolo: pelaajat näkevät toisensa

- **Maailmat (worlds)**: kuten RuneScapessa, palvelimella on useita rinnakkaisia maailmoja ("Kerava 1", "Kerava 2"…). Maailma on yksi palvelinprosessi. **Julkaisussa yhden maailman raja on 20 samanaikaista pelaajaa** (asetus `MAX_PLAYERS`, ks. luku 6.1). Pelaaja valitsee maailman tai saa vähiten täyden. Talous (raha, tavarat, Pörssi) on **yhteinen kaikille maailmoille**, koska se on tietokannassa.
- **Näkyvyysalue (interest management)**: maailma jaetaan 64 m × 64 m ruutuihin. Pelaaja näkee oman ruutunsa ja 8 naapuriruutua (noin 190 m × 190 m). Kun pelaaja vaihtaa ruutua, hän saa `player.join` uusista ja `player.leave` poistuneista. Näin isommassakin maailmassa (myöhemmin satoja pelaajia) yksi pelaaja vastaanottaa vain lähellä olevien liikkeet.
- **Päivitystahti**: palvelin kerää liikkeet ja lähettää ne 10 kertaa sekunnissa (tick 100 ms), vain muuttuneet. Client interpoloi muiden pelaajien sijaintia 100–150 ms viiveellä, jolloin liike näyttää sulavalta.
- **Mitä toisista näkyy**: nimi, väri/ulkonäkö, character level, sijainti, suunta, animaatiotila (kävely, kalastus, treeni). Ei rahaa, ei repun sisältöä, ei heatia.
- **Chat**: lähichat näkyy saman näkyvyysalueen pelaajille puhekuplana ja chat-ikkunassa. Myöhemmin yksityisviestit, kaverilista ja ignore-lista. Suodatin: kirosanat sallittuja (K18), mutta herjaukset, henkilötiedot (puhelinnumerot, osoitteet) ja linkit suodatetaan. Uudet tilit eivät voi lähettää linkkejä eivätkä yksityisviestejä tuntemattomille ensimmäisten 2 tunnin aikana (spämmibotit).

### 6.1 Pelaajamäärä ja jono julkaisussa

Aluksi **20 pelaajaa per maailma**. Pieni raja on tarkoituksellinen:
- Ensimmäinen julkaisu on testi: 20 pelaajaa riittää näkemään, toimiiko kauppa, chat ja talous oikeasti, ja ongelmat ovat vielä pieniä.
- Halvin mahdollinen palvelin (1–2 vCPU, 2–4 GB) riittää hyvin, koska 20 pelaajaa × 10 päivitystä sekunnissa on palvelimelle kevyttä.
- Keravan keskusta tuntuu elävältä jo 20 pelaajalla, kun kaikki kohtaavat torilla ja asemalla.

Miten raja toimii (toteutettu, `server/src/ws/gateway.ts`):
- Kun maailmassa on 20 pelaajaa, seuraava saa viestin `queue { position, world }` ja odottaa jonossa. Jonossa ei voi tehdä mitään pelissä (vain ping).
- Kun joku poistuu, jonon ensimmäinen pääsee sisään (`welcome`), ja muut saavat päivitetyn jonopaikan.
- Jonon pituus on rajattu (`MAX_QUEUE`, oletus 50). Sen yli tuleva yhteys saa HTTP 503 -vastauksen, ja client näyttää "Maailma on täynnä, kokeile toista maailmaa tai yritä hetken päästä".
- Jo pelissä oleva hahmo, joka yhdistää uudelleen (esim. sivun päivitys), pitää paikkansa eikä joudu jonoon.
- `GET /api/worlds` kertoo kirjautumisruudulle maailmat: nimi, pelaajat, kapasiteetti, jonossa.

Kasvatus myöhemmin, ilman koodimuutoksia:
1. Nosta rajaa (`MAX_PLAYERS=50`, sitten 100), kun mittarit (tick-aika, viestit/s, CPU) näyttävät että varaa on.
2. Lisää maailmoja: käynnistä uusi prosessi `WORLD_NAME="Kerava 2"` omalla portilla. Talous on yhteinen, koska se on tietokannassa. Maailmalistan kokoaminen kaikista prosesseista tulee Redisin myötä (luku 19).
3. Pidä maailmat mieluummin pieninä ja täysinä kuin isoina ja tyhjinä: puolityhjä maailma tuntuu kuolleelta.

## 7. Tavaramalli ja omistus

Kaksi tavaratyyppiä:

1. **Pinottavat** (ahven, kahvi, raaka-aineet): rivi `inventory_items(character_id, item_id, quantity)`. Määrä on aina > 0 (tietokannan CHECK-rajoite), rivi poistetaan kun määrä menee nollaan.
2. **Uniikit** (harvinaiset collectiblet, myöhemmin kulumista kerryttävät työkalut): rivi `item_instances(id uuid, item_id, owner_character_id, location, created_reason, created_at)`. Jokaisella on oma tunniste, joten kopio olisi heti näkyvä (kaksi riviä samalla id:llä ei ole mahdollista) ja jokaisen esineen elinkaaren voi jäljittää.

Jokaisella itemillä on **kaupattavuusluokka** (`shared/items.ts`):

| Luokka | Pelaajien kauppa | Pörssi | Esimerkki |
| --- | --- | --- | --- |
| `free` | kyllä | kyllä | ahven, kahvi, lenkkarit |
| `trade_only` | kyllä | ei | harvinaiset collectiblet (hinnanmuodostus vapaasti) |
| `street` | kyllä, nostaa heatia | **ei koskaan** | fiktiiviset katukauppa-aineet |
| `bound` | ei | ei | quest-itemit, aloitusitemit, palkintomerkit |

Katukaupan aineet ovat siis vain kasvokkain kaupattavia. Tämä sopii teemaan (riski, maine) ja estää niitä muuttumasta pelkäksi Pörssin hintakäyräksi.

**Sijainti**: tavara on aina täsmälleen yhdessä paikassa: hahmon reppu, kotivarasto, Pörssin escrow tai (vain transaktion sisällä) siirrossa. Muistissa oleva kauppaikkuna ei siirrä tavaraa minnekään, se on vain lupaus, joka tarkistetaan commitissa uudelleen.

## 8. Kirjanpito: miten raha ja tavarat liikkuvat

Kaikki saldoja muuttavat funktiot ovat moduulissa `server/src/economy/`. Muu koodi ei kirjoita `money`- tai `inventory_items`-tauluihin suoraan.

- Jokainen muutos kirjoittaa rivin tauluun `ledger(id, character_id, kind, item_id, delta, balance_after, reason, ref_type, ref_id, created_at)`. `kind` on `money` tai `item`, `reason` kertoo lähteen tai nielun (`quest_reward`, `npc_sell`, `trade`, `market_tax`, `fine`…), `ref` linkittää kauppaan, Pörssin täsmäytykseen tai questiin.
- Funktiot ottavat aina parametrina transaktion (`tx`), eivät avaa omaa. Näin kauppa tai Pörssin täsmäytys koostuu monesta operaatiosta, jotka joko kaikki onnistuvat tai mikään ei.
- Rahan riittävyys ja tavaran olemassaolo tarkistetaan **samassa** UPDATE-lauseessa (`UPDATE ... SET money = money - $1 WHERE id = $2 AND money >= $1`). Ei erillistä "lue saldo, tarkista, kirjoita" -kierrosta, jossa kaksi samanaikaista pyyntöä voisi molemmat nähdä riittävän saldon.
- Tietokannan rajoitteet ovat viimeinen turvaverkko: `money >= 0`, `quantity > 0`, `money <= 2^31` (ylivuotosuoja).
- **Yöllinen tarkastus**: jokaiselle hahmolle `summa(ledger.delta) == nykyinen saldo`, jokaiselle itemille sama. Jos ei täsmää, hälytys ja hahmo jäädytetään kauppojen osalta kunnes tutkittu. Lisäksi lasketaan koko pelin rahan määrä (M) ja itemien kokonaismäärät päiväkohtaisiin tilastoihin (luku 11).

Raha on kokonaislukuja **sentteinä** tietokannassa (`bigint`), jotta ei tule liukulukuvirheitä. Clientille näytetään euroina.

## 9. Pelaajien välinen kauppa (kasvokkain)

### Kulku

```text
 A klikkaa B:tä → "Ehdota kauppaa"
   │  trade.request
   ▼
 B näkee pyynnön (30 s) → hyväksyy
   ▼
 VAIHE 1: TARJOUS ─────────────────────────────────────────────┐
   Kumpikin lisää/poistaa itemeitä ja rahaa.                   │
   Molemmat näkevät molempien tarjoukset reaaliajassa.         │
   Kumpikin painaa "Hyväksy".                                  │
   Mikä tahansa muutos → kummankin hyväksyntä nollautuu        │
   ja muutettu rivi välähtää punaisena 3 s (huijauksen esto).  │
   ▼ molemmat hyväksyneet                                      │
 VAIHE 2: VAHVISTUS                                            │
   Lukittu yhteenveto: "Annat: … / Saat: …", arvioitu arvo     │
   Pörssin ohjehinnalla, varoitus jos ero on yli 50 %.         │
   Muutoksia ei voi tehdä, vain vahvistaa tai perua.           │
   ▼ molemmat vahvistaneet                                     │
 COMMIT (yksi tietokantatransaktio) ───────────────────────────┘
   ▼
 trade.completed molemmille, ledger-rivit, kauppahistoria
```

### Säännöt

- Kauppaa voi ehdottaa vain pelaajalle samassa maailmassa ja enintään **8 metrin** päässä. Etäisyys tarkistetaan pyyntöhetkellä ja commitissa (jos toinen kävelee pois, kauppa perutaan).
- Kummallakin voi olla vain **yksi** avoin kauppa kerrallaan.
- Kauppaa ei voi tehdä jahdin aikana, vankilassa tai Areenan ottelussa.
- Tarjouksessa enintään 28 eri itemiä (repun koko) + rahaa.
- Vaiheessa 2 hyväksyntä vaatii vähintään **2 sekuntia** vaiheen alusta (estää refleksiklikkauksen ja makrot).
- Kauppa perutaan jos: kumpi tahansa peruu, yhteys katkeaa, toinen kävelee liian kauas, 5 minuuttia kuluu, tai palvelin käynnistyy uudelleen.
- `bound`-itemeitä ei voi lisätä. `street`-itemit nostavat **molempien** heatia commitissa (ja poliisi lähellä nostaa enemmän).
- Uudet tilit (alle 24 h peliaikaa tai character level alle 5) eivät voi antaa yli 200 € arvosta päivässä. Estää bottifarmeja syöttämästä rahaa ostajille (RWT). Vastaanottaminen on aina sallittu.

### Atominen commit

Kun molemmat ovat vahvistaneet, palvelin tekee yhden transaktion:

1. `BEGIN` (READ COMMITTED riittää, koska kaikki tarkistukset tehdään rivilukoilla ja ehdollisilla UPDATEilla).
2. Lukitaan molempien hahmojen rivit `SELECT ... FOR UPDATE` **aina pienemmästä id:stä alkaen**. Kiinteä järjestys estää deadlockit, kun kaksi kauppaa koskee samaa pelaajaa.
3. Tarkistetaan tilat (ei bannia, kaupankäyntiraja).
4. Jokainen siirto: `takeItem(A, item, n)` ehdollisella UPDATElla. Jos A:lla ei enää ole tavaraa (myi sen NPC:lle välissä, tai kahden välilehden huijaus), koko transaktio perutaan ja kauppa päättyy virheeseen `items_changed`.
5. `giveItem(B, item, n)`, raha samalla tavalla. Ledger-rivit `reason = 'trade'`, `ref_id = trade_id`.
6. Kauppa tallennetaan `trades`-tauluun (molempien tarjoukset JSONina, aikaleimat).
7. `COMMIT`. Vasta tämän jälkeen clienteille lähetetään `trade.completed`.

Jos palvelin kaatuu ennen COMMITia, mitään ei tapahtunut. Jos se kaatuu COMMITin jälkeen ennen viestiä, kauppa on tehty ja client näkee sen seuraavalla latauksella. Kumpikaan ei voi tuottaa duplikaattia.

## 10. Kerava-Pörssi (pelaajien markkinapaikka)

Oma järjestelmä, jossa pelaajat ostavat ja myyvät toisilleen ilman että tarvitsee olla samaan aikaan paikalla. Pörssi on fyysinen paikka pelissä: **Keravan torilla** keskustassa, pelin sosiaalisena keskipisteenä. Torin keskellä on oma Pörssi-paviljonki (keksitty rakennelma: katos, välittäjä-NPC:t tiskien takana, iso hintataulu), jonka ympärille pelaajat kerääntyvät. Tarjouksia voi tehdä vain torilla välittäjän tiskillä (etäisyys tarkistetaan palvelimella), mutta niiden tilaa voi seurata kaikkialla. Koska tori on kaikkien kohtaamispaikka, se on myös luonteva paikka kasvokkain käytävälle kaupalle, ja torin lähichat on vilkkain.

### Toiminta

- **Tarjouskirja per item**: ostotarjoukset (bid) ja myyntitarjoukset (ask), molemmilla hinta (senttiä/kpl) ja määrä.
- **Täsmäytys**: hinta–aika-prioriteetti. Uusi ostotarjous täsmää halvimpaan myyntitarjoukseen, jonka hinta ≤ ostohinta. Kauppahinta on **aiemmin kirjassa olleen** tarjouksen hinta (kuten oikeissa pörsseissä, ja kuten pelaajat odottavat: jos tarjoat 100 € ja joku myy 90 €:lla, maksat 90 € ja erotus palautuu).
- **Escrow**: kun tarjous jätetään, raha (ostossa hinta × määrä) tai tavarat (myynnissä) siirretään heti `market_escrow`-tilaan samassa transaktiossa. Tarjous ei siis voi koskaan täsmätä ilman katetta, eikä samaa tavaraa voi myydä kahdesti.
- **Noutolaatikko**: täsmänneet tavarat ja raha menevät noutolaatikkoon, josta ne haetaan Pörssin luona (yksi klikkaus). Myös peruttujen tarjousten escrow palaa sinne.
- **Osittaiset täsmäykset**: tarjous voi täyttyä osissa, jäljellä oleva osa pysyy kirjassa.
- **Paikat**: 6 samanaikaista tarjousta per hahmo (myöhemmin lisää esim. Hustlaus-levelin kautta).
- **Peruminen**: milloin tahansa, täyttymätön osa palaa noutolaatikkoon.
- **Vanheneminen**: tarjous vanhenee 7 päivässä (kirja ei täyty unohtuneilla tarjouksilla).
- **Täsmäys yhdessä transaktiossa**: tarjouksen lisäys ja kaikki sen aiheuttamat täsmäykset tehdään yhdessä transaktiossa, ja item-kohtainen kirja lukitaan (`pg_advisory_xact_lock(item_id)`) ettei kaksi samanaikaista täsmäystä käytä samaa vastatarjousta.

### Rajoitukset (talouden ja huijausten suojaksi)

- **Myyntivero 2 %** jokaisesta täsmänneestä myynnistä (pyöristys alaspäin, max 5 000 € per kauppa, alle 1 € kaupat verottomia). Vero poistuu pelistä: se on pelin tärkein rahanielu.
- **Hintakaista**: tarjouksen hinta saa olla enintään ±30 % item-kohtaisesta **ohjehinnasta** (guide price). Estää rahan siirtämisen tililtä toiselle Pörssin kautta (myy kahvi 10 000 €:lla omalle kakkostilille) ja hintojen manipuloinnin yksittäisillä hölmöillä kaupoilla. Kaista on kapeampi harvoin kaupatuille itemeille.
- **Ohjehinta**: päivitetään tunnin välein, 24 tunnin volyymipainotettu mediaani täsmänneistä kaupoista (mediaani ei heilu yksittäisistä poikkeavista kaupoista). Uudelle itemille ohjehinta on NPC-arvo × 1.5. Ohjehinta voi muuttua enintään 5 % tunnissa.
- **Ostorajat**: kustakin itemistä voi ostaa enintään N kpl 4 tunnissa (item-kohtainen, esim. ahven 2 000, harvinainen 5). Hidastaa markkinan nurkkaamista.
- **Ei Pörssiä uusille**: tili vähintään 24 h vanha ja character level 5. Botit eivät pääse heti myymään farmaamaansa.

### Hintahistoria

`market_trades`-taulusta lasketaan tunnin ja päivän kynttilät (avaus, ylin, alin, päätös, volyymi). Client näyttää 30 päivän käyrän ja nykyisen parhaan osto- ja myyntihinnan. Kirjan syvyys (montako kappaletta millä hinnalla) näytetään 5 tasoon asti, mutta ei kuka tarjoaa.

## 11. Talouden tasapaino

Raha syntyy lähteistä ja poistuu nieluista. Jos lähteet kasvavat nieluja nopeammin, tulee inflaatio: hinnat nousevat, uudet pelaajat eivät pysy perässä ja raha menettää merkityksensä.

### Lähteet (faucets)

| Lähde | Säätövipu |
| --- | --- |
| NPC-kauppojen ostot (myyt ahvenen kauppiaalle) | NPC-ostohinta on ~40 % itemin arvosta, ja se **laskee** jos samaa itemiä myy paljon (kaupan "varasto" täyttyy ja palautuu tunnissa). Hahmokohtainen päiväkatto per item |
| Questien rahapalkinnot | Kertaluonteisia, eivät toistu |
| Areenan NPC-duelit | Palkinto vain panoksesta + pieni bonus, päivittäinen voittokatto |
| Katukauppa NPC-välittäjille | Riski (heat, takavarikko, sakot) syö osan, alueen hinta laskee myynnin mukaan |
| Päivittäiset tehtävät (myöhemmin) | Kiinteä summa päivässä |

### Nielut (sinks)

| Nielu | Huomio |
| --- | --- |
| Pörssin myyntivero 2 % | Kasvaa automaattisesti talouden mukana |
| NPC-kauppojen myynnit (kahvi, vavat, energiajuoma) | Kulutustavarat kuluvat käytössä |
| Areenan asemamaksu | 5 % potista |
| Sakot ja takavarikot (katukauppa) | Skaalautuu heatiin ja määriin |
| Vankilan takuu (lyhennä tuomiota rahalla) | Valinnainen |
| Junaliput (myöhemmin pikamatkat Talmaan, Jokivarteen) | Mukavuusnielu |
| Kotivaraston laajennukset, vuokra | Kuukausittainen pieni maksu isommasta varastosta |
| Työkalujen kuluminen ja korjaus | Vavat, lenkkarit kuluvat käytössä |
| Kosmetiikka NPC:ltä (hupparit, värit) | Statussymboli, ei vaikuta tasapainoon |

### Tavaroiden nielut

Itemit eivät saa kertyä loputtomasti, muuten niiden hinta valuu nollaan: ruoka syödään (energia), raaka-aineet jalostetaan (kala → kypsennetty kala, kypsennyksessä voi palaa), työkalut kuluvat, katukaupan aineet takavarikoidaan, quest-itemit kulutetaan questeissa.

### Mittarit ja säätö

Joka yö tallennetaan `economy_daily_stats`:
- rahan kokonaismäärä M ja muutos, lähteet ja nielut lähteittäin,
- itemien kokonaismäärät ja Pörssin ohjehinnat (hintaindeksi = kori yleisiä itemeitä),
- aktiivisten pelaajien määrä, raha per aktiivinen pelaaja, Gini-kerroin.

Tavoite: hintaindeksi nousee enintään ~2 % kuukaudessa. Jos enemmän, nostetaan nieluja (vero 2 → 3 %, NPC-hinnat) tai lasketaan lähteitä (NPC-ostohinnat). Kaikki vivut ovat `economy_config`-taulussa, joten säätö ei vaadi julkaisua ja muutokset kirjautuvat historiaan.

**Älä koskaan**: anna rahaa kompensaationa ilman kirjanpitoa, lisää "tuplarahat"-tapahtumia ilman nielua, tai salli itemien luonti admin-työkalulla ilman ledger-riviä ja syytä.

## 12. Katukauppa, heat ja poliisi moninpelissä

- Heat on hahmon tila palvelimella (`characters.heat`, `heat_updated_at`), lasku lasketaan ajasta lukuhetkellä (ei tarvita ajastinta).
- Poliisipartiot ovat palvelimen NPC:itä, jotka liikkuvat samaa reittiä kaikille saman maailman pelaajille. Jahti ratkaistaan palvelimella (Running, Endurance, Kyttien pakoilu + RNG).
- Kotietsinnät arvotaan palvelimella kirjautuessa ja tunnin välein (`raidChance(heat, kotivarasto)`).
- Vankila on hahmon tila aikaleimalla (`jailed_until`). Vankilassa ei voi käydä kauppaa eikä käyttää Pörssiä, mutta vankilassa olevat pelaajat näkevät toisensa (vankilan piha on oma alue).
- Pelaajien välinen katukauppa käy normaalin kauppaikkunan kautta. Commit nostaa molempien heatia; lähellä oleva partio voi aloittaa jahdin.
- Mahdollinen myöhempi lisä: "vasikointi" (ilmianna toinen pelaaja) on houkutteleva mutta helposti häirinnän väline, joten se tehdään vain NPC-tasolla, ei pelaajien välillä.

## 13. Aseman Areena PvP

Kun NPC-duelit toimivat, PvP tulee samalla vuororatkaisulla palvelimelle:
- Haaste vain asemalla, molemmat lähellä toisiaan.
- Panokset escrowiin samalla tavalla kuin kaupassa (molempien raha lukitaan ennen ensimmäistä kierrosta).
- Liikkeet lähetetään sinetöityinä: kumpikin lähettää valintansa, palvelin paljastaa molemmat vasta kun molemmat ovat saapuneet (tai 10 s aikaraja → "lepo"). Kumpikaan ei voi nähdä toisen liikettä etukäteen.
- Asemamaksu 5 % potista on rahanielu. Samojen kahden pelaajan välisiä duelleja rajoitetaan päivässä (estää rahansiirron "häviämällä tahallaan").

## 14. Huijausten ja dupetuksen esto

| Uhka | Esto |
| --- | --- |
| Muokattu client lähettää "sain 1000 €" | Clientillä ei ole tällaista viestiä. Raha muuttuu vain palvelimen logiikassa |
| Dupetus: sama tavara kahteen kauppaan tai kauppa + NPC-myynti samaan aikaan | Yksi kauppa kerrallaan, ehdolliset UPDATEt commitissa, rivilukot kiinteässä järjestyksessä |
| Dupetus: kaksi välilehteä / kaksi yhteyttä | Yksi WS-yhteys per hahmo, uusi potkaisee vanhan |
| Dupetus: palvelimen kaatuminen kesken | Kaikki yhdessä transaktiossa. Muistitila ei ole koskaan totuus |
| Dupetus: verkon uusinta (sama pyyntö kahdesti) | `rid`/Idempotency-Key, kaupan tila tarkistetaan (jo valmis → ei uudelleen) |
| Kokonaislukuylivuoto (myy -1 kpl, määrä 2^53) | zod: positiiviset kokonaisluvut, ylärajat. Tietokannan CHECKit |
| Kaupassa vaihdetaan tavara viime hetkellä | Muutos nollaa molempien hyväksynnät, vaihe 2 on lukittu yhteenveto |
| Speedhack / teleporttaus | Palvelimen nopeustarkistus, korjausviesti, kirjaus |
| Pikaskillaus / makrot | Palvelin ajastaa aktiviteetit. Bottiheuristiikat (luku 16) |
| Rahansiirto Pörssin kautta | Hintakaista, uusien tilien rajat |
| SQL-injektio | Vain parametrisoidut kyselyt |
| XSS chatissa | Client renderöi chatin tekstinä (React escape), palvelin rajaa merkistön ja pituuden |
| Session kaappaus | HttpOnly-eväste, Origin-tarkistus, token vain tiivisteenä kannassa |
| Kirjautumisen brute force | Nopeusrajat IP:n ja tilin mukaan, scrypt |

## 15. Nopeusrajat

Toteutus: token bucket per yhteys per viestityyppi (`server/src/ws/rateLimit.ts`), REST-puolella per IP ja per tili.

| Toiminto | Raja |
| --- | --- |
| `move` | 12 / s (purske 20) |
| `chat` | 1 / s, purske 5. Sama viesti kahdesti peräkkäin hylätään |
| `trade.request` | 1 / 3 s, enintään 10 / min |
| Muut kaupan viestit | 10 / s |
| Pörssin tarjous | 1 / s, 60 / h |
| Rekisteröinti | 3 / h / IP |
| Kirjautuminen | ks. luku 2 |
| Viesti yli rajan | Hylätään + `error rate_limited`. Jatkuva ylitys → yhteys suljetaan |

## 16. Botit ja oikean rahan kauppa (RWT)

Pelin rahaa ja itemeitä ei saa myydä oikealla rahalla (käyttöehdot). Täysin estää sitä ei voi, mutta sen voi tehdä kannattamattomaksi:
- Uusien tilien kauppa- ja Pörssirajat (luvut 9 ja 10).
- Tunnistus: epäinhimillisen tasainen aktiviteettirytmi (klikkausten aikavälien hajonta), 20 h päivässä skillausta, monta tiliä samasta IP:stä syöttämässä yhdelle, yksisuuntaiset kaupat (A antaa B:lle, B ei anna mitään).
- Epäilyttävät tilit merkitään moderaattorin jonoon, ei automaattisia banneja ilman ihmistä aluksi.
- Takaisinperintä: koska kaikki on kirjanpidossa, bottifarmin tuottaman rahan voi jäljittää ja poistaa vastaanottajilta.

## 17. Moderointi ja ylläpito

- Ilmoita pelaaja -toiminto (chat-loki liitetään automaattisesti).
- Admin-työkalut (myöhemmin, erillinen suojattu sivu): hae pelaaja, katso kirjanpito ja kaupat, mute/ban, palauta huijattu tavara (ledger-rivi `reason = 'admin_restore'`, syy pakollinen).
- Kaikki admin-toimet kirjautuvat `admin_audit`-tauluun.
- Huoltokatko: palvelin lähettää `server.shutdown { inSeconds }`, avoimet kaupat perutaan siististi, uusia ei voi aloittaa.

## 18. Tietokantaskeema

Täysi skeema: `server/migrations/001_init.sql`. Tiivistelmä:

```text
accounts            id, email (uniikki, pienet kirjaimet), password_hash, status, adult_confirmed_at,
                    terms_version, created_at, last_login_at
sessions            token_hash (PK), account_id, created_at, expires_at, ip, user_agent
characters          id, account_id, name (uniikki citext), color, money (bigint senttiä, >= 0), xp,
                    health, energy, pos_x, pos_z, heat, jailed_until, created_at, play_seconds
character_skills    (character_id, skill_id) → xp
inventory_items     (character_id, location, item_id) → quantity > 0    location: 'pack' | 'home'
item_instances      id uuid, item_id, owner_character_id, location, created_reason, created_at
ledger              id, character_id, kind, item_id, delta, balance_after, reason, ref_type, ref_id, created_at
trades              id uuid, a_id, b_id, a_offer jsonb, b_offer jsonb, status, created_at, completed_at
market_orders       id, character_id, item_id, side, price, quantity, remaining, status, created_at, expires_at
market_trades       id, item_id, buy_order_id, sell_order_id, price, quantity, tax, created_at
market_collect      (character_id, item_id | money) → noudettavat
market_guide_prices item_id → price, updated_at
economy_config      key → value jsonb, updated_at, updated_by
economy_daily_stats day → metrics jsonb
admin_audit         id, admin_account_id, action, target, reason, created_at
```

Migraatiot ovat numeroituja SQL-tiedostoja, jotka ajetaan järjestyksessä (`npm run migrate`), ja jokainen ajettu tallennetaan `schema_migrations`-tauluun. Migraatioita ei koskaan muokata jälkikäteen, vaan tehdään uusi.

## 19. Julkaisu, skaalaus ja varmuuskopiot

**Julkaisu (yksi maailma, 20 pelaajaa)**: yksi pieni VPS (esim. 2 vCPU, 4 GB), Docker Compose: Caddy (TLS Let's Encryptillä) + Node-palvelin + PostgreSQL. Staattinen client Caddyn kautta tai CDN:stä. Hinta luokkaa 5–15 €/kk. Sama kone kantaa useita 20 hengen maailmoja ja myöhemmin satoja pelaajia (4 vCPU, 8 GB, noin 20–40 €/kk).

**Kasvu**: Node-prosesseja useampi, yksi per maailma. Tietokanta yhteinen (talous on siellä). Redis pub/sub maailmojen väliseen chattiin ja kaverilistan "online"-tietoon. Pörssin täsmäytys pysyy tietokannassa, joten se toimii vaikka prosesseja on monta.

**Varmuuskopiot**: jatkuva WAL-arkistointi (point-in-time recovery, esim. pgBackRest) + päivittäinen `pg_dump` toiselle palvelimelle. Palautus testataan kuukausittain. Dupetusbugin sattuessa voi palata hetkeen ennen bugia.

**Seuranta**: palvelimen metriikat (yhteydet, tick-aika, viestit/s, virheet), talouden mittarit (luku 11), hälytykset kirjanpidon epätäsmäyksistä.

## 20. Tietoturva, yksityisyys ja K18

- Kaikki liikenne TLS:llä, myös WebSocket (`wss://`).
- Sähköposteja ja IP-osoitteita käsitellään henkilötietoina: tietosuojaseloste, poisto pyynnöstä, IP:t säilytetään 90 päivää.
- K18-vahvistus rekisteröinnissä, käyttöehdoissa kielletään alaikäiset. Katukauppa on fiktiivistä eikä sisällä oikeita aineita, valmistusohjeita tai hintoja.
- Pelissä ei ole oikean rahan maksuja. Jos sellaisia tulee myöhemmin (kosmetiikka), ne eivät saa koskaan antaa pelirahaa tai kaupattavia itemeitä, ettei peli muutu rahapeliksi.
- Salaisuudet (tietokannan salasana, evästeen allekirjoitus) ympäristömuuttujissa, ei repossa.

## 21. Toteutusjärjestys

| Vaihe | Sisältö | Valmis kun |
| --- | --- | --- |
| M1 | Palvelimen pohja: Fastify, PostgreSQL, migraatiot, tilit, sessiot, hahmon luonti | Rekisteröinti ja kirjautuminen toimivat, hahmo tietokannassa |
| M2 | WebSocket: yhteys, protokolla, nopeusrajat, läsnäolo ja näkyvyysalueet, liikkeen validointi, lähichat, 20 pelaajan raja ja jono | Kaksi selainta näkevät toistensa hahmot liikkumassa |
| M3 | Talouden ydin: kirjanpito, inventaario palvelimella | Kaikki saldot ledgerissä, tarkastus täsmää |
| M4 | Pelaajien kauppa: tilakone, kaksoisvahvistus, atominen commit | Kauppa toimii, dupetustestit menevät läpi |
| M5 | Clientin online-tila: kirjautumisruutu, muiden pelaajien hahmot, chat, kauppaikkuna | Pelattavissa netissä |
| M6 | Aktiviteetit, NPC-kaupat ja questit palvelimelle | Skillaus antaa saalista vain palvelimen kautta |
| M7 | Kerava-Pörssi: tarjouskirja, escrow, täsmäytys, vero, ohjehinnat, hintahistoria | Pelaajat käyvät kauppaa Pörssissä |
| M8 | Talouden mittarit, admin-työkalut, moderointi, varmuuskopiot | Valmis julkiseen betaan |
| M9 | Katukauppa ja poliisi palvelimella, Areena PvP | K18-sisältö moninpelissä |

## 22. Mitä tässä on jo toteutettu

Kansio `server/` (oma npm-paketti) ja `shared/`:

- `shared/protocol.ts`: WebSocket-viestien tyypit, `shared/items.ts`: itemien kaupattavuus, `shared/economy.ts`: kaupan ja Pörssin säännöt (etäisyys, aikarajat, vero).
- `server/migrations/001_init.sql`: koko skeema (luku 18), myös Pörssin taulut valmiiksi.
- **Tilit**: rekisteröinti (K18-vahvistus pakollinen), kirjautuminen, uloskirjautuminen, `GET /api/me`, scrypt-salasanat, tiivistetyt sessiotokenit, kirjautumisen nopeusraja.
- **Hahmot**: luonti nimen validoinnilla ja uniikkiudella.
- **Kirjanpito**: `economy/ledger.ts`, raha- ja itemoperaatiot ehdollisilla UPDATEilla ja ledger-riveillä, tarkastusfunktio. Tavarat ovat toistaiseksi pinoina (`inventory_items`); `item_instances`-taulu uniikeille esineille on skeemassa valmiina, mutta käyttöön se otetaan kun ensimmäinen uniikki esine (kuluva työkalu) tulee peliin.
- **WebSocket**: autentikointi evästeellä, Origin-tarkistus, zod-validointi, token bucket -nopeusrajat, yksi yhteys per hahmo, heartbeat.
- **Pelaajaraja ja jono**: 20 pelaajaa per maailma, jono täydelle maailmalle, `GET /api/worlds`.
- **Läsnäolo**: ruudukkopohjainen näkyvyysalue, join/leave/move-viestit, liikkeen nopeustarkistus ja korjaus, lähichat.
- **Kauppa**: koko tilakone (pyyntö, tarjous, hyväksyntä, vahvistus, peruutukset, aikarajat, etäisyys), atominen commit rivilukoilla, kauppahistoria.
- **Pörssin täsmäytysmoottori** puhtaana funktiona (`market/matching.ts`): hinta–aika-prioriteetti, osittaiset täsmäykset, vero, palautukset. Tietokantaintegraatio on vaihe M7.
- Testit (`npm test` kansiossa `server/`, 69 kpl): salasanat, viestien validointi, nopeusrajat, näkyvyysalueet, liikkeen huijausesto, täsmäysmoottori (myös rahan säilyminen), kirjanpito (20 rinnakkaista ostoa samalla rahalla), kaupan dupetusyritykset (sama tavara kahteen kauppaan yhtä aikaa, kaupan uusinta, ristikkäiset kaupat ilman deadlockia), uusien tilien rajat, ja koko kauppa päästä päähän kahdella oikealla WebSocket-yhteydellä.

**M5, clientin online-tila (tehty)**:

- Päävalikossa kirjautuminen ja tilin luonti (K18-vahvistus), sen jälkeen verkkohahmon nimi. Maailman pelaajamäärä näkyy valikossa. Jos palvelin ei vastaa, yksinpeli toimii kuten ennenkin. Kehityksessä Vite välittää `/api` ja `/ws` palvelimelle (portti 8787), joten httpOnly-eväste toimii ilman CORSia.
- `src/services/online.ts`: REST-kutsut ja `OnlineClient` (uudelleenyhdistys 1–30 s viiveellä, ping, `rid`-pyynnöt lupauksina). `src/game/online/OnlineProvider.tsx` pitää kirjautumistilan.
- Pelissä `systems/useOnline.ts` lähettää sijainnin 10 kertaa sekunnissa vain kun se muuttuu. Muut pelaajat piirretään samalla `Humanoid`-mallilla, nimilapulla ja puhekuplalla (`RemotePlayers.tsx`), liike pehmennetään.
- Protokollaan lisättiin `look` (ulkonäkö JSONina, palvelin rajaa vain koon; vastaanottaja tarkistaa kentät itse, `game/online/look.ts`), `scene` (maailma tai sisätila: vain samassa tilassa olevat näkevät toisensa, chat ja kaupan etäisyys koskevat vain samaa tilaa) ja `warp` (ovet, bussi, juna, vankila: hyppy ilman nopeustarkistusta, enintään kerran 1,5 s:ssa). Sijainnilla ei ole taloudellista arvoa, ja kauppa ja aktiviteetit tarkistavat etäisyyden ja tilan, joten tämä riittää kunnes törmäystarkistus siirtyy palvelimelle.
- Lähichat: Enter avaa, viesti näkyy chat-ikkunassa ja puhekuplana.
- Kauppa: oikea klikkaus (tai klikkaus) toiseen pelaajaan → Käy kauppaa. Ikkunassa oma tarjous (raha ja verkkorepun tavarat), toisen tarjous, muutokset vilkkuvat punaisena, hyväksyntä ja 2 s jälkeen vahvistus.
- Rajaus: verkkokaupassa liikkuu **palvelimen** lompakko ja reppu (aloitusraha 50 €). Yksinpelin paikallinen tallennus ei vielä siirry palvelimelle; se on seuraava vaihe (M5b/M6), koska se vaatii aktiviteettien siirtämistä palvelimelle (luku 4).

**M7, Kerava-Pörssi (tehty)**:

- Verkkotavarat ovat nyt **samat kuin pelin omat** (`shared/items.ts` rakentuu `src/data/items.ts`:stä): samat id:t, nimet ja ikonit. Kaupattavuus johdetaan kategoriasta: quest-esineet ovat sidottuja, katukama ja salin roina vain kasvokkain (ei Pörssiin), arvottomat vain kasvokkain, kaikki muu Pörssiin. NPC-hinta tulee kaupan hinnasta.
- `server/src/market/service.ts`: tarjous ja sen escrow samassa transaktiossa per-item advisory lockin alla, täsmäys samassa transaktiossa (hinta–aika, kauppahinta on kirjassa olleen tarjouksen hinta, erotus palautuu ostajalle), vero 2 % myyjältä, noutolaatikko, peruminen, vanheneminen (ajastus minuutin välein), ohjehinta tunnin välein (`guidePrice`), hintakaista ±30 %, 6 tarjousta, ostoraja 4 h, Idempotency-Key. Täyttymisestä lähtee `market.filled` WebSocketilla.
- Sijainti: tarjoukset ja nouto vain Pörssin tiskillä torilla (`MARKET.at`, säde 16 m), palvelin tarkistaa oman sijaintitietonsa perusteella. Hintoja voi katsoa mistä vain.
- **Torikauppias** paviljongin vieressä: myy kauppojen tavallisia tarvikkeita kaupan hintaan (rahanielu) ja ostaa tavaraa 40 %:lla arvosta, enintään 50 kpl / tavara / vrk (rahalähde). Pörssissä saa siis yleensä paremman hinnan kuin NPC:ltä.
- Pörssin käyttöraja (taso 5, tili 24 h) on päällä tuotannossa (`NODE_ENV=production`, säädettävissä `MARKET_MIN_LEVEL` ja `MARKET_MIN_ACCOUNT_AGE_H`), kehityksessä pois.
- REST: `GET /api/market`, `GET /api/market/items/:id`, `GET /api/market/me`, `POST /api/market/orders`, `POST /api/market/orders/:id/cancel`, `POST /api/market/collect`, `POST /api/npc/buy`, `POST /api/npc/sell`.
- Client: paviljonki torilla (lasikatos, välittäjät pukeissa, iso hintataulu, Torikauppiaan koju), Pörssi-ikkuna: hintataulu, tavaran tarjouskirja 5 tasoa, 30 päivän käyrä, osto/myynti, omat tarjoukset ja noutolaatikko, Torikauppias.
- Testit: dupetusyritys (20 ostajaa samoille 5 kappaleelle), tuplalähetys samalla avaimella, peruutus, vanheneminen, kaista, paikat, sijainti, oma tarjous ei täsmää omaan, NPC-katto, kirjanpidon tarkastus jokaisen jälkeen.

Käynnistys: ks. `server/README.md`.
