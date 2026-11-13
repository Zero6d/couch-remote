import { timingSafeEqual } from 'node:crypto';
import os from 'node:os';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { killProcesses, launchGame, shutdownPc, sleepPc } from './actions.js';
import { loadConfig, WEB_DIR } from './config.js';
import { scanLibrary } from './library.js';
import { pairUrl } from './net.js';
import { ProcessWatcher } from './processes.js';
import type { Game } from './types.js';

const config = await loadConfig();
const app = Fastify({ logger: { level: 'info' } });
const log = (msg: string) => app.log.info(msg);

let games: Game[] = await scanLibrary(config.customGames);
const watcher = new ProcessWatcher(config.pollMs, () => games, log);
watcher.start();

await app.register(fastifyStatic, { root: WEB_DIR, prefix: '/' });

app.addHook('onRequest', async (req, reply) => {
  if (!req.url.startsWith('/api/')) return;
  const header = req.headers['x-token'];
  const given = Array.isArray(header) ? header[0] : header;
  if (!given || !tokensMatch(given, config.token)) {
    return reply.code(401).send({ error: 'unauthorized' });
  }
});

app.get('/api/status', async () => ({
  host: os.hostname(),
  running: watcher.list(),
  gameCount: games.length,
}));

app.get('/api/games', async () =>
  games.map(({ id, source, name, cover }) => ({ id, source, name, cover })),
);

app.post('/api/library/rescan', async () => {
  games = await scanLibrary(config.customGames);
  return { gameCount: games.length };
});

app.post<{ Params: { id: string } }>('/api/games/:id/launch', async (req, reply) => {
  const game = games.find((g) => g.id === req.params.id);
  if (!game) return reply.code(404).send({ error: 'unknown game' });
  await launchGame(game);
  log(`launched ${game.name}`);
  return { ok: true };
});

app.post<{ Params: { id: string } }>('/api/games/:id/kill', async (req, reply) => {
  const running = watcher.list().find((r) => r.gameId === req.params.id);
  if (!running) return reply.code(409).send({ error: 'game is not running' });
  await killProcesses(running.pids);
  log(`killed ${running.name} (${running.pids.length} processes)`);
  return { ok: true };
});

app.post('/api/power/sleep', async () => {
  log('sleep requested from phone');
  await sleepPc();
  return { ok: true };
});

app.post('/api/power/shutdown', async () => {
  log('shutdown requested from phone');
  await shutdownPc();
  return { ok: true };
});

app.setErrorHandler((err: Error, _req, reply) => {
  app.log.error(err);
  reply.code(500).send({ error: err.message });
});

function tokensMatch(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

await app.listen({ port: config.port, host: '0.0.0.0' });
log(`${games.length} games found. Pair your phone at ${pairUrl(config.port, config.token)}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    watcher.stop();
    void app.close().then(() => process.exit(0));
  });
}
