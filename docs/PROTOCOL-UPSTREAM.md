# Protocol upstream

`src/protocol/remote-protocol.ts` is vendored byte-for-byte from HRack:

- Repository: `hrack`
- Commit: `a00bda83d3ead0c89e1e474eacef674015b0fd10`
- Source: `shared/remote-protocol.ts`
- SHA-256: `295c157edd02c7cf6feaa969456822c0a6fe1ec775c99ff1b639f44b3db5f030`

The three files under `fixtures/remote` come from the same commit. Change the upstream HRack protocol and its tests first, then re-vendor the exact file and update the contract hash here. Do not patch the relay copy independently.
