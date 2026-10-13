import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRecording, type Recording } from "../src/gesture/recording";

/** Reads a committed fixture through the same parser the app uses for user files. */
export function loadFixture(name: string): Recording {
  return parseRecording(JSON.parse(readFileSync(join(import.meta.dirname, `${name}.json`), "utf8")));
}
