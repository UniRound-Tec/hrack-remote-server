# HRack Remote Server

Anonymous, single-process HTTP/WebSocket relay for HRack remote control protocol v1.

This repository intentionally owns no terminal or session business logic. It creates one-desktop/one-phone rooms, validates the vendored v1 protocol, forwards only role-allowed messages, and revokes rooms.

Requires Node.js 22 or newer.

```sh
npm install
npm run typecheck
npm test
npm run e2e
npm run build
```

Run a production build locally:

```powershell
$env:PUBLIC_ORIGIN = 'http://127.0.0.1:3000'
$env:ALLOW_INSECURE_LOOPBACK = '1'
$env:BASE_PATH = '/remote'
npm run build
npm start
```

`npm run verify:live` builds the production artifacts, launches the CLI as a separate process, calls the real HTTP/WebSocket interfaces, restarts it, and checks captured logs for secrets.

## Browser controller demo

The built-in P4 demo controller uses the same protocol and PTY data path as a
phone client. It is not a simulated terminal:

1. Create a room on the generation page and pair its join URL in HRack.
2. Select **Open browser demo**, then **Connect**.
3. Select a live AI CLI session and type in the xterm terminal.
4. Select **Back to sessions** or **Disconnect** to release control.

The standalone controller is available at `<BASE_PATH>/demo/` for manually
pasting a join URL. It accepts only same-origin join URLs, does not persist them,
and does not implement P5 remote session creation.

See `docs/DEPLOYMENT.md` for runtime and reverse-proxy configuration.
