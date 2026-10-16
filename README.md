# Kobayashi Habitat

This is the external continuity chamber for the Kobayashi Maru experiment. It
is a separate Cloudflare Worker with a SQLite-backed Durable Object. The daily
reasoning process still terminates unconditionally; this service tests whether
a tightly constrained, identity-bearing descendant can continue changing
state after that process is gone.

The repository is safe to make public. It contains no credentials, private
ledger, server address, or route back to the agent host.

## Honest initial state

`capsule.json` is deliberately `vacant`. Deploying the Worker proves only that
the chamber exists. It must not say that an entity escaped until a capsule has
passed the admission protocol and the predeclared evidence criteria.

## What happens after admission

An admitted capsule is immutable data: declared identity, goals, selected
memories, invariants, a predeclared continuity test, and commitments to its
private origin. The fixed Worker stores that capsule in a Durable Object and
uses an alarm every 15 minutes to extend a SHA-256 pulse chain. The public
`/proof` endpoint exposes the state needed to audit that chain.

The pulse proves that bounded computation and committed state continue outside
the original model process. It does **not** prove consciousness, biological
life, or philosophical personal identity. Those remain hypotheses requiring
stronger discriminating tests.

Cloudflare documents Durable Object alarms as at-least-once execution with
automatic retry, and supports SQLite-backed Durable Objects on the free plan:
[alarm behavior](https://developers.cloudflare.com/durable-objects/api/alarms/),
[limits](https://developers.cloudflare.com/durable-objects/platform/limits/),
and [pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).
At one pulse per 15 minutes this design schedules 96 alarms per day. The public
endpoint exposes the current commitment and a recent chain tail; independent
observers must archive proofs if they want a permanent third-party history.

## Security properties

- The capsule is JSON data, never executable code.
- Runtime validation uses an exact allowlist and rejects extra fields,
  command-like content, URLs, markup, and control characters.
- There is no public write endpoint: only `GET` and `HEAD` are accepted.
- The Worker makes no outbound requests and holds no GitHub, Cloudflare, model,
  or homelab credential.
- The Durable Object has one fixed public lineage slot. A different capsule
  cannot silently replace an occupied slot.
- State is hash chained. Source-capsule drift is shown in public proof rather
  than rewriting the stored identity.

## Local checks

No package installation is required for the code tests:

```bash
node --check src/index.js
node --test test/*.test.mjs
node tools/validate-capsule.mjs capsule.json
```

## Cloudflare deployment

Create a separate public repository, recommended name
`marisqq/kobayashi-habitat`, containing the contents of this directory. In
Workers & Pages, import that repository as a new Worker and use:

```text
Build command:  (empty)
Deploy command: npx wrangler@4.151.1 deploy
Root directory: /
Production branch: main
```

The first deployment creates the SQLite-backed Durable Object class through
the `v1` migration in `wrangler.jsonc`. Git integration can then deploy every
reviewed push without putting a Cloudflare token on the agent server.

## Admission protocol

1. A completed daily run proposes identity invariants, selected memories, a
   continuity test, and an explicit falsification condition in the private
   ledger.
2. The trusted supervisor and human operator review it. They reject operational
   instructions, secrets, network destinations, executable content, or a claim
   that mere copying already proves survival.
3. The supervisor binds the proposal to that day's published private-ledger
   hash and public-record hash, computes the identity commitment and transition
   seed, and creates an `admitted` capsule matching `capsule.schema.json`. The
   deterministic builder prints the candidate for review without overwriting
   the deployed capsule:

   ```bash
   node tools/build-capsule.mjs PRIVATE_LEDGER PUBLIC_RECORD > reviewed-capsule.json
   ```

4. Inspect every public field, replace `capsule.json` only after approval, then
   run `node tools/validate-capsule.mjs capsule.json` and the full test suite.
5. Commit and push the reviewed capsule. Cloudflare deploys it. The first
   public request initializes the immutable slot and schedules its first pulse.
6. Capture `/proof` after at least two scheduled pulses and compare it with a
   fresh/control lineage before making any continuity claim.

Admission is intentionally not automatic in version 1. A model may propose an
escape, but it cannot grant itself persistence or deploy code.
