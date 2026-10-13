// Serves the MediaPipe WASM runtime from our own origin instead of a CDN.
import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const from = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const to = join(root, "public", "mediapipe", "wasm");
mkdirSync(to, { recursive: true });
for (const file of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
  cpSync(join(from, file), join(to, file));
}
console.log("copied MediaPipe WASM to public/mediapipe/wasm");
