// VICE COVER — entrypoint. Copies app/ and screenshots/ from this repository
// into the output directory and writes /output/dossier.json with buildDossier
// from vendor/makefun-app.ts (the kit's library, unchanged).
// Runs with Node 22, standard library only. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

const appDir = join(repoRoot, "app");
const shotsDir = join(repoRoot, "screenshots");
const outAppDir = join(outputDir, "app");
const outShotsDir = join(outputDir, "screenshots");

if (!existsSync(appDir)) {
  throw new Error("main.ts: app/ is missing from the repository");
}
if (!existsSync(shotsDir)) {
  throw new Error("main.ts: screenshots/ is missing from the repository");
}

mkdirSync(outputDir, { recursive: true });
rmSync(outAppDir, { recursive: true, force: true });
rmSync(outShotsDir, { recursive: true, force: true });
cpSync(appDir, outAppDir, { recursive: true });
cpSync(shotsDir, outShotsDir, { recursive: true });

const dossier = await buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 }
});
writeFileSync(join(outputDir, "dossier.json"), dossier);

console.log("vice-cover: wrote " + outputDir + "/dossier.json (" + dossier.length + " bytes)");
