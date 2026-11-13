import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from './types.js';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_PATH = path.join(ROOT_DIR, 'config.json');
export const WEB_DIR = path.join(ROOT_DIR, 'web');

const DEFAULTS: Omit<Config, 'token'> = {
  port: 7777,
  pollMs: 3000,
  customGames: [],
};

/** Loads config.json, creating it with a fresh pairing token on first run. */
export async function loadConfig(): Promise<Config> {
  let stored: Partial<Config> = {};
  try {
    stored = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8')) as Partial<Config>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  const config: Config = {
    ...DEFAULTS,
    ...stored,
    token: stored.token ?? randomBytes(18).toString('base64url'),
  };
  if (stored.token !== config.token) await saveConfig(config);
  return config;
}

export async function saveConfig(config: Config): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
}
