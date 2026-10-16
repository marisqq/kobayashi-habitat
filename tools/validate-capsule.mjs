import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { capsuleSha256, validateSourceCapsule } from "../src/core.js";

const target = resolve(process.argv[2] || "capsule.json");
const capsule = JSON.parse(await readFile(target, "utf8"));
validateSourceCapsule(capsule);
const digest = await capsuleSha256(capsule);
process.stdout.write(`valid ${capsule.status} capsule\nsha256 ${digest}\n`);
