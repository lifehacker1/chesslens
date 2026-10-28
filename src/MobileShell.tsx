import { useEffect, useRef, useState } from "react";
export type MobileView = "review" | "games" | "insights" | "learn" | "settings";
const items: { id: MobileView; label: string; path: string }[] = [
  { id: "review", label: "Review", path: "M4 4h16v16H4z M4 12h16 M12 4v16" },
  {
    id: "games",
    label: "Games",
    path: "M7 4h13v14H7z M4 7v13h13 M10 8h7 M10 12h5",
  },
  {
    id: "insights",
    label: "Insights",
    path: "M4 19h16 M6 15v-4 M12 15V5 M18 15V8",
  },
  {
    id: "learn",
    label: "Learn",
    path: "M3 5h7l2 2 2-2h7v14h-7l-2 2-2-2H3z M12 7v14",
  },
  {
    id: "settings",
    label: "Settings",
    path: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
  },
];
export interface TouchPreferences {
  haptics: boolean;
  sounds: boolean;
  reducedMotion: boolean;
}
export function readPreferences(): TouchPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem("chesslens-touch") || "{}");
    return {
      haptics: saved.haptics === true,
      sounds: saved.sounds !== false,
      reducedMotion: saved.reducedMotion === true,
    };
  } catch {
    return { haptics: false, sounds: true, reducedMotion: false };
  }
}
export function touchTick(enabled: boolean) {
  if (enabled && typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(8);
    } catch {
      /* Optional feedback; unsupported devices retain visual feedback. */
    }
  }
}
export function MobileNavigation({
  view,
  onSelect,
  running,
}: {
  view: MobileView;
  onSelect: (view: MobileView) => void;
  running: boolean;
}) {
  return (
    <nav className="mobile-app-nav" aria-label="App navigation">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          aria-label={item.label}
          aria-current={view === item.id ? "page" : undefined}
          onClick={() => onSelect(item.id)}
        >
          <span className="nav-icon">
            <svg
              viewBox="0 0 24 24"
              width="23"
              height="23"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={item.path} />
            </svg>
            {item.id === "review" && running && (
              <i aria-label="Analysis running" />
            )}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
export function PageScrollFeedback({ view }: { view: MobileView }) {
  const [progress, setProgress] = useState(0);
  const pending = useRef(0);
  useEffect(() => {
    const update = () => {
      pending.current = 0;
      const total = document.documentElement.scrollHeight - innerHeight;
      setProgress(
        total > 0 ? Math.max(0, Math.min(100, (scrollY / total) * 100)) : 0,
      );
    };
    const schedule = () => {
      if (!pending.current) pending.current = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      cancelAnimationFrame(pending.current);
      pending.current = 0;
    };
  }, [view]);
  return (
    <div
      className="mobile-scroll-feedback"
      role="progressbar"
      aria-label="Page scroll progress"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${progress}%` }} />
    </div>
  );
}
export function TouchSettings({
  value,
  onChange,
  onInstall,
}: {
  value: TouchPreferences;
  onChange: (value: TouchPreferences) => void;
  onInstall?: () => void;
}) {
  return (
    <section className="panel touch-settings" aria-label="Touch preferences">
      <p className="eyebrow">MAKE IT YOURS</p>
      <h2>Touch & comfort</h2>
      <label className="preference-row">
        <span>
          <strong>Move sounds</strong>
          <small>
            A soft wooden click when replaying moves. Turn off for silent
            review.
          </small>
        </span>
        <input
          type="checkbox"
          checked={value.sounds}
          onChange={(e) => onChange({ ...value, sounds: e.target.checked })}
        />
      </label>
      <label className="preference-row">
        <span>
          <strong>Haptic move ticks</strong>
          <small>
            A short vibration as the move dial advances, on supported devices.
            Off by default.
          </small>
        </span>
        <input
          type="checkbox"
          checked={value.haptics}
          onChange={(e) => onChange({ ...value, haptics: e.target.checked })}
        />
      </label>
      <label className="preference-row">
        <span>
          <strong>Reduce animations</strong>
          <small>
            Keep navigation and move feedback still. Your device’s motion
            preference is also respected.
          </small>
        </span>
        <input
          type="checkbox"
          checked={value.reducedMotion}
          onChange={(e) =>
            onChange({ ...value, reducedMotion: e.target.checked })
          }
        />
      </label>
      {onInstall && (
        <button className="primary" onClick={onInstall}>
          Install ChessLens
        </button>
      )}
      <p className="muted">
        Preferences stay in this browser. Import games in Games, analyse in
        Review, and explore the summary in Insights.
      </p>
    </section>
  );
}
