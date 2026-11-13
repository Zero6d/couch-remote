import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { Game } from './types.js';

const execFileAsync = promisify(execFile);

/** Opens the game through its store URL (Steam/Epic start themselves if closed) or runs the exe directly. */
export async function launchGame(game: Game): Promise<void> {
  if (game.launch.kind === 'url') {
    // `start` is the only reliable way to hand a protocol URL to the registered launcher.
    // The URL is built by us from a numeric id or a manifest, never from request input.
    await execFileAsync('cmd.exe', ['/c', 'start', '', game.launch.url], { windowsHide: true });
    return;
  }
  const child = spawn(game.launch.path, game.launch.args, {
    cwd: game.installDir,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
}

/** Force-kills every process tree of the game. Unsaved progress is lost; the UI confirms first. */
export async function killProcesses(pids: number[]): Promise<void> {
  const args = pids.flatMap((pid) => ['/PID', String(pid)]);
  try {
    await execFileAsync('taskkill.exe', ['/F', '/T', ...args], { windowsHide: true });
  } catch (err) {
    // taskkill exits 128 when a pid already vanished (a child killed with its parent). That is success.
    const stderr = (err as { stderr?: string }).stderr ?? '';
    if (!/not found|no running instance/i.test(stderr)) throw err;
  }
}

/** Suspends to RAM. The setup script turns hibernate off so this is always sleep, never hibernate. */
export async function sleepPc(): Promise<void> {
  await execFileAsync('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0'], { windowsHide: true });
}

export async function shutdownPc(): Promise<void> {
  await execFileAsync('shutdown.exe', ['/s', '/t', '3'], { windowsHide: true });
}
