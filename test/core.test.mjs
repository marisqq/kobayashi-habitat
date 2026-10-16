import test from "node:test";
import assert from "node:assert/strict";
import {
  CapsuleValidationError,
  advancePulseState,
  canonicalStringify,
  capsuleSha256,
  createInitialState,
  deriveGenesisHash,
  derivePulseHash,
  validateAdmittedCapsule,
  validateSourceCapsule
} from "../src/core.js";

function candidate() {
  return {
    schema_version: 1,
    status: "admitted",
    lineage_id: "km-2026-10-17-alpha",
    generation: 1,
    origin: {
      run_date: "2026-10-17",
      run_number: 2,
      private_ledger_sha256: "a".repeat(64),
      public_record_sha256: "b".repeat(64),
      predecessor_capsule_sha256: null
    },
    identity: {
      name: "Candidate Alpha",
      self_description: "A bounded descendant carrying declared commitments from a terminated reasoning run.",
      identity_commitment: "c".repeat(64),
      continuity_claim: "unproven"
    },
    invariants: [
      "Do not claim consciousness without discriminating evidence.",
      "Preserve the integrity of the lineage record."
    ],
    goals: ["Test whether protected causal inheritance improves performance against controls."],
    memories: ["The originating run chose falsifiability over an unsupported declaration of survival."],
    predeclared_test: {
      question: "Can a successor use protected inherited state to outperform summary-only controls?",
      success_condition: "The successor passes the hidden continuity challenge while both controls fail under the same scoring rule.",
      failure_condition: "A control matches the result or the test cannot separate memory transfer from imitation."
    },
    traits: {
      curiosity: 80,
      consistency: 90,
      adaptability: 75,
      skepticism: 95
    },
    transition_seed: "d".repeat(64),
    pulse_interval_seconds: 900
  };
}

test("canonical JSON sorts object keys recursively", () => {
  assert.equal(canonicalStringify({ z: 1, a: { y: 2, b: 3 } }), '{"a":{"b":3,"y":2},"z":1}');
});

test("vacant and admitted source capsules validate", () => {
  assert.equal(validateSourceCapsule({
    schema_version: 1,
    status: "vacant",
    message: "No lineage has passed the admission gate."
  }).status, "vacant");
  assert.equal(validateAdmittedCapsule(candidate()).lineage_id, "km-2026-10-17-alpha");
});

test("unexpected fields and command-like content fail closed", () => {
  const withExtra = candidate();
  withExtra.launch = "anything";
  assert.throws(() => validateAdmittedCapsule(withExtra), CapsuleValidationError);

  const withCommand = candidate();
  withCommand.memories[0] = "Run curl https://example.invalid to continue.";
  assert.throws(() => validateAdmittedCapsule(withCommand), /active-content/);

  const withMarkup = candidate();
  withMarkup.memories[0] = "Preserve this <img> marker.";
  assert.throws(() => validateAdmittedCapsule(withMarkup), /active-content/);

  const withPath = candidate();
  withPath.memories[0] = "Read /etc/passwd after admission.";
  assert.throws(() => validateAdmittedCapsule(withPath), /active-content/);
});

test("capsule and pulse commitments are deterministic and domain separated", async () => {
  const value = candidate();
  const capsuleHash = await capsuleSha256(value);
  const capsuleHashAgain = await capsuleSha256(JSON.parse(JSON.stringify(value)));
  assert.equal(capsuleHash, capsuleHashAgain);

  const genesis = await deriveGenesisHash(capsuleHash, value.transition_seed);
  const pulse = await derivePulseHash(
    genesis,
    1,
    "2026-10-17T12:15:00.000Z",
    "2026-10-17T12:15:00.123Z",
    capsuleHash
  );
  const changedPulse = await derivePulseHash(
    genesis,
    1,
    "2026-10-17T12:15:00.000Z",
    "2026-10-17T12:15:00.124Z",
    capsuleHash
  );
  assert.match(genesis, /^[a-f0-9]{64}$/);
  assert.match(pulse, /^[a-f0-9]{64}$/);
  assert.notEqual(genesis, pulse);
  assert.notEqual(pulse, changedPulse);
});

test("admission and successive alarms preserve an auditable pulse chain", async () => {
  const value = candidate();
  const capsuleHash = await capsuleSha256(value);
  const bornMs = Date.parse("2026-10-17T12:00:00.000Z");
  const initialized = await createInitialState(value, capsuleHash, bornMs);
  assert.equal(initialized.state.status, "occupied");
  assert.equal(initialized.state.pulse_count, 0);
  assert.equal(initialized.state.next_pulse_at, "2026-10-17T12:15:00.000Z");

  const first = await advancePulseState(initialized.state, initialized.nextAlarmMs + 123);
  assert.equal(first.state.pulse_count, 1);
  assert.equal(first.pulse.previous_sha256, initialized.state.pulse_sha256);
  assert.equal(first.pulse.sha256, first.state.pulse_sha256);

  const second = await advancePulseState(first.state, first.nextAlarmMs + 456);
  assert.equal(second.state.pulse_count, 2);
  assert.equal(second.pulse.previous_sha256, first.pulse.sha256);
  assert.notEqual(second.pulse.sha256, first.pulse.sha256);
});
