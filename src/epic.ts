import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Game } from './types.js';

const MANIFEST_DIR = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';

export interface EpicManifest {
  DisplayName?: string;
  InstallLocation?: string;
  AppName?: string;
  CatalogNamespace?: string;
  CatalogItemId?: string;
  bIsIncompleteInstall?: boolean;
}

export function gameFromEpicManifest(manifest: EpicManifest): Game | undefined {
  const { DisplayName, InstallLocation, AppName, CatalogNamespace, CatalogItemId } = manifest;
  if (!DisplayName || !InstallLocation || !AppName || !CatalogNamespace || !CatalogItemId) {
    return undefined;
  }
  if (manifest.bIsIncompleteInstall) return undefined;
  return {
    id: `epic:${AppName}`,
    source: 'epic',
    name: DisplayName,
    installDir: path.normalize(InstallLocation),
    launch: {
      kind: 'url',
      url: `com.epicgames.launcher://apps/${CatalogNamespace}%3A${CatalogItemId}%3A${AppName}?action=launch&silent=true`,
    },
  };
}

export async function scanEpic(): Promise<Game[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(MANIFEST_DIR);
  } catch {
    return []; // Epic launcher not installed.
  }
  const games: Game[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.item')) continue;
    const text = await fs.readFile(path.join(MANIFEST_DIR, entry), 'utf8');
    const game = gameFromEpicManifest(JSON.parse(text) as EpicManifest);
    if (game) games.push(game);
  }
  return games;
}
