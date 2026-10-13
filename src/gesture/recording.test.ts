import { describe, expect, it } from "vitest";
import { frameAt, parseRecording, Recorder, toRecordingJson } from "./recording";
import { synthesize } from "./synthetic";

describe("recordings", () => {
  it("round-trip through JSON", () => {
    const recording = synthesize([{ durationMs: 200, hands: [{ pose: "open", handedness: "Right", from: { x: 0.5, y: 0.5 } }] }]);
    const json = JSON.parse(JSON.stringify(toRecordingJson(recording)));
    expect(toRecordingJson(parseRecording(json))).toEqual(json);
  });

  it.each([
    ["not an object", 42],
    ["a wrong version", { version: 2, aspect: 1, frames: [{ t: 0, hands: [] }] }],
    ["empty frames", { version: 1, aspect: 1, frames: [] }],
    ["time going backwards", { version: 1, aspect: 1, frames: [{ t: 10, hands: [] }, { t: 5, hands: [] }] }],
    ["a bad handedness", { version: 1, aspect: 1, frames: [{ t: 0, hands: [{ handedness: "Up", score: 1, landmarks: [] }] }] }],
    ["too few landmarks", { version: 1, aspect: 1, frames: [{ t: 0, hands: [{ handedness: "Left", score: 1, landmarks: [[0, 0, 0]] }] }] }],
  ])("reject %s", (_, raw) => {
    expect(() => parseRecording(raw)).toThrow(/Invalid recording/);
  });

  it("frameAt loops and picks the frame on screen at that moment", () => {
    const recording = parseRecording({ version: 1, aspect: 1, frames: [0, 100, 200].map((t) => ({ t, hands: [] })) });
    expect(frameAt(recording, 0)).toBe(recording.frames[0]);
    expect(frameAt(recording, 150).t).toBe(100);
    expect(frameAt(recording, 200).t).toBe(200);
    expect(frameAt(recording, 251).t).toBe(0);
  });

  it("Recorder rebases time to zero", () => {
    const recorder = new Recorder();
    recorder.add({ t: 5000, hands: [] });
    recorder.add({ t: 5033, hands: [] });
    expect(recorder.size).toBe(2);
    expect(recorder.toRecording(1.5).frames.map((f) => f.t)).toEqual([0, 33]);
  });
});
