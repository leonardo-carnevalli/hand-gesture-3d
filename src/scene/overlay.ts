import { HAND_CONNECTIONS } from "@/gesture/skeleton";
import type { Gesture, TrackedHand } from "@/gesture/types";

export const GESTURE_COLORS: Record<Gesture, string> = {
  none: "#8a94a6",
  open: "#f4d35e",
  fist: "#ff8a5b",
  pinch: "#7cf2c9",
  point: "#8fb8ff",
};

/** Draws each hand's skeleton and its pointer over the 3D canvas. View space maps straight onto the canvas. */
export function drawHands(ctx: CanvasRenderingContext2D, hands: TrackedHand[]): void {
  const { width, height } = ctx.canvas;
  const scale = width / ctx.canvas.clientWidth || 1;
  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = "round";

  for (const hand of hands) {
    const color = GESTURE_COLORS[hand.gesture];
    const px = (x: number) => x * width;
    const py = (y: number) => y * height;

    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.moveTo(px(hand.landmarks[a].x), py(hand.landmarks[a].y));
      ctx.lineTo(px(hand.landmarks[b].x), py(hand.landmarks[b].y));
    }
    ctx.stroke();

    ctx.fillStyle = "#0d1014";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2 * scale;
    for (const p of hand.landmarks) {
      ctx.beginPath();
      ctx.arc(px(p.x), py(p.y), 4 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const cx = px(hand.pointer.x);
    const cy = py(hand.pointer.y);
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, (hand.gesture === "pinch" ? 10 : 16) * scale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = `600 ${13 * scale}px ui-monospace, monospace`;
    ctx.fillStyle = color;
    ctx.fillText(`${hand.handedness[0]} · ${hand.gesture} ${Math.round(hand.confidence * 100)}%`, cx + 22 * scale, cy - 14 * scale);
  }
  ctx.globalAlpha = 1;
}
