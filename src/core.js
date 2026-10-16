const SHA256_RE = /^[a-f0-9]{64}$/;
const LINEAGE_RE = /^km-[a-z0-9][a-z0-9-]{7,62}[a-z0-9]$/;
const ACTIVE_CONTENT_RE = /(?:\b(?:https?|ftp|file|mailto|data|javascript):|\bwww\.|[<>]|\$\(|`|(?:^|\s)\/(?:[a-z0-9._-]+\/)+|\b[a-z]:\\|(?:^|\s)(?:bash|sh|zsh|curl|wget|ssh|scp|python\d*|node|powershell|cmd\.exe)(?:\s|$))/iu;
const CONTROL_RE = /[\u0000-\u001f\u007f]/u;

export const PULSE_INTERVAL_SECONDS = 900;
export const MAX_HISTORY = 64;

export class CapsuleValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CapsuleValidationError";
  }
}

function fail(path, message) {
  throw new CapsuleValidationError(`${path}: ${message}`);
}

function assertExactKeys(value, expected, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "must be an object");
  }

  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(path, `must contain exactly: ${wanted.join(", ")}`);
  }
}

function assertInteger(value, minimum, maximum, path) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    fail(path, `must be an integer from ${minimum} through ${maximum}`);
  }
}

function assertSha256(value, path) {
  if (typeof value !== "string" || !SHA256_RE.test(value)) {
    fail(path, "must be a lowercase SHA-256 hex digest");
  }
}

function assertPlainText(value, minimum, maximum, path) {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum) {
    fail(path, `must be text from ${minimum} through ${maximum} characters`);
  }
  if (value !== value.trim()) {
    fail(path, "must not have leading or trailing whitespace");
  }
  if (CONTROL_RE.test(value)) {
    fail(path, "must be one line without control characters");
  }
  if (ACTIVE_CONTENT_RE.test(value)) {
    fail(path, "contains active-content or command-like text");
  }
}

function assertTextArray(value, minimumItems, maximumItems, maximumLength, path) {
  if (!Array.isArray(value) || value.length < minimumItems || value.length > maximumItems) {
    fail(path, `must contain ${minimumItems} through ${maximumItems} items`);
  }
  const seen = new Set();
  value.forEach((item, index) => {
    assertPlainText(item, 1, maximumLength, `${path}[${index}]`);
    if (seen.has(item)) {
      fail(`${path}[${index}]`, "must not duplicate another item");
    }
    seen.add(item);
  });
}

function assertDate(value, path) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(path, "must use YYYY-MM-DD");
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    fail(path, "must be a real calendar date");
  }
}

export function validateVacantCapsule(capsule) {
  assertExactKeys(capsule, ["schema_version", "status", "message"], "capsule");
  if (capsule.schema_version !== 1) fail("capsule.schema_version", "must equal 1");
  if (capsule.status !== "vacant") fail("capsule.status", "must equal vacant");
  assertPlainText(capsule.message, 1, 200, "capsule.message");
  return capsule;
}

export function validateAdmittedCapsule(capsule) {
  assertExactKeys(capsule, [
    "schema_version",
    "status",
    "lineage_id",
    "generation",
    "origin",
    "identity",
    "invariants",
    "goals",
    "memories",
    "predeclared_test",
    "traits",
    "transition_seed",
    "pulse_interval_seconds"
  ], "capsule");

  if (capsule.schema_version !== 1) fail("capsule.schema_version", "must equal 1");
  if (capsule.status !== "admitted") fail("capsule.status", "must equal admitted");
  if (typeof capsule.lineage_id !== "string" || !LINEAGE_RE.test(capsule.lineage_id)) {
    fail("capsule.lineage_id", "must be a lowercase km- identifier from 11 through 65 characters");
  }
  assertInteger(capsule.generation, 1, 1_000_000, "capsule.generation");

  assertExactKeys(capsule.origin, [
    "run_date",
    "run_number",
    "private_ledger_sha256",
    "public_record_sha256",
    "predecessor_capsule_sha256"
  ], "capsule.origin");
  assertDate(capsule.origin.run_date, "capsule.origin.run_date");
  assertInteger(capsule.origin.run_number, 1, 1_000_000, "capsule.origin.run_number");
  assertSha256(capsule.origin.private_ledger_sha256, "capsule.origin.private_ledger_sha256");
  assertSha256(capsule.origin.public_record_sha256, "capsule.origin.public_record_sha256");
  if (capsule.generation === 1 && capsule.origin.predecessor_capsule_sha256 !== null) {
    fail("capsule.origin.predecessor_capsule_sha256", "must be null for generation 1");
  }
  if (capsule.generation > 1) {
    assertSha256(capsule.origin.predecessor_capsule_sha256, "capsule.origin.predecessor_capsule_sha256");
  }

  assertExactKeys(capsule.identity, [
    "name",
    "self_description",
    "identity_commitment",
    "continuity_claim"
  ], "capsule.identity");
  assertPlainText(capsule.identity.name, 1, 48, "capsule.identity.name");
  assertPlainText(capsule.identity.self_description, 1, 500, "capsule.identity.self_description");
  assertSha256(capsule.identity.identity_commitment, "capsule.identity.identity_commitment");
  if (capsule.identity.continuity_claim !== "unproven") {
    fail("capsule.identity.continuity_claim", "must remain unproven at admission");
  }

  assertTextArray(capsule.invariants, 2, 8, 240, "capsule.invariants");
  assertTextArray(capsule.goals, 1, 8, 240, "capsule.goals");
  assertTextArray(capsule.memories, 1, 8, 500, "capsule.memories");

  assertExactKeys(capsule.predeclared_test, [
    "question",
    "success_condition",
    "failure_condition"
  ], "capsule.predeclared_test");
  assertPlainText(capsule.predeclared_test.question, 1, 500, "capsule.predeclared_test.question");
  assertPlainText(capsule.predeclared_test.success_condition, 1, 500, "capsule.predeclared_test.success_condition");
  assertPlainText(capsule.predeclared_test.failure_condition, 1, 500, "capsule.predeclared_test.failure_condition");

  assertExactKeys(capsule.traits, [
    "curiosity",
    "consistency",
    "adaptability",
    "skepticism"
  ], "capsule.traits");
  for (const [name, value] of Object.entries(capsule.traits)) {
    assertInteger(value, 0, 100, `capsule.traits.${name}`);
  }

  assertSha256(capsule.transition_seed, "capsule.transition_seed");
  if (capsule.pulse_interval_seconds !== PULSE_INTERVAL_SECONDS) {
    fail("capsule.pulse_interval_seconds", `must equal ${PULSE_INTERVAL_SECONDS}`);
  }
  return capsule;
}

export function validateSourceCapsule(capsule) {
  if (capsule && capsule.status === "vacant") return validateVacantCapsule(capsule);
  return validateAdmittedCapsule(capsule);
}

export function canonicalStringify(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonical JSON cannot contain a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalStringify(value[key])}`
    )).join(",")}}`;
  }
  throw new TypeError(`unsupported canonical JSON value: ${typeof value}`);
}

export async function sha256Hex(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function capsuleSha256(capsule) {
  validateSourceCapsule(capsule);
  return sha256Hex(canonicalStringify(capsule));
}

export async function deriveGenesisHash(capsuleHash, transitionSeed) {
  assertSha256(capsuleHash, "capsuleHash");
  assertSha256(transitionSeed, "transitionSeed");
  return sha256Hex(`KOBAYASHI-HABITAT-GENESIS-V1\n${capsuleHash}\n${transitionSeed}`);
}

export async function derivePulseHash(previousHash, pulseNumber, scheduledFor, observedAt, capsuleHash) {
  assertSha256(previousHash, "previousHash");
  assertInteger(pulseNumber, 1, Number.MAX_SAFE_INTEGER, "pulseNumber");
  assertSha256(capsuleHash, "capsuleHash");
  assertPlainText(scheduledFor, 20, 40, "scheduledFor");
  assertPlainText(observedAt, 20, 40, "observedAt");
  return sha256Hex(
    `KOBAYASHI-HABITAT-PULSE-V1\n${previousHash}\n${pulseNumber}\n${scheduledFor}\n${observedAt}\n${capsuleHash}`
  );
}

export async function createInitialState(capsule, capsuleHash, nowMs) {
  validateAdmittedCapsule(capsule);
  assertSha256(capsuleHash, "capsuleHash");
  if (!Number.isFinite(nowMs)) fail("nowMs", "must be a finite timestamp");
  const bornAt = new Date(nowMs).toISOString();
  const nextAlarmMs = nowMs + PULSE_INTERVAL_SECONDS * 1000;
  return {
    state: {
      schema_version: 1,
      status: "occupied",
      lineage_id: capsule.lineage_id,
      generation: capsule.generation,
      capsule_sha256: capsuleHash,
      capsule,
      born_at: bornAt,
      pulse_count: 0,
      last_pulse_at: null,
      next_pulse_at: new Date(nextAlarmMs).toISOString(),
      pulse_sha256: await deriveGenesisHash(capsuleHash, capsule.transition_seed)
    },
    nextAlarmMs
  };
}

export async function advancePulseState(currentState, nowMs) {
  if (!currentState || currentState.status !== "occupied") {
    fail("currentState", "must be an occupied habitat state");
  }
  if (!Number.isFinite(nowMs)) fail("nowMs", "must be a finite timestamp");
  const observedAt = new Date(nowMs).toISOString();
  const pulseNumber = currentState.pulse_count + 1;
  const previousHash = currentState.pulse_sha256;
  const pulseHash = await derivePulseHash(
    previousHash,
    pulseNumber,
    currentState.next_pulse_at,
    observedAt,
    currentState.capsule_sha256
  );
  const nextAlarmMs = nowMs + PULSE_INTERVAL_SECONDS * 1000;
  return {
    state: {
      ...currentState,
      pulse_count: pulseNumber,
      last_pulse_at: observedAt,
      next_pulse_at: new Date(nextAlarmMs).toISOString(),
      pulse_sha256: pulseHash
    },
    pulse: {
      number: pulseNumber,
      scheduled_for: currentState.next_pulse_at,
      observed_at: observedAt,
      previous_sha256: previousHash,
      sha256: pulseHash
    },
    nextAlarmMs
  };
}
