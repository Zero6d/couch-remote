export type GameSource = 'steam' | 'epic' | 'custom';

export type LaunchSpec =
  | { kind: 'url'; url: string }
  | { kind: 'exe'; path: string; args: string[] };

export interface Game {
  /** Stable id used in URLs, e.g. "steam:570" or "custom:My Game". */
  id: string;
  source: GameSource;
  name: string;
  /** Absolute install folder. Any process whose exe lives under it counts as this game. */
  installDir: string;
  launch: LaunchSpec;
  /** Cover image URL, when a store provides one. */
  cover?: string;
}

export interface ProcessInfo {
  pid: number;
  path: string;
}

export interface RunningGame {
  gameId: string;
  name: string;
  /** Epoch ms when the game was first seen running. */
  since: number;
  pids: number[];
}

export interface CustomGame {
  name: string;
  exe: string;
  args?: string[];
  /** Defaults to the exe's folder. */
  installDir?: string;
}

export interface Config {
  port: number;
  token: string;
  /** How often the process list is refreshed, in ms. */
  pollMs: number;
  customGames: CustomGame[];
}
