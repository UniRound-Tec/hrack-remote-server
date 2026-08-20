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

See `docs/DEPLOYMENT.md` for runtime and reverse-proxy configuration.
