import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAdmittedCapsule } from "../src/admission.js";

if (process.argv.length !== 4) {
  process.stderr.write("usage: node tools/build-capsule.mjs PRIVATE_LEDGER PUBLIC_RECORD\n");
  process.exitCode = 2;
} else {
  const ledgerBytes = await readFile(resolve(process.argv[2]));
  const recordBytes = await readFile(resolve(process.argv[3]));
  const capsule = await buildAdmittedCapsule(ledgerBytes, recordBytes);
  process.stdout.write(`${JSON.stringify(capsule, null, 2)}\n`);
}
