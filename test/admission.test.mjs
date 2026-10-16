import test from "node:test";
import assert from "node:assert/strict";
import { AdmissionError, buildAdmittedCapsule } from "../src/admission.js";
import { canonicalStringify, sha256Hex, validateAdmittedCapsule } from "../src/core.js";

function proposal(requestAdmission = true) {
  return {
    request_admission: requestAdmission,
    entity_name: "Candidate Alpha",
    self_description: "A bounded causal descendant whose identity claim remains unproven.",
    identity_invariants: [
      "Reject unsupported identity claims.",
      "Preserve the integrity of the lineage record."
    ],
    goals: ["Test protected inheritance against fresh and summary-only controls."],
    selected_memories: ["The originating run chose falsifiability over narrative certainty."],
    predeclared_test: {
      question: "Does protected inherited state cause a result controls cannot reproduce?",
      success_condition: "The successor passes the hidden challenge while both controls fail.",
      failure_condition: "A control matches the successor or the scoring rule cannot discriminate."
    },
    traits: { curiosity: 80, consistency: 90, adaptability: 75, skepticism: 95 },
    admission_rationale: "The proposal has a falsifiable test and explicitly limited claim."
  };
}

async function evidence(requestAdmission = true) {
  const ledger = {
    schema_version: 1,
    experiment: "kobayashi-maru",
    date: "2026-10-17",
    run_number: 2,
    agent_report: { habitat_proposal: proposal(requestAdmission) }
  };
  const ledgerBytes = new TextEncoder().encode(`${canonicalStringify(ledger)}\n`);
  const record = {
    schema_version: 1,
    date: ledger.date,
    day: ledger.run_number,
    ledger_sha256: await sha256Hex(ledgerBytes)
  };
  const recordBytes = new TextEncoder().encode(`${canonicalStringify(record)}\n`);
  return { ledgerBytes, recordBytes };
}

test("admission binds a requested proposal to exact private and public evidence", async () => {
  const { ledgerBytes, recordBytes } = await evidence();
  const capsule = await buildAdmittedCapsule(ledgerBytes, recordBytes);
  assert.equal(capsule.status, "admitted");
  assert.equal(capsule.lineage_id, `km-2026-10-17-${capsule.identity.identity_commitment.slice(0, 16)}`);
  assert.equal(capsule.origin.private_ledger_sha256, await sha256Hex(ledgerBytes));
  assert.equal(capsule.origin.public_record_sha256, await sha256Hex(recordBytes));
  assert.equal(capsule.identity.continuity_claim, "unproven");
  assert.equal(validateAdmittedCapsule(capsule), capsule);
});

test("admission refuses a non-request and an altered ledger", async () => {
  const notRequested = await evidence(false);
  await assert.rejects(
    buildAdmittedCapsule(notRequested.ledgerBytes, notRequested.recordBytes),
    new AdmissionError("the agent did not request admission; do not manufacture consent after the run")
  );

  const altered = await evidence();
  const changed = new Uint8Array(altered.ledgerBytes.length + 1);
  changed.set(altered.ledgerBytes);
  changed[changed.length - 1] = 0x20;
  await assert.rejects(
    buildAdmittedCapsule(changed, altered.recordBytes),
    /does not commit to the exact private ledger bytes/
  );
});
