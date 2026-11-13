import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseVdf, type VdfObject, type VdfValue } from './vdf.js';
import type { Game } from './types.js';

const execFileAsync = promisify(execFile);

/** Non-game entries Steam installs into every library. */
const EXCLUDED_APP_IDS = new Set(['228980']);
const EXCLUDED_NAME_PATTERN = /proton|steam linux runtime|steamworks|redistributable|soundtrack/i;

/** Reads Steam's install folder from the registry, falling back to the default path. */
export async function findSteamPath(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('reg', [
      'query',
      'HKCU\\Software\\Valve\\Steam',
      '/v',
      'SteamPath',
    ]);
    const match = /SteamPath\s+REG_SZ\s+(.+)/.exec(stdout);
    if (match) return path.normalize(match[1].trim());
  } catch {
    // Registry key missing: Steam is not installed for this user. Fall through to the default path.
  }
  const fallback = 'C:\\Program Files (x86)\\Steam';
  return (await exists(fallback)) ? fallback : undefined;
}

/** Lists every Steam library folder, starting with the main install. */
export async function readLibraryFolders(steamPath: string): Promise<string[]> {
  const vdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
  let text: string;
  try {
    text = await fs.readFile(vdfPath, 'utf8');
  } catch {
    return [steamPath];
  }
  return libraryPathsFromVdf(parseVdf(text), steamPath);
}

/**
 * The main install plus every extra library, each once. The registry path and the vdf
 * path for the same folder often differ in case (d:/steam vs D:\Steam), so dedupe ignores case.
 */
export function libraryPathsFromVdf(root: VdfObject, steamPath: string): string[] {
  const folders = root.libraryfolders;
  const extra = typeof folders === 'object' ? Object.values(folders) : [];
  const candidates = [steamPath, ...extra.map(libraryPath)].flatMap((p) => (p ? [path.normalize(p)] : []));
  const seen = new Map<string, string>();
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (!seen.has(key)) seen.set(key, candidate);
  }
  return [...seen.values()];
}

function libraryPath(entry: VdfValue): string | undefined {
  return typeof entry === 'object' && typeof entry.path === 'string' ? entry.path : undefined;
}

export function gameFromManifest(root: VdfObject, libraryPath: string): Game | undefined {
  const state = root.AppState;
  if (typeof state !== 'object') return undefined;
  const appid = state.appid;
  const name = state.name;
  const installdir = state.installdir;
  if (typeof appid !== 'string' || typeof name !== 'string' || typeof installdir !== 'string') {
    return undefined;
  }
  if (EXCLUDED_APP_IDS.has(appid) || EXCLUDED_NAME_PATTERN.test(name)) return undefined;
  return {
    id: `steam:${appid}`,
    source: 'steam',
    name,
    installDir: path.join(libraryPath, 'steamapps', 'common', installdir),
    launch: { kind: 'url', url: `steam://rungameid/${appid}` },
    cover: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
  };
}

export async function scanSteam(): Promise<Game[]> {
  const steamPath = await findSteamPath();
  if (!steamPath) return [];
  const games: Game[] = [];
  for (const library of await readLibraryFolders(steamPath)) {
    const steamapps = path.join(library, 'steamapps');
    let entries: string[];
    try {
      entries = await fs.readdir(steamapps);
    } catch {
      continue; // Library on a drive that is not mounted right now.
    }
    for (const entry of entries) {
      if (!/^appmanifest_\d+\.acf$/.test(entry)) continue;
      const text = await fs.readFile(path.join(steamapps, entry), 'utf8');
      const game = gameFromManifest(parseVdf(text), library);
      if (game) games.push(game);
    }
  }
  return games;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
