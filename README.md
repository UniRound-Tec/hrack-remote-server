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

See `docs/DEPLOYMENT.md` for runtime and reverse-proxy configuration.
