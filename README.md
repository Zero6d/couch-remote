# Couch Remote

Launch, force-close and put your gaming PC to sleep from your phone over home Wi-Fi.
A small Node server runs hidden on the PC; the phone opens a web app you add to the home screen.

## Install on the gaming PC (once)

1. Copy this folder to the gaming PC (for example `D:\couch-remote`).
2. Open PowerShell **as Administrator** in that folder and run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
   ```

   The script installs Node.js if missing, builds the project, enables Wake-on-LAN on the wired
   adapter, turns hibernate and Fast Startup off, opens TCP 7777 on the Private firewall profile,
   registers a scheduled task that starts the server hidden at every logon, starts it, and prints a QR code.

   Flags: `-KeepHibernate` leaves power settings alone, `-SkipNetworkPrivate` does not switch a
   Public network to Private, `-Port 8888` changes the port.

3. Give the PC a fixed IP in your router (DHCP reservation) so the link on the phone keeps working.

## Pair the phone

Scan the QR code with the phone camera (or run `npm run pair` any time to print it again).
The page opens, stores the token, and you add it to the home screen:

- iPhone: Share, then **Add to Home Screen**. It opens full screen.
- Android: Chrome menu, then **Add to Home screen**.

The page is plain http on the LAN, so the browser will not install it as a true PWA with offline
cache; the home-screen shortcut still opens straight to the app.

## Daily use

- Tap a cover to launch. Steam or Epic starts itself if it is closed.
- A running game shows at the top with a timer and a **Close** button (confirm tap, then force kill).
- **Sleep PC** and **Shut down** at the bottom, each behind a confirm tap.
- **Wake**: Moonlight's "Wake PC" on the host entry, or any Wake-on-LAN app with the MAC the setup script printed.
- The refresh button rescans the library after installing a new game.

## Custom games

Anything outside Steam or Epic goes in `config.json`:

```json
{
  "customGames": [
    { "name": "osu!", "exe": "C:\\Users\\me\\AppData\\Local\\osu!\\osu!.exe" }
  ]
}
```

`installDir` defaults to the exe's folder; any process under it counts as the game running.

## Development

```
npm install
npm run dev        # server with reload
npm test           # unit tests
npm run typecheck
```

`scripts\uninstall.ps1` removes the scheduled task and firewall rule. Logs are in `logs\server.log`.
