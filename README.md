# did-webs-archon

**did:webs driver using Archon Protocol as witness infrastructure**

This package enables [did:webs](https://trustoverip.github.io/tswg-did-method-webs-specification/) identifiers to use [Archon Protocol](https://archon.technology) as an alternative witness infrastructure to KERI.

## Overview

The did:webs method combines web-based discoverability with cryptographic security:

```
did:webs:<host>:<path>:<AID>
```

Traditionally, did:webs uses KERI for the security layer. This driver enables Archon Protocol (`did:cid`) identifiers to be served as did:webs, with:

- **Archon gatekeepers** as witnesses (instead of KERI witnesses)
- **Archon registries** (hyperswarm, BTC) for anchoring (instead of KERI KEL)
- **`archon.cesr`** event stream (CESR-compatible format)

## Installation

```bash
npm install @archon-protocol/did-webs
```

Or run directly:

```bash
npx @archon-protocol/did-webs generate <did:cid> --host example.com
```

## Quick Start

### Generate did:webs files

```bash
# From a did:cid identifier
npx @archon-protocol/did-webs generate \
  did:cid:bagaaiera7vsjlu6oiluzd4enop5j7sfzjbwp2ujudt6uunkz6hhd4lgfe4sa \
  --host archon.social \
  --output ./webs-files

# Creates:
#   ./webs-files/<aid>/did.json
#   ./webs-files/<aid>/archon.cesr
```

### Serve did:webs files

```bash
# Start a server
npx @archon-protocol/did-webs serve --port 7676 --dir ./webs-files

# Access at:
#   http://localhost:7676/<aid>/did.json
#   http://localhost:7676/<aid>/archon.cesr
```

### Programmatic Usage

```typescript
import { generateWebsFiles, createServer } from '@archon-protocol/did-webs';

// Generate files
const files = await generateWebsFiles(
  'did:cid:bagaaiera7vsjlu6oiluzd4enop5j7sfzjbwp2ujudt6uunkz6hhd4lgfe4sa',
  'archon.social'
);

console.log(files.did);        // did:webs:archon.social:bagaaiera7vsj...
console.log(files.didJson);    // DID document
console.log(files.archonCesr); // Event stream

// Or create an Express server
const app = createServer({ 
  gatekeeperUrl: 'https://archon.technology'
});
app.listen(7676);
```

## did:webs Identifier Format

```
did:webs:archon.social:bagaaiera7vsjlu6oiluzd4enop5j7sfzjbwp2ujudt6uunkz6hhd4lgfe4sa
         └─ host ─────┘└─ Archon AID (did:cid without prefix) ──────────────────────┘
```

With optional path:
```
did:webs:archon.social:flaxscrip:bagaaiera7vsjlu6oiluzd4enop5j7sfzjbwp2ujudt6uunkz6hhd4lgfe4sa
                       └─ path ─┘
```

## Files Served

### `/<aid>/did.json`

Standard DID document with did:webs identifier:

```json
{
  "@context": ["https://www.w3.org/ns/did/v1"],
  "id": "did:webs:archon.social:bagaaiera7vsj...",
  "verificationMethod": [{
    "id": "#key-1",
    "type": "EcdsaSecp256k1VerificationKey2019",
    "controller": "did:webs:archon.social:bagaaiera7vsj...",
    "publicKeyJwk": { ... }
  }],
  "authentication": ["#key-1"],
  "alsoKnownAs": [
    "did:cid:bagaaiera7vsj...",
    "did:web:archon.social:bagaaiera7vsj..."
  ]
}
```

### `/<aid>/archon.cesr`

Archon event stream in CESR-compatible format:

```json
{"v":"ARCHON10JSON000001_","t":"icp","d":"bagaaiera7vsj...","i":"bagaaiera7vsj...","s":"0","kt":"1","k":[{"kty":"EC","crv":"secp256k1",...}],"nt":"1","n":["..."],"bt":"1","b":["https://archon.technology"],"r":"hyperswarm","dt":"2026-02-03T00:12:20Z"}
{"signatures":[{"index":0,"signature":"..."}]}

{"v":"ARCHON10JSON000001_","t":"anc","d":"bagaaierawdhm...","i":"bagaaiera7vsj...","s":"14","r":"BTC:mainnet","anchor":{"chain":"BTC:mainnet","blockHeight":936642,"blockHash":"00000000...","txid":"e66e6250...","timestamp":"2026-02-15T02:52:16Z"}}
```

## Event Types

| Type | Description |
|------|-------------|
| `icp` | Inception — initial key binding |
| `upd` | Update — DID document changes |
| `rot` | Rotation — key change with pre-rotation |
| `anc` | Anchor — registry confirmation (BTC, hyperswarm) |

## Security Model

Archon provides equivalent security properties to KERI:

| Property | KERI | Archon |
|----------|------|--------|
| Self-certifying IDs | ✅ | ✅ |
| Key rotation | ✅ | ✅ |
| Pre-rotation commitment | ✅ | ✅ |
| Witness threshold | ✅ | ✅ |
| Duplicity detection | ✅ | ✅ |
| Blockchain anchoring | Optional | ✅ (BTC, hyperswarm) |

## Integration with Existing did:webs Tools

This driver is compatible with:

- [did-webs-resolver](https://github.com/hyperledger-labs/did-webs-resolver) — Resolution
- [Universal Resolver](https://github.com/decentralized-identity/universal-resolver) — DID resolution
- Standard did:webs verification flows

## API Reference

### `generateWebsFiles(didCid, host, path?, options?)`

Generate did.json and archon.cesr for a did:cid.

```typescript
const files = await generateWebsFiles(
  'did:cid:bagaaiera...',
  'archon.social',
  'flaxscrip',  // optional path
  {
    gatekeeperUrl: 'https://archon.technology',
    witnesses: ['https://archon.technology', 'https://archon.social']
  }
);
```

### `createServer(options?)`

Create an Express server that serves did:webs files.

```typescript
const app = createServer({
  gatekeeperUrl: 'https://archon.technology',
  cacheSeconds: 300
});
```

### `extractAid(didCid)`

Extract the AID from a did:cid string.

### `constructWebsDid(host, path, aid)`

Construct a did:webs identifier string.

## CLI Reference

```bash
# Generate files
did-webs-archon generate <did:cid> --host <host> [--path <path>] [--output <dir>]

# Serve files
did-webs-archon serve [--port <port>] [--dir <dir>] [--gatekeeper <url>]

# Resolve a did:webs
did-webs-archon resolve <did:webs>
```

## Related Projects

- [Archon Protocol](https://archon.technology) — Decentralized identity infrastructure
- [archon.social](https://archon.social) — Naming service using Archon
- [did:webs Specification](https://trustoverip.github.io/tswg-did-method-webs-specification/)
- [KERI](https://keri.one) — Key Event Receipt Infrastructure

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0 — See [LICENSE](LICENSE).

---

*Built by [Archetech](https://archetech.com) — Identity infrastructure for humans and AI agents.*
