import { describe, expect, it } from "vitest";
import { toRecordingJson } from "../src/gesture/recording";
import { FIXTURES } from "./catalog";
import { loadFixture } from "./load";

describe("committed fixtures", () => {
  it.each(Object.keys(FIXTURES))("%s.json matches its definition (run npm run fixtures after changing one)", (name) => {
    expect(toRecordingJson(loadFixture(name))).toEqual(toRecordingJson(FIXTURES[name]()));
  });
});
