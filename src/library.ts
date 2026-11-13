import path from 'node:path';
import { scanEpic } from './epic.js';
import { scanSteam } from './steam.js';
import type { CustomGame, Game } from './types.js';

export function gameFromCustom(custom: CustomGame): Game {
  return {
    id: `custom:${custom.name}`,
    source: 'custom',
    name: custom.name,
    installDir: path.normalize(custom.installDir ?? path.dirname(custom.exe)),
    launch: { kind: 'exe', path: custom.exe, args: custom.args ?? [] },
  };
}

export async function scanLibrary(customGames: CustomGame[]): Promise<Game[]> {
  const [steam, epic] = await Promise.all([scanSteam(), scanEpic()]);
  const games = [...steam, ...epic, ...customGames.map(gameFromCustom)];
  return games.sort((a, b) => a.name.localeCompare(b.name));
}
