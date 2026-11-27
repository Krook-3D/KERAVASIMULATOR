# Kerava Simulator – pelipalvelin

Moninpelin palvelin: tilit, online-hahmot, kirjanpito, WebSocket-läsnäolo, pelaajien välinen kauppa ja Pörssin täsmäytysmoottori. Suunnitelma: [docs/MULTIPLAYER.md](../docs/MULTIPLAYER.md).

## Käynnistys

Tarvitaan Node.js 22 ja PostgreSQL 16.

```bash
cd server
npm install
cp .env.example .env          # muokkaa DATABASE_URL tarvittaessa
# Luo tietokanta (kerran):
#   createuser -P kerava && createdb -O kerava kerava && createdb -O kerava kerava_test
npm run migrate               # ajaa server/migrations/*.sql
npm run dev                   # http://localhost:8787, WebSocket /ws
```

Docker-vaihtoehto tietokannalle:

```bash
docker run -d --name kerava-db -e POSTGRES_USER=kerava -e POSTGRES_PASSWORD=kerava -e POSTGRES_DB=kerava -p 5432:5432 postgres:16
docker exec kerava-db createdb -U kerava kerava_test
```

`.env`-tiedostoa ei lueta automaattisesti: aja esim. `node --env-file=.env` tai vie muuttujat shellissä.

## Testit

```bash
npm test          # yksikkötestit + tietokanta- ja WebSocket-testit
npm run typecheck
```

Tietokantatestit käyttävät `TEST_DATABASE_URL`:ia (oletus `postgres://kerava:kerava@localhost:5432/kerava_test`) ja **tyhjentävät sen**. Jos tietokantaa ei ole, ne ohitetaan.

## REST-rajapinta

| Metodi | Polku | Kuvaus |
| --- | --- | --- |
| GET | `/api/health` | `{ ok, online, trades }` |
| GET | `/api/worlds` | maailmat: `{ name, online, capacity, queued }` |
| POST | `/api/auth/register` | `{ email, password, adult: true }` → 201 |
| POST | `/api/auth/login` | `{ email, password }` → asettaa `ks_session`-evästeen (HttpOnly, SameSite=Strict) |
| POST | `/api/auth/logout` | mitätöi session |
| GET | `/api/me` | tili ja hahmot |
| POST | `/api/characters` | `{ name, color }` → uusi hahmo (50 €) |
| GET | `/api/characters/:id/inventory` | oman hahmon tavarat |

POST-pyynnöissä pitää olla sallittu `Origin` (`ALLOWED_ORIGINS`), muuten 403.

## WebSocket

Yhdistä `ws(s)://<palvelin>/ws` samalta originilta kirjautumisen jälkeen (eväste tulee mukana). Viestit: [`shared/protocol.ts`](../shared/protocol.ts). Ensimmäinen viesti on `welcome`, sitten `snapshot` lähellä olevista pelaajista. Jos maailma on täynnä (oletus 20 pelaajaa, `MAX_PLAYERS`), tulee ensin `queue { position }` ja `welcome` vasta kun paikka vapautuu. Täyden jonon yli yhteys saa HTTP 503.

Kehityksessä Viten proxy kannattaa ohjata palvelimelle, jotta eväste ja origin ovat samat:

```ts
// vite.config.ts
server: { proxy: { '/api': 'http://localhost:8787', '/ws': { target: 'ws://localhost:8787', ws: true } } }
```

## Rakenne

```text
src/
  app.ts               Fastify + moduulien kytkentä
  index.ts             käynnistys ja siisti sammutus
  config.ts            ympäristömuuttujat
  db/                  yhteyspooli, transaktiot (withTx), migraatiot
  auth/                scrypt-salasanat, sessiotokenit (vain tiiviste kantaan), kirjautumisrajat
  characters/          online-hahmot, nimien validointi
  economy/ledger.ts    AINOA paikka joka muuttaa rahaa tai tavaroita, kirjanpito + tarkastus
  presence/            näkyvyysruudukko, maailma, liikkeen validointi, lähichat
  trade/               kaupan tilakone (session.ts), ohjaus (manager.ts), atominen commit (commit.ts)
  market/matching.ts   Pörssin täsmäytys, hintakaista, ohjehinta (puhtaat funktiot)
  ws/                  gateway, zod-skeemat, token bucket -rajat
migrations/            numeroidut SQL-migraatiot
test/                  vitest
```
