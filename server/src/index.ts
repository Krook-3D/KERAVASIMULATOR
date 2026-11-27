import { loadConfig } from './config';
import { createPool } from './db/pool';
import { runMigrations } from './db/migrate';
import { buildApp } from './app';

const config = loadConfig();
const db = createPool(config.databaseUrl);
await runMigrations(db, (m) => console.log(`[migrate] ${m}`));
const app = await buildApp(config, db);
app.gateway.start();
await app.http.listen({ port: config.port, host: config.host });
console.log(`Kerava Simulator server on http://${config.host}:${config.port} (ws: /ws)`);

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: shutting down`);
  app.world.broadcast({ t: 'server.shutdown', inSeconds: 0 });
  await app.close();
  await db.end();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
