import { wrapAngle, type Action } from "@/gesture/actions";

const ROTATE_GAIN = 2 * Math.PI;
const CLICK_SLOP_PX = 6;

/**
 * Mouse and touch fallback that speaks the same actions as the hands:
 * drag rotates, click or tap selects, wheel or two-finger pinch scales (and twists), double-click resets.
 */
export function attachPointerControls(el: HTMLElement, emit: (actions: Action[]) => void): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt: { x: number; y: number } | null = null;
  let twoFinger: { distance: number; angle: number } | null = null;

  const norm = (e: PointerEvent | MouseEvent) => {
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const pair = () => {
    const [a, b] = [...pointers.values()];
    return { distance: Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1), angle: Math.atan2(b.y - a.y, b.x - a.x) };
  };

  const onDown = (e: PointerEvent) => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    downAt = pointers.size === 1 ? { x: e.clientX, y: e.clientY } : null;
    twoFinger = pointers.size === 2 ? pair() : null;
  };

  const onMove = (e: PointerEvent) => {
    const before = pointers.get(e.pointerId);
    if (!before) {
      if (e.pointerType === "mouse") emit([{ type: "hover", ...norm(e) }]);
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && twoFinger) {
      const now = pair();
      emit([
        { type: "scale", factor: now.distance / twoFinger.distance },
        { type: "roll", radians: wrapAngle(now.angle - twoFinger.angle) },
      ]);
      twoFinger = now;
    } else if (pointers.size === 1) {
      const r = el.getBoundingClientRect();
      emit([
        { type: "rotate", yaw: ((e.clientX - before.x) / r.width) * ROTATE_GAIN, pitch: ((e.clientY - before.y) / r.height) * ROTATE_GAIN },
      ]);
    }
  };

  const onUp = (e: PointerEvent) => {
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < CLICK_SLOP_PX) {
      const p = norm(e);
      emit([{ type: "hover", ...p }, { type: "select", ...p }]);
    }
    pointers.delete(e.pointerId);
    downAt = null;
    twoFinger = null;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    emit([{ type: "scale", factor: Math.exp(-e.deltaY * 0.0015) }]);
  };
  const onDouble = () => emit([{ type: "reset" }]);

  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("wheel", onWheel, { passive: false });
  el.addEventListener("dblclick", onDouble);
  return () => {
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    el.removeEventListener("wheel", onWheel);
    el.removeEventListener("dblclick", onDouble);
  };
}
