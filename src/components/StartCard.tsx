interface StartCardProps {
  busy: boolean;
  onCamera: () => void;
  onDemo: () => void;
  onMouse: () => void;
}

/** First screen: the camera is never opened until the visitor asks for it. */
export function StartCard({ busy, onCamera, onDemo, onMouse }: StartCardProps) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-canvas/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-labelledby="start-title" className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl">
        <h2 id="start-title" className="text-xl font-semibold tracking-tight">
          Use your hand as the controller
        </h2>
        <p className="mt-2 text-sm text-muted">
          Hand tracking runs in this browser tab with MediaPipe on WebAssembly. Frames are analysed on your device and are never
          uploaded or stored.
        </p>
        <div className="mt-5 grid gap-2">
          <button
            onClick={onCamera}
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-canvas transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          >
            {busy ? "Starting the camera…" : "Enable camera"}
          </button>
          <button onClick={onDemo} className="rounded-lg border border-line bg-white/5 px-4 py-2.5 text-sm font-medium hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-accent">
            Watch a recorded hand
          </button>
          <button onClick={onMouse} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
            Use mouse or touch instead
          </button>
        </div>
      </div>
    </div>
  );
}
