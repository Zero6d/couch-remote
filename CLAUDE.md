# Couch Remote — context for Claude Code

Personal project of the repo owner (a gamer who codes TypeScript at work). Goal: from the phone,
one tap launches a game on the gaming PC, one tap force-closes it from bed, one tap sleeps the PC.
Phone side is a web app served by a Node/TypeScript server on the gaming PC, home Wi-Fi only.

## State as of 2026-11-13

Built and unit-tested on a different (work) PC. Nothing has run on the gaming PC yet.
On this machine the next steps are:

1. `powershell -ExecutionPolicy Bypass -File scripts\setup.ps1` from an Administrator PowerShell.
   It installs Node if missing, builds, enables Wake-on-LAN, turns hibernate/Fast Startup off,
   opens TCP 7777 (Private profile), registers the hidden logon task, starts the server, prints the pairing QR.
2. Pair the phone from the QR, add to home screen, test Launch / Close / Sleep for real.
   Logs: `logs\server.log` and `logs\server.err.log`.
3. Things that could only be verified here: real launch via `steam://` from the hidden task,
   taskkill of the game tree, `rundll32 powrprof.dll,SetSuspendState`, the scheduled task surviving
   a reboot, Wake-on-LAN after sleep and after shutdown (Moonlight's "Wake PC" sends the packet).

## Open work

- **Garena games (Delta Force Garena)**: not supported for launch yet. Custom-game entries work for
  detection and Close (install folder match). To add a `garena` source, capture, while the game runs:
  `Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'delta|garena' } | Select-Object Name, ProcessId, ParentProcessId, ExecutablePath, CommandLine | Format-List`
  and check for a URL handler under `HKLM:\SOFTWARE\Classes\garena*` / `HKCU:\SOFTWARE\Classes\garena*`.
  Then either call the handler, replay the command line, or fall back to opening the launcher plus window automation.
- Later ideas the owner liked: launch Discord/Spotify alongside a game, a "bedtime" button
  (close game, wait for Steam cloud sync, sleep), Tailscale for access from outside the house,
  a hub mode on an always-on box that sends Wake-on-LAN itself.

## Layout

- `src/` server: `steam.ts`/`epic.ts` scanners, `processes.ts` (one long-lived PowerShell child
  streams the process list; a game is "running" when any process exe sits under its install dir),
  `actions.ts` (launch, kill, sleep, shutdown), `server.ts` (Fastify, `X-Token` header auth).
- `web/` phone app: plain HTML/JS, no build. Token arrives once via `?pair=` and is kept in localStorage.
- `scripts/` setup.ps1, start.ps1 (used by the scheduled task), uninstall.ps1, make-icons.mjs.
- `test/` vitest. `npm test`, `npm run typecheck`, `npm run build`, `npm run pair`.
- `config.json` is generated on first run (port, token, pollMs, customGames) and is git-ignored.

## Conventions

- Commits in this repo are authored as `Zero6d <Zero6d@users.noreply.github.com>` (set in `.git/config`).
- Keep the work-PC rules in `~/.claude/rules` in mind only where they apply; this is a hobby repo with no PR flow.
