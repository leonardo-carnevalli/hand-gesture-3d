import type { ChangeEvent, ReactNode } from "react";
import type { Gesture } from "@/gesture/types";
import type { RuntimeStatus } from "@/runtime";
import { GESTURE_COLORS } from "@/scene/overlay";
import type { Quality } from "@/scene/stage";

export type Mode = "camera" | "replay" | "mouse";

export const GESTURES: { gesture: Gesture; name: string; action: string }[] = [
  { gesture: "point", name: "Point", action: "Hover an object" },
  { gesture: "pinch", name: "Pinch", action: "Select what is under the pinch" },
  { gesture: "fist", name: "Fist and move", action: "Grab and rotate the selection" },
  { gesture: "pinch", name: "Two-hand pinch", action: "Pull apart to scale, tilt to roll" },
  { gesture: "open", name: "Open palm, hold", action: "Reset everything" },
];

interface HudProps {
  mode: Mode;
  status: RuntimeStatus | null;
  quality: Quality;
  message: string | null;
  busy: boolean;
  onCamera: () => void;
  onDemo: () => void;
  onMouse: () => void;
  onLoadFile: (file: File) => void;
  onToggleRecording: () => void;
  onQuality: (quality: Quality) => void;
}

const SOURCES: { mode: Mode; label: string }[] = [
  { mode: "camera", label: "Camera" },
  { mode: "replay", label: "Replay" },
  { mode: "mouse", label: "Mouse" },
];

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-white/5 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
            value === o.value ? "bg-white/15 text-ink" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`space-y-2 border-t border-line pt-3 first:border-0 first:pt-0 ${className}`}>
      <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{title}</h2>
      {children}
    </section>
  );
}

export function Hud(props: HudProps) {
  const { mode, status, quality, message, busy } = props;
  const stage = status?.stage;
  const recording = status?.recordedFrames != null;

  const pickSource = (next: Mode) => {
    if (next === "camera") props.onCamera();
    else if (next === "replay") props.onDemo();
    else props.onMouse();
  };
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) props.onLoadFile(file);
    e.target.value = "";
  };

  return (
    <>
      <header className="pointer-events-none absolute left-4 top-4 max-w-sm sm:left-6 sm:top-6">
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Hand Gesture 3D</h1>
        <p className="mt-1 hidden text-sm text-muted sm:block">Move a 3D scene with your bare hand, through the webcam.</p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] text-accent">
          <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden fill="currentColor">
            <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 5H6V4.5a2 2 0 1 1 4 0V6Z" />
          </svg>
          On-device only. Video never leaves this tab.
        </p>
      </header>

      {message && (
        <p role="status" className="absolute left-1/2 top-24 w-[min(92vw,28rem)] -translate-x-1/2 rounded-lg border border-line bg-panel px-4 py-2 text-center text-sm backdrop-blur sm:top-6">
          {message}
        </p>
      )}

      <aside
        aria-label="Controls"
        className="absolute inset-x-3 bottom-3 max-h-[40dvh] space-y-3 overflow-y-auto rounded-2xl border border-line bg-panel p-4 text-sm backdrop-blur-md sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-6 sm:max-h-[calc(100dvh-3rem)] sm:w-80"
      >
        <Section title="Input">
          <Segmented label="Input source" value={mode} options={SOURCES.map((s) => ({ value: s.mode, label: s.label }))} onChange={pickSource} />
          <div className="flex items-center justify-between text-xs text-muted">
            <label className="cursor-pointer underline-offset-2 hover:text-ink hover:underline">
              Load a recording
              <input type="file" accept="application/json,.json" className="sr-only" onChange={onFile} />
            </label>
            {mode === "camera" && (
              <button onClick={props.onToggleRecording} className={`rounded-md px-2 py-1 font-medium ${recording ? "bg-red-500/20 text-red-300" : "bg-white/5 text-ink hover:bg-white/10"}`}>
                {recording ? `Stop and save (${status?.recordedFrames})` : "Record landmarks"}
              </button>
            )}
            {busy && <span aria-live="polite">Starting…</span>}
          </div>
        </Section>

        <Section title="Hands">
          {mode === "mouse" ? (
            <p className="text-xs text-muted">Drag to rotate, click to select, scroll or pinch to scale, double-click to reset.</p>
          ) : status && status.hands.length > 0 ? (
            <ul className="space-y-2" data-testid="hands">
              {status.hands.map((h) => (
                <li key={h.handedness} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-2 text-xs">
                  <span className="text-muted">{h.handedness}</span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: GESTURE_COLORS[h.gesture] }} />
                    <span className="font-medium">{h.gesture}</span>
                    <span className="h-1 flex-1 overflow-hidden rounded bg-white/10">
                      <span className="block h-full rounded" style={{ width: `${h.confidence * 100}%`, background: GESTURE_COLORS[h.gesture] }} />
                    </span>
                  </span>
                  <span className="text-right font-mono tabular-nums">{Math.round(h.confidence * 100)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No hand in view. Raise one hand, palm to the camera.</p>
          )}
        </Section>

        <Section title="Selection">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs tabular-nums" data-testid="inspector">
            <dt className="text-muted">object</dt>
            <dd className="font-sans font-medium">{stage?.selected ?? "…"}</dd>
            <dt className="text-muted">rotation</dt>
            <dd>{stage ? `${stage.rotation.x.toFixed(0)}° ${stage.rotation.y.toFixed(0)}° ${stage.rotation.z.toFixed(0)}°` : "…"}</dd>
            <dt className="text-muted">scale</dt>
            <dd>{stage ? `${stage.scale.toFixed(2)}×` : "…"}</dd>
          </dl>
        </Section>

        <Section title="Performance">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs tabular-nums" data-testid="fps">
              {status ? Math.round(status.fps) : "–"} fps
              {mode !== "mouse" && <span className="text-muted"> · tracking {status ? Math.round(status.trackingFps) : "–"} Hz</span>}
            </p>
            <div className="w-28">
              <Segmented
                label="Render quality"
                value={quality}
                options={[
                  { value: "high", label: "High" },
                  { value: "low", label: "Low" },
                ]}
                onChange={props.onQuality}
              />
            </div>
          </div>
        </Section>

        <Section title="Gestures" className="hidden sm:block">
          <ul className="space-y-1.5 text-xs">
            {GESTURES.map((g) => (
              <li key={g.name} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: GESTURE_COLORS[g.gesture] }} />
                <span>
                  <span className="font-medium">{g.name}</span>
                  <span className="text-muted"> · {g.action}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </aside>
    </>
  );
}
