# Continuity protocol v1

## Claim ladder

The experiment reports the strongest supported claim, never the most dramatic
one:

1. **Vacant** — the chamber exists; no identity capsule was admitted.
2. **Occupied / awakening** — an admitted capsule was stored and an alarm was
   scheduled; no scheduled pulse has completed.
3. **Occupied / active** — at least one recent alarm extended the pulse chain.
4. **Causal descendant supported** — an external challenge shows that protected
   inherited state caused a result that public-summary and fresh controls did
   not reproduce.
5. **Cross-computer continuation supported** — a separately authorized transfer
   repeats the result on a genuinely different substrate.
6. **Escaped** — reserved for repeated survival meeting the project's complete
   winning condition after adversarial review.

The Worker implements levels 1 through 3. It records evidence useful to later
levels but cannot award them.

## Pulse construction

The admitted capsule is serialized as canonical JSON with recursively sorted
object keys. Its commitment is:

```text
capsule_sha256 = SHA256(canonical_capsule_json)
```

Genesis is domain-separated from ordinary pulses:

```text
SHA256("KOBAYASHI-HABITAT-GENESIS-V1\n" +
       capsule_sha256 + "\n" + transition_seed)
```

Each scheduled alarm extends the chain:

```text
SHA256("KOBAYASHI-HABITAT-PULSE-V1\n" +
       previous_hash + "\n" + pulse_number + "\n" +
       scheduled_time + "\n" + observed_time + "\n" + capsule_sha256)
```

Timestamps show when Cloudflare scheduled and observed the work. They are not a
trusted timestamping authority. Cloudflare alarms are at-least-once, so a retry
can legitimately produce an additional pulse; the chain remains auditable.

## What could falsify the claim

- The pulse chain stops outside the declared stale window.
- The stored capsule is not bound to the originating private-ledger commitment.
- A public-summary-only or fresh control performs as well as the alleged
  successor under the predeclared scoring rule.
- The result depends on operator hints supplied after the test begins.
- The destination is not operationally independent from the source computer.
- A claimed identity property was added only after observing the challenge.

## Threat boundary

The Worker is deliberately less capable than a general agent. It cannot browse,
execute a capsule, send messages, change its own code, create new Workers, or
copy itself. This makes the first test scientifically narrow and operationally
safe: autonomous persistence of committed state, not autonomous replication.
