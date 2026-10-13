import { frameAt, type Recording } from "@/gesture/recording";
import type { Frame } from "@/gesture/types";
import { toViewFrame } from "./mediapipe-adapter";

/** Anything that can feed landmark frames to the engine: a webcam or a replayed recording. */
export interface FrameSource {
  readonly kind: "camera" | "replay";
  /** Width / height of the frames this source produces. */
  readonly aspect: number;
  /** The newest frame, or null when nothing changed since the last call. */
  next(now: number): Frame | null;
  dispose(): void;
}

/** Plays a recording on a loop, stamped with the live clock so filters always see time moving forward. */
export function replaySource(recording: Recording, startedAt: number): FrameSource {
  return {
    kind: "replay",
    aspect: recording.aspect,
    next: (now) => ({ t: now, hands: frameAt(recording, now - startedAt).hands }),
    dispose: () => {},
  };
}

// Pinned model file published by Google for MediaPipe Tasks (float16, about 7.8 MB, cached by the browser).
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export type CameraError = "denied" | "unavailable" | "model";

export class CameraStartError extends Error {
  constructor(readonly reason: CameraError, cause?: unknown) {
    super(reason, { cause });
  }
}

/**
 * Opens the webcam and the HandLandmarker. Frames are analysed in this tab only:
 * the video element is never uploaded, recorded or sent anywhere.
 */
export async function cameraSource(video: HTMLVideoElement): Promise<FrameSource> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: false,
    });
  } catch (error) {
    const denied = error instanceof DOMException && error.name === "NotAllowedError";
    throw new CameraStartError(denied ? "denied" : "unavailable", error);
  }
  video.srcObject = stream;
  await video.play();

  const stop = () => stream.getTracks().forEach((track) => track.stop());
  try {
    const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    const create = (delegate: "GPU" | "CPU") =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });
    const landmarker = await create("GPU").catch(() => create("CPU"));

    let lastVideoTime = -1;
    return {
      kind: "camera",
      aspect: video.videoWidth / video.videoHeight || 16 / 9,
      next(now) {
        if (video.readyState < 2 || video.currentTime === lastVideoTime) return null;
        lastVideoTime = video.currentTime;
        return toViewFrame(landmarker.detectForVideo(video, now), now);
      },
      dispose() {
        landmarker.close();
        stop();
        video.srcObject = null;
      },
    };
  } catch (error) {
    stop();
    throw new CameraStartError("model", error);
  }
}
