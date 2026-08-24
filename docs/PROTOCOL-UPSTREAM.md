# Protocol upstream

`src/protocol/remote-protocol.ts` is vendored byte-for-byte from HRack:

- Repository: `hrack`
- Commit: `b942fb9c0a931f0102f74c881e5ecd049c8bd4e3`
- Source: `shared/remote-protocol.ts`
- SHA-256: `c265bac86068a9283df35d28e0ac4eee7fa0ac50526cd9fe10662355aa276300`

The three files under `fixtures/remote` come from the same commit. Change the upstream HRack protocol and its tests first, then re-vendor the exact file and update the contract hash here. Do not patch the relay copy independently.
