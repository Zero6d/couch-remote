import { describe, expect, it } from 'vitest';
import { gameFromEpicManifest } from '../src/epic.js';

const manifest = {
  DisplayName: 'Fortnite',
  InstallLocation: 'C:/Program Files/Epic Games/Fortnite',
  AppName: 'Fortnite',
  CatalogNamespace: 'fn',
  CatalogItemId: '4fe75bbc5a674f4f9b356b5c90567da5',
};

describe('gameFromEpicManifest', () => {
  it('builds the launcher URL from namespace, item id and app name', () => {
    expect(gameFromEpicManifest(manifest)).toEqual({
      id: 'epic:Fortnite',
      source: 'epic',
      name: 'Fortnite',
      installDir: 'C:\\Program Files\\Epic Games\\Fortnite',
      launch: {
        kind: 'url',
        url: 'com.epicgames.launcher://apps/fn%3A4fe75bbc5a674f4f9b356b5c90567da5%3AFortnite?action=launch&silent=true',
      },
    });
  });

  it('skips an install that is still downloading', () => {
    expect(gameFromEpicManifest({ ...manifest, bIsIncompleteInstall: true })).toBeUndefined();
  });

  it('skips a manifest missing the catalog ids', () => {
    expect(gameFromEpicManifest({ ...manifest, CatalogItemId: undefined })).toBeUndefined();
  });
});
