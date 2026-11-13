import { spawn, type ChildProcess } from 'node:child_process';
import readline from 'node:readline';
import type { Game, ProcessInfo, RunningGame } from './types.js';

/**
 * One long-lived PowerShell child that prints the process list as a JSON line every pollMs.
 * Spawning PowerShell per poll would cost ~300 ms of CPU each time; keeping it open costs nothing.
 */
const psScript = (pollMs: number) => `
$ErrorActionPreference = 'SilentlyContinue'
while ($true) {
  $list = Get-CimInstance Win32_Process |
    Where-Object { $_.ExecutablePath } |
    ForEach-Object { @{ pid = $_.ProcessId; path = $_.ExecutablePath } }
  [Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject @($list)))
  Start-Sleep -Milliseconds ${pollMs}
}`;

export class ProcessWatcher {
  private child: ChildProcess | undefined;
  private running = new Map<string, RunningGame>();
  private stopped = false;

  constructor(
    private readonly pollMs: number,
    private readonly getGames: () => Game[],
    private readonly log: (msg: string) => void,
  ) {}

  start(): void {
    this.stopped = false;
    this.spawnChild();
  }

  stop(): void {
    this.stopped = true;
    this.child?.kill();
  }

  list(): RunningGame[] {
    return [...this.running.values()].sort((a, b) => a.since - b.since);
  }

  private spawnChild(): void {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psScript(this.pollMs)],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    this.child = child;
    readline.createInterface({ input: child.stdout! }).on('line', (line) => this.onLine(line));
    child.stderr!.on('data', (chunk: Buffer) => this.log(`process watcher: ${chunk.toString().trim()}`));
    child.on('exit', (code) => {
      if (this.stopped) return;
      this.log(`process watcher exited with code ${code}, restarting in 5 s`);
      setTimeout(() => this.spawnChild(), 5000);
    });
  }

  private onLine(line: string): void {
    let procs: ProcessInfo[];
    try {
      procs = JSON.parse(line) as ProcessInfo[];
    } catch (err) {
      this.log(`process watcher: unreadable line (${(err as Error).message})`);
      return;
    }
    this.running = matchRunning(this.getGames(), procs, this.running, Date.now());
  }
}

/** Pure: which games own at least one live process. Keeps the original start time of games still running. */
export function matchRunning(
  games: Game[],
  procs: ProcessInfo[],
  previous: Map<string, RunningGame>,
  now: number,
): Map<string, RunningGame> {
  const next = new Map<string, RunningGame>();
  for (const game of games) {
    const dir = normalizeDir(game.installDir);
    const pids = procs.filter((p) => normalizeDir(p.path).startsWith(dir)).map((p) => p.pid);
    if (pids.length === 0) continue;
    next.set(game.id, {
      gameId: game.id,
      name: game.name,
      since: previous.get(game.id)?.since ?? now,
      pids,
    });
  }
  return next;
}

function normalizeDir(p: string): string {
  const lower = p.replace(/\//g, '\\').toLowerCase();
  return lower.endsWith('\\') ? lower : lower + '\\';
}
