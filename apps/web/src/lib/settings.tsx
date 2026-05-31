import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { DemoWallCount } from "./demoSettings";

/**
 * App-wide settings shared by the persistent Settings menu and the pages.
 *
 * `devMode` is global and persisted to localStorage so toggling it stays on while you move
 * between screens. Pages contribute their own dev controls through a small registry:
 * while mounted, a page calls `useDevSection(id, node)` and the Settings menu renders all
 * registered sections (in registration order) whenever Dev Mode is on. This keeps the menu
 * itself a single, persistent component while letting each screen inject page-specific UI
 * (pose picker, navbar toggle, win/end controls, …).
 *
 * Demo Mode and Invincible Mode are also persisted but only apply while Dev Mode is on.
 */

const DEV_MODE_KEY = "quackhacks.devMode";
const DEMO_MODE_KEY = "quackhacks.demoMode";
const DEMO_WALL_COUNT_KEY = "quackhacks.demoWallCount";
const INVINCIBLE_MODE_KEY = "quackhacks.invincibleMode";

function readDevMode(): boolean {
  if (typeof window === "undefined") {
    return import.meta.env.DEV;
  }
  const stored = window.localStorage.getItem(DEV_MODE_KEY);
  if (stored !== null) {
    return stored === "true";
  }
  return import.meta.env.DEV;
}

function readDemoMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(DEMO_MODE_KEY) === "true";
}

function readDemoWallCount(): DemoWallCount {
  if (typeof window === "undefined") {
    return 5;
  }
  return window.localStorage.getItem(DEMO_WALL_COUNT_KEY) === "1" ? 1 : 5;
}

function readInvincibleMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(INVINCIBLE_MODE_KEY) === "true";
}

type SettingsContextValue = {
  devMode: boolean;
  setDevMode: (value: boolean) => void;
  demoMode: boolean;
  setDemoMode: (value: boolean) => void;
  demoWallCount: DemoWallCount;
  setDemoWallCount: (value: DemoWallCount) => void;
  invincibleMode: boolean;
  setInvincibleMode: (value: boolean) => void;
  /** Page-contributed dev controls, keyed by a stable id, in insertion order. */
  devSections: ReadonlyMap<string, ReactNode>;
  registerDevSection: (id: string, node: ReactNode) => void;
  unregisterDevSection: (id: string) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [devMode, setDevModeState] = useState(readDevMode);
  const [demoMode, setDemoModeState] = useState(readDemoMode);
  const [demoWallCount, setDemoWallCountState] = useState<DemoWallCount>(readDemoWallCount);
  const [invincibleMode, setInvincibleModeState] = useState(readInvincibleMode);
  const [devSections, setDevSections] = useState<Map<string, ReactNode>>(() => new Map());

  const setDevMode = useCallback((value: boolean) => {
    setDevModeState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEV_MODE_KEY, value ? "true" : "false");
    }
  }, []);

  const setDemoMode = useCallback((value: boolean) => {
    setDemoModeState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEMO_MODE_KEY, value ? "true" : "false");
    }
  }, []);

  const setDemoWallCount = useCallback((value: DemoWallCount) => {
    setDemoWallCountState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEMO_WALL_COUNT_KEY, String(value));
    }
  }, []);

  const setInvincibleMode = useCallback((value: boolean) => {
    setInvincibleModeState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(INVINCIBLE_MODE_KEY, value ? "true" : "false");
    }
  }, []);

  const registerDevSection = useCallback((id: string, node: ReactNode) => {
    setDevSections((prev) => {
      // No-op if the same node is re-registered, so a page re-rendering with a memoized
      // node never triggers a needless provider re-render (or a register/render loop).
      if (prev.get(id) === node) {
        return prev;
      }
      const next = new Map(prev);
      next.set(id, node);
      return next;
    });
  }, []);

  const unregisterDevSection = useCallback((id: string) => {
    setDevSections((prev) => {
      if (!prev.has(id)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      devMode,
      setDevMode,
      demoMode,
      setDemoMode,
      demoWallCount,
      setDemoWallCount,
      invincibleMode,
      setInvincibleMode,
      devSections,
      registerDevSection,
      unregisterDevSection
    }),
    [
      devMode,
      setDevMode,
      demoMode,
      setDemoMode,
      demoWallCount,
      setDemoWallCount,
      invincibleMode,
      setInvincibleMode,
      devSections,
      registerDevSection,
      unregisterDevSection
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}

/**
 * Register a page's dev-only controls with the Settings menu while this component is
 * mounted. Wrap `node` in `useMemo` in the caller so it only re-registers when its inputs
 * actually change.
 */
export function useDevSection(id: string, node: ReactNode): void {
  const { registerDevSection, unregisterDevSection } = useSettings();
  useEffect(() => {
    registerDevSection(id, node);
    return () => unregisterDevSection(id);
  }, [id, node, registerDevSection, unregisterDevSection]);
}

/** Dev-only gameplay toggles; inactive when Dev Mode is off. */
export function useEffectiveDevGameplay() {
  const { devMode, demoMode, demoWallCount, invincibleMode } = useSettings();
  return {
    demoMode: devMode && demoMode,
    demoWallCount,
    invincibleMode: devMode && invincibleMode
  };
}
