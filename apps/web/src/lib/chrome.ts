import { createContext, useContext } from "react";

/**
 * Lightweight app-chrome control so a full-screen page (e.g. the saboteur stage) can
 * hide the global navbar while it's mounted. The provider lives in `App`.
 */
export type ChromeContextValue = {
  navHidden: boolean;
  setNavHidden: (hidden: boolean) => void;
};

export const ChromeContext = createContext<ChromeContextValue>({
  navHidden: false,
  setNavHidden: () => {}
});

export function useChrome() {
  return useContext(ChromeContext);
}
