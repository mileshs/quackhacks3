import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AudioVolumeControls } from "./AudioVolumeControls";
import { useSettings } from "../lib/settings";
import { cx } from "../lib/ui";

// Per-screen accent for the gear button so the persistent Settings control recolors to
// match each page's theme.
const ACCENT_BY_ROUTE: Array<{ match: (path: string) => boolean; accent: string }> = [
  { match: (p) => p === "/", accent: "#ffaf09" }, // home — sunny yellow
  { match: (p) => p.startsWith("/pose-test"), accent: "#ffc83d" }, // athlete — warm gold
  { match: (p) => p.startsWith("/saboteur"), accent: "#ef5c6b" }, // saboteur — villain red
  { match: (p) => p.startsWith("/settings"), accent: "#75e2be" }, // settings — teal
  { match: (p) => p.startsWith("/score"), accent: "#ffd65c" } // final — gold
];
const DEFAULT_ACCENT = "#ffd65c";

function accentForPath(path: string): string {
  return ACCENT_BY_ROUTE.find((entry) => entry.match(path))?.accent ?? DEFAULT_ACCENT;
}

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/pose-test", label: "Pose Test" },
  { to: "/saboteur", label: "Saboteur" },
  { to: "/settings", label: "Settings" }
];

function GearIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/**
 * The single, persistent Settings control. Rendered once in `App`, it floats top-right on
 * every screen, recolors per route, and opens a dropdown with soundtrack/SFX volume,
 * navigation, a Dev Mode toggle, and any dev controls the current page registered via `useDevSection`.
 */
export function SettingsMenu() {
  const location = useLocation();
  const accent = accentForPath(location.pathname);
  const { devMode, setDevMode, devSections } = useSettings();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on navigation (covers nav links and dev actions that route, e.g. "I Won").
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const sections = Array.from(devSections.entries());

  return (
    <div ref={rootRef} className="fixed top-4 right-4 z-[60] flex flex-col items-end gap-2">
      <button
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-12 cursor-pointer place-items-center rounded-full bg-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.9),0_2px_4px_rgba(0,0,0,0.2),0_10px_22px_rgba(0,0,0,0.28)] transition-transform active:translate-y-px"
        style={{ boxShadow: `inset 0 0 0 2.5px ${accent}, 0 2px 4px rgba(0,0,0,0.2), 0 10px 22px rgba(0,0,0,0.28)` }}
      >
        <GearIcon color={accent} />
      </button>

      {open ? (
        <div className="flex max-h-[80vh] w-[min(320px,86vw)] flex-col gap-4 overflow-y-auto rounded-[18px] bg-[#fdf6e8] p-4 text-[#2b303b] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.9),0_12px_32px_rgba(0,0,0,0.35)]">
          <AudioVolumeControls variant="menu" />

          {/* Navigation */}
          <section className="flex flex-col gap-1.5">
            <span className="text-[11px] font-extrabold tracking-[0.12em] text-[#a89a82] uppercase">Go to</span>
            <div className="grid grid-cols-2 gap-1.5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cx(
                    "rounded-[12px] px-3 py-2 text-center text-sm font-extrabold no-underline transition-colors",
                    location.pathname === link.to
                      ? "bg-[#2b303b] text-white"
                      : "bg-white text-[#2b303b] hover:bg-[#fff]/70 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>

          {/* Dev mode toggle */}
          <section className="flex items-center justify-between rounded-[12px] bg-white px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
            <span className="text-sm font-extrabold">Dev Mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={devMode}
              onClick={() => setDevMode(!devMode)}
              className={cx(
                "relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors",
                devMode ? "bg-[#2fb86b]" : "bg-[#d8cdb5]"
              )}
            >
              <span
                className={cx(
                  "absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform",
                  devMode ? "translate-x-[1.35rem]" : "translate-x-0.5"
                )}
              />
            </button>
          </section>

          {/* Page-specific dev controls */}
          {devMode ? (
            sections.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-[#0000000f] pt-3">
                {sections.map(([id, node]) => (
                  <div key={id}>{node}</div>
                ))}
              </div>
            ) : (
              <p className="m-0 border-t border-[#0000000f] pt-3 text-xs leading-5 font-semibold text-[#a89a82]">
                No dev controls on this screen.
              </p>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
