import { describe, expect, it } from 'vitest';
import { parseVdf } from '../src/vdf.js';
import { gameFromManifest, libraryPathsFromVdf } from '../src/steam.js';

const MANIFEST = `
"AppState"
{
	"appid"		"570"
	"name"		"Dota 2"
	"installdir"		"dota 2 beta"
	"UserConfig"
	{
		"language"		"english"
	}
}`;

describe('parseVdf', () => {
  it('parses nested objects and quoted values', () => {
    const root = parseVdf(MANIFEST);
    expect(root).toEqual({
      AppState: { appid: '570', name: 'Dota 2', installdir: 'dota 2 beta', UserConfig: { language: 'english' } },
    });
  });

  it('keeps escaped backslashes in paths', () => {
    const root = parseVdf('"libraryfolders" { "1" { "path" "D:\\\\SteamLibrary" } }');
    expect(root).toEqual({ libraryfolders: { 1: { path: 'D:\\SteamLibrary' } } });
  });
});

describe('gameFromManifest', () => {
  it('builds a Steam game with launch URL, install dir and cover', () => {
    const game = gameFromManifest(parseVdf(MANIFEST), 'D:\\Steam');
    expect(game).toEqual({
      id: 'steam:570',
      source: 'steam',
      name: 'Dota 2',
      installDir: 'D:\\Steam\\steamapps\\common\\dota 2 beta',
      launch: { kind: 'url', url: 'steam://rungameid/570' },
      cover: 'https://cdn.cloudflare.steamstatic.com/steam/apps/570/library_600x900.jpg',
    });
  });

  it.each([
    ['228980', 'Steamworks Common Redistributables'],
    ['1493710', 'Proton Experimental'],
    ['1070560', 'Steam Linux Runtime'],
  ])('skips tool entry %s %s', (appid, name) => {
    const root = parseVdf(`"AppState" { "appid" "${appid}" "name" "${name}" "installdir" "x" }`);
    expect(gameFromManifest(root, 'D:\\Steam')).toBeUndefined();
  });
});

describe('libraryPathsFromVdf', () => {
  it('lists the main install plus every extra library once', () => {
    const root = parseVdf(`
      "libraryfolders" {
        "0" { "path" "D:\\\\Steam" }
        "1" { "path" "E:\\\\Games\\\\SteamLibrary" }
      }`);
    expect(libraryPathsFromVdf(root, 'D:\\Steam')).toEqual(['D:\\Steam', 'E:\\Games\\SteamLibrary']);
  });

  it('treats the registry path and the vdf path as one library when they differ only in case or slashes', () => {
    const root = parseVdf('"libraryfolders" { "0" { "path" "D:\\\\Steam" } }');
    expect(libraryPathsFromVdf(root, 'd:/steam')).toEqual(['d:\\steam']);
  });
});
