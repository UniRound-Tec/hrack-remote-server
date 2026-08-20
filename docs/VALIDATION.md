# P2 validation record — 2026-08-20

This record distinguishes real-interface checks from in-process tests and keeps failed capacity experiments visible.

## Environment

- Host: Windows 11 Pro `10.0.26200`
- CPU: AMD engineering-sample processor, 24 logical processors
- Memory: 47.2 GiB visible to Windows
- Long soak runtime: Node.js `v24.14.0`, npm `11.9.0`
- Minimum-runtime calibration: official `node:22-alpine`, Node.js `v22.23.0`, image digest `node@sha256:ab07539e0988b63558ff621f5fbe1077054c39d9809112974fb79993949d41cd`
- TLS proxy: Nginx `1.31.2`, image digest `nginx@sha256:20316569d8f81a160065d7d2a5eeffc7ca97d79022462ee255fd23fa103a6b5c`

The load generator and relay were separate OS processes. They ran on the same physical host over loopback, so this is a relay/runtime capacity gate, not an Internet-latency benchmark.

## Interface verification

### Production child process

`npm run verify:live` built the production artifacts, launched `dist/server/cli.js` as a separate process, and used real HTTP/WebSocket clients.

```json
{"result":"passed","interface":"real child process HTTP + WebSocket","basePath":"/remote","checks":["health","create","desktop-phone-pair","seat-theft-blocked","directional-relay","revoke-before-close","restart-invalidates-room","secret-free-logs"]}
```

### Browser

A real headless Chromium browser performed all of the following against the built site:

- loaded the `/remote/` generation page and checked CSP;
- created a room through HTTP;
- captured the generated SVG QR as a PNG and independently decoded it with `jsQR`;
- confirmed the decoded QR and clipboard contents exactly equalled `joinUrl`;
- opened the join page and confirmed there was no terminal UI;
- revoked the room and reloaded the join page to the generic unavailable state.

### HTTPS and WSS

A real Nginx container terminated a one-day, local self-signed certificate and proxied to the independent Node process. The client disabled trust verification only for that temporary certificate; the connection still negotiated real TLS and WebSocket Upgrade.

```json
{"result":"passed","interface":"HTTPS + WSS through real Nginx TLS reverse proxy","tlsProtocol":"TLSv1.3","checks":["HTTPS page and CSP","HTTPS create and canonical join URL","WSS upgrade","WSS directional relay","HTTPS revoke before WSS close"]}
```

This proves proxy path preservation and Upgrade behavior, but it is not evidence of public DNS, public-CA certificate renewal, or an external network path.

## Mandatory capacity gate

Profile:

- 2,000 concurrent WebSocket connections in 1,000 paired rooms;
- 100 rooms continuously active in both directions;
- one 1 KiB `pty-in` and one 1 KiB `pty-out` per active room every 100ms;
- independent load process;
- 30-minute duration;
- pass criteria: delivery ratio at least 99%, relay p99 below 100ms, no unexpected disconnect, no client buffer beyond 1 MiB, no sustained linear server-memory growth.

Result on Node.js `v24.14.0`:

```json
{"result":"passed","connections":2000,"rooms":1000,"activeRooms":100,"durationSeconds":1800,"sent":3310400,"received":3310400,"deliveryRatio":1,"p99Ms":4,"maxP99Ms":100,"disconnected":0,"maxClientBufferedBytes":0}
```

Observed server metrics:

- event-loop utilization settled around 5–6%;
- event-loop delay p99 stayed around 32ms, including the same approximately 32ms idle baseline produced by `monitorEventLoopDelay` on this Windows host;
- RSS initially settled around 97–122 MiB, later expanded to a 208–218 MiB allocator/V8 platform;
- heap showed GC cycles and major-GC drops, including a drop from about 48 MiB to 20 MiB near minute 24 and about 23 MiB after traffic stopped;
- neither RSS nor heap showed sustained linear growth during the final 14 minutes.

Minimum-runtime calibration on Node.js `v22.23.0` used the same connection/activity profile for 60 seconds:

```json
{"result":"passed","connections":2000,"rooms":1000,"activeRooms":100,"durationSeconds":60,"sent":110600,"received":110600,"deliveryRatio":1,"p99Ms":13,"maxP99Ms":100,"disconnected":0,"maxClientBufferedBytes":0}
```

Node 22 peaked around 113 MiB RSS in this shorter run. It was slower than Node 24 but remained inside the gate.

## Expansion experiment — not passed

An intentionally harsher experiment kept the mandatory traffic and additionally made all 100 active rooms send 256 KiB in both directions at the same instant every five seconds.

```json
{"result":"failed","connections":2000,"rooms":1000,"activeRooms":100,"durationSeconds":60,"sent":107600,"received":107600,"deliveryRatio":1,"p99Ms":189,"maxP99Ms":100,"disconnected":0,"maxClientBufferedBytes":1447}
```

No frame was lost and no connection failed, but p99 exceeded 100ms. This is an expansion-profile limit, not a passing result. The mandatory gate therefore defaults to no synthetic 256 KiB burst; `LOAD_BURST_BYTES=262144` opts into the separate experiment.

## Remote-host deployment verification

The production image was also deployed to a shared Ubuntu 24.04 x86_64 host with
4 vCPU, 3.8 GiB RAM, and Docker 29.6.1. The container uses Node.js 22.23.0,
runs as the unprivileged `node` user with a read-only root filesystem, has a
768 MiB memory limit, and publishes only `127.0.0.1:8787` for a same-host
reverse proxy. Its restart policy is `unless-stopped`.

An independent container used real HTTP and WebSocket connections against the
deployed process. A second run originated on the development workstation and
crossed the network through an SSH tunnel to the loopback-only upstream.

```json
{"result":"passed","interface":"deployed HTTP + WebSocket","checks":["health","create","pair","phone-to-desktop","desktop-to-phone","revoke-before-close"]}
```

A separate temporary relay instance on the same remote host then ran a controlled
all-active profile. It did not touch or restart the production container:

```json
{"result":"passed","connections":200,"rooms":100,"activeRooms":100,"durationSeconds":30,"sent":59600,"received":59600,"deliveryRatio":1,"p99Ms":19,"maxP99Ms":100,"disconnected":0,"maxClientBufferedBytes":0}
```

The temporary load target and load-generator image were removed after the run.
The production container remained healthy with zero restarts. This remote-host
smoke result is intentionally smaller than the 2,000-connection mandatory gate
because the host is shared with unrelated workloads.

The container currently has a provisional IP-based `PUBLIC_ORIGIN`. It must be
recreated with the final HTTPS domain before browser use, because the application
intentionally rejects a mismatched browser `Origin` and never trusts forwarded
host headers.

## Remaining scope limits

- Single process and single replica only.
- In-memory rooms intentionally disappear on restart.
- No final-domain public Internet or multi-region latency result.
- No public-CA certificate lifecycle result.
- No 20,000-connection expansion result.
- No claim that `MAX_CONNECTIONS=20000` is measured capacity.
