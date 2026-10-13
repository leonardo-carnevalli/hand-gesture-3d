import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIXTURES } from "../fixtures/catalog";
import { toRecordingJson } from "../src/gesture/recording";

for (const [name, build] of Object.entries(FIXTURES)) {
  const file = join(import.meta.dirname, "..", "fixtures", `${name}.json`);
  writeFileSync(file, `${JSON.stringify(toRecordingJson(build()))}\n`);
  console.log(`wrote fixtures/${name}.json`);
}
