import { describe, expect, it } from 'vitest';
import { matchRunning } from '../src/processes.js';
import type { Game, RunningGame } from '../src/types.js';

const dota: Game = {
  id: 'steam:570', source: 'steam', name: 'Dota 2',
  installDir: 'D:\\Steam\\steamapps\\common\\dota 2 beta',
  launch: { kind: 'url', url: 'steam://rungameid/570' },
};
const cs: Game = {
  id: 'steam:730', source: 'steam', name: 'CS2',
  installDir: 'D:\\Steam\\steamapps\\common\\Counter-Strike Global Offensive',
  launch: { kind: 'url', url: 'steam://rungameid/730' },
};

describe('matchRunning', () => {
  it('matches processes under the install dir regardless of case and slashes', () => {
    const procs = [
      { pid: 10, path: 'd:/steam/steamapps/common/DOTA 2 BETA/game/bin/win64/dota2.exe' },
      { pid: 11, path: 'C:\\Windows\\explorer.exe' },
    ];
    const running = matchRunning([dota, cs], procs, new Map(), 1000);
    expect([...running.values()]).toEqual([{ gameId: 'steam:570', name: 'Dota 2', since: 1000, pids: [10] }]);
  });

  it('does not match a sibling folder that shares the prefix', () => {
    const procs = [{ pid: 12, path: 'D:\\Steam\\steamapps\\common\\dota 2 beta tools\\tool.exe' }];
    expect(matchRunning([dota], procs, new Map(), 1000).size).toBe(0);
  });

  it('keeps the original start time while the game stays running', () => {
    const previous = new Map<string, RunningGame>([
      ['steam:570', { gameId: 'steam:570', name: 'Dota 2', since: 500, pids: [10] }],
    ]);
    const procs = [{ pid: 20, path: 'D:\\Steam\\steamapps\\common\\dota 2 beta\\dota2.exe' }];
    expect(matchRunning([dota], procs, previous, 9000).get('steam:570')?.since).toBe(500);
  });

  it('drops a game once none of its processes remain', () => {
    const previous = new Map<string, RunningGame>([
      ['steam:570', { gameId: 'steam:570', name: 'Dota 2', since: 500, pids: [10] }],
    ]);
    expect(matchRunning([dota], [], previous, 9000).size).toBe(0);
  });
});
