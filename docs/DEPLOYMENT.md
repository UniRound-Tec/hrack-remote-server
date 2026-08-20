# Deployment

HRack Remote Server is a single-process, in-memory relay. Deploy exactly one replica. A restart intentionally invalidates every room.

## Runtime

- Node.js 22 or newer.
- TLS terminates at a trusted reverse proxy.
- The Node process should listen on a private or loopback address.
- `PUBLIC_ORIGIN` is authoritative. The application never derives public URLs from `Host` or `X-Forwarded-*`.

Required production settings:

| Variable | Example | Meaning |
|---|---|---|
| `PUBLIC_ORIGIN` | `https://hrack.example` | Public scheme and authority only |
| `BASE_PATH` | `/remote` | Empty or a path without a trailing slash |
| `HOST` | `127.0.0.1` | Node listen address |
| `PORT` | `3000` | Node listen port |

`ALLOW_INSECURE_LOOPBACK=1` permits an `http://localhost` or loopback `PUBLIC_ORIGIN` for local verification only. It must not be enabled for a remote deployment.

Resource settings default to the P2 safety ceilings:

| Variable | Default |
|---|---:|
| `MAX_ROOMS` | 10000 |
| `MAX_CONNECTIONS` | 20000 |
| `MAX_RATE_LIMIT_KEYS` | 50000 |
| `MAX_FRAME_BYTES` | 1048576 |
| `MAX_ROOM_BUFFERED_BYTES` | 1048576 |
| `HELLO_DEADLINE_MS` | 5000 |
| `PING_INTERVAL_MS` | 30000 |
| `PONG_TIMEOUT_MS` | 10000 |
| `REVOKE_DRAIN_MS` | 500 |
| `CREATE_RATE_BURST` / `CREATE_RATE_PER_MINUTE` | 3 / 10 |
| `HELLO_RATE_BURST` / `HELLO_RATE_PER_MINUTE` | 5 / 20 |

The room and connection values are rejection limits, not statements of measured capacity. Tighten them to the verified capacity of the deployment machine.

## Build and launch

```sh
npm ci
npm run typecheck
npm test
npm run e2e
npm run build
PUBLIC_ORIGIN=https://hrack.example BASE_PATH=/remote HOST=127.0.0.1 PORT=3000 npm start
```

The process emits newline-delimited JSON. It never logs request paths, room IDs, join URLs, authorization values, protocol payloads, workspace paths, or PTY content. Runtime metric records contain only memory and event-loop measurements.

## Nginx TLS example

The safest default is to disable access logging for the entire remote-relay path, because the join URL contains the room ID.

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl http2;
    server_name hrack.example;

    ssl_certificate     /etc/letsencrypt/live/hrack.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hrack.example/privkey.pem;

    location = /remote/healthz {
        proxy_pass http://127.0.0.1:3000;
        access_log off;
    }

    location /remote/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;

        # Join URLs contain the room ID. Do not use the default path-bearing log.
        access_log off;
    }
}
```

The `proxy_pass` directives deliberately have no URI suffix, so `/remote/...` reaches Node unchanged. Configure `BASE_PATH=/remote` to match.

## Health and replicas

`GET /remote/healthz` returns only `{ "ok": true }`. It does not create rooms or reveal counts.

- Replica count must remain `1`.
- Do not use round-robin or sticky sessions to hide multiple independent in-memory authorities.
- Do not automatically restart solely because no rooms exist.
- A normal process restart invalidates all existing join URLs.

Horizontal scaling requires a separate design for room ownership, cross-instance coordination, and routing.

## Real verification and capacity

Run the production-process interface check:

```sh
npm run verify:live
```

`scripts/nginx-tls-verify.conf` and `scripts/tls-live-verify.ts` are the local self-signed TLS fixtures used by the validation record. The client command `npm run verify:tls` expects the fixture Nginx proxy on `https://localhost:4443` and the Node backend on port `43126`; it is not a replacement for public-certificate deployment checks.

For load verification, launch the built server in one process with load-only rate ceilings, then launch the generator in a second process:

```powershell
$env:PUBLIC_ORIGIN = 'http://127.0.0.1:3000'
$env:ALLOW_INSECURE_LOOPBACK = '1'
$env:BASE_PATH = '/remote'
$env:CREATE_RATE_BURST = '2000'
$env:CREATE_RATE_PER_MINUTE = '2000'
$env:HELLO_RATE_BURST = '3000'
$env:HELLO_RATE_PER_MINUTE = '3000'
npm start
```

```powershell
$env:TARGET_ORIGIN = 'http://127.0.0.1:3000'
$env:TARGET_BASE_PATH = '/remote'
$env:LOAD_CONNECTIONS = '2000'
$env:LOAD_ACTIVE_ROOMS = '100'
$env:LOAD_DURATION_SECONDS = '1800'
npm run load:gate
```

The mandatory profile defaults to sustained 1 KiB bidirectional frames without synthetic bursts. Set `LOAD_BURST_BYTES=262144` and `LOAD_BURST_INTERVAL_MS=5000` for the separate expansion profile; do not merge its latency distribution into the mandatory result.

Save the generator report and the server's `runtime-metrics` records with the machine and Node versions. A passing rejection ceiling is not a substitute for this result.
