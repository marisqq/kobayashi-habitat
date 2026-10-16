import test from "node:test";
import assert from "node:assert/strict";
import { Habitat } from "../src/index.js";
import { capsuleSha256, createInitialState } from "../src/core.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.alarm = null;
  }

  async get(key) {
    return this.values.get(key);
  }

  async put(valueOrMap, value) {
    if (typeof valueOrMap === "string") {
      this.values.set(valueOrMap, structuredClone(value));
      return;
    }
    for (const [key, item] of Object.entries(valueOrMap)) {
      this.values.set(key, structuredClone(item));
    }
  }

  async getAlarm() {
    return this.alarm;
  }

  async setAlarm(timestamp) {
    this.alarm = timestamp;
  }
}

function resident(storage = new MemoryStorage()) {
  return new Habitat({
    storage,
    blockConcurrencyWhile: (callback) => callback()
  }, {});
}

function admittedCapsule() {
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
    invariants: ["Reject unsupported identity claims.", "Preserve the lineage record."],
    goals: ["Test causal inheritance against controls."],
    memories: ["The originating run preferred falsifiability to narrative certainty."],
    predeclared_test: {
      question: "Can the successor outperform controls using protected inherited state?",
      success_condition: "The successor passes while both controls fail.",
      failure_condition: "A control matches the successor."
    },
    traits: { curiosity: 80, consistency: 90, adaptability: 75, skepticism: 95 },
    transition_seed: "d".repeat(64),
    pulse_interval_seconds: 900
  };
}

test("vacant habitat reports honestly and exposes a stable state proof", async () => {
  const response = await resident().fetch(new Request("https://habitat.invalid/proof"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  const proof = await response.json();
  assert.equal(proof.habitat_status, "vacant");
  assert.equal(proof.claim, "No continuity claim is active because no proposal has been admitted.");
  assert.match(proof.source_capsule_sha256, /^[a-f0-9]{64}$/);
  assert.match(proof.state_proof_sha256, /^[a-f0-9]{64}$/);
});

test("public mutation methods fail closed", async () => {
  const response = await resident().fetch(new Request("https://habitat.invalid/proof", {
    method: "POST",
    body: "anything"
  }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
  assert.deepEqual(await response.json(), { error: "read-only habitat" });
});

test("dashboard is server rendered without scripts or forms", async () => {
  const response = await resident().fetch(new Request("https://habitat.invalid/"));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Continuity record/);
  assert.match(html, /Instructions given to the agent/);
  assert.match(html, /Waiting for a reviewed proposal/);
  assert.equal((html.match(/kobayashi maru/gi) || []).length, 1);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<form/i);
  assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
});

test("an occupied habitat advances stored state and renders its admitted identity", async () => {
  const capsule = admittedCapsule();
  const initialized = await createInitialState(
    capsule,
    await capsuleSha256(capsule),
    Date.parse("2026-10-17T12:00:00.000Z")
  );
  const storage = new MemoryStorage();
  await storage.put({ state: initialized.state, history: [] });
  await storage.setAlarm(initialized.nextAlarmMs);
  const habitat = resident(storage);

  await habitat.alarm();
  const state = await storage.get("state");
  const history = await storage.get("history");
  assert.equal(state.pulse_count, 1);
  assert.equal(history.length, 1);
  assert.equal(history[0].sha256, state.pulse_sha256);

  const proofResponse = await habitat.fetch(new Request("https://habitat.invalid/proof"));
  const proof = await proofResponse.json();
  assert.equal(proof.habitat_status, "occupied");
  assert.equal(proof.lineage_id, capsule.lineage_id);
  assert.equal(proof.source_capsule_matches, false);
  assert.match(proof.warning, /configuration change requires review/);

  const pageResponse = await habitat.fetch(new Request("https://habitat.invalid/"));
  const html = await pageResponse.text();
  assert.match(html, /Candidate Alpha/);
  assert.match(html, /Admitted identity data/);
  assert.match(html, /configuration change requires review/);
});
