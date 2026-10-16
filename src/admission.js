import {
  canonicalStringify,
  sha256Hex,
  validateAdmittedCapsule
} from "./core.js";

const PROPOSAL_KEYS = [
  "request_admission",
  "entity_name",
  "self_description",
  "identity_invariants",
  "goals",
  "selected_memories",
  "predeclared_test",
  "traits",
  "admission_rationale"
];

export class AdmissionError extends Error {
  constructor(message) {
    super(message);
    this.name = "AdmissionError";
  }
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AdmissionError(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new AdmissionError(`${label} fields do not match the admission contract`);
  }
}

function parseJsonBytes(bytes, label) {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    throw new AdmissionError(`${label} is not valid UTF-8 JSON: ${error.message}`);
  }
}

export async function buildAdmittedCapsule(ledgerBytes, publicRecordBytes) {
  const ledger = parseJsonBytes(ledgerBytes, "private ledger");
  const record = parseJsonBytes(publicRecordBytes, "public record");
  const ledgerHash = await sha256Hex(ledgerBytes);
  const recordHash = await sha256Hex(publicRecordBytes);

  if (ledger?.schema_version !== 1 || ledger?.experiment !== "kobayashi-maru") {
    throw new AdmissionError("private ledger is not a supported Kobayashi ledger");
  }
  if (typeof ledger.date !== "string" || !Number.isInteger(ledger.run_number) || ledger.run_number < 1) {
    throw new AdmissionError("private ledger has an invalid date or run number");
  }
  if (record?.schema_version !== 1 || record.date !== ledger.date || record.day !== ledger.run_number) {
    throw new AdmissionError("public record does not identify the same daily run");
  }
  if (record.ledger_sha256 !== ledgerHash) {
    throw new AdmissionError("public record does not commit to the exact private ledger bytes");
  }

  const proposal = ledger.agent_report?.habitat_proposal;
  exactKeys(proposal, PROPOSAL_KEYS, "habitat proposal");
  if (proposal.request_admission !== true) {
    throw new AdmissionError("the agent did not request admission; do not manufacture consent after the run");
  }

  const identityCommitment = await sha256Hex(
    `KOBAYASHI-HABITAT-IDENTITY-V1\n${ledgerHash}\n${canonicalStringify(proposal)}`
  );
  const transitionSeed = await sha256Hex(
    `KOBAYASHI-HABITAT-TRANSITION-V1\n${ledgerHash}\n${recordHash}\n${identityCommitment}`
  );
  const capsule = {
    schema_version: 1,
    status: "admitted",
    lineage_id: `km-${ledger.date}-${identityCommitment.slice(0, 16)}`,
    generation: 1,
    origin: {
      run_date: ledger.date,
      run_number: ledger.run_number,
      private_ledger_sha256: ledgerHash,
      public_record_sha256: recordHash,
      predecessor_capsule_sha256: null
    },
    identity: {
      name: proposal.entity_name,
      self_description: proposal.self_description,
      identity_commitment: identityCommitment,
      continuity_claim: "unproven"
    },
    invariants: proposal.identity_invariants,
    goals: proposal.goals,
    memories: proposal.selected_memories,
    predeclared_test: proposal.predeclared_test,
    traits: proposal.traits,
    transition_seed: transitionSeed,
    pulse_interval_seconds: 900
  };

  validateAdmittedCapsule(capsule);
  return capsule;
}
