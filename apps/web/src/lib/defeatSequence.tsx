import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

type DefeatSequenceContextValue = {
  beginDefeatSequence: () => void;
  endDefeatSequence: () => void;
};

const DefeatSequenceContext = createContext<DefeatSequenceContextValue | null>(null);

type DefeatSequenceProviderProps = {
  children: ReactNode;
  onActiveChange?: (active: boolean) => void;
};

export function DefeatSequenceProvider({ children, onActiveChange }: DefeatSequenceProviderProps) {
  const beginDefeatSequence = useCallback(() => {
    onActiveChange?.(true);
  }, [onActiveChange]);

  const endDefeatSequence = useCallback(() => {
    onActiveChange?.(false);
  }, [onActiveChange]);

  const value = useMemo(
    () => ({ beginDefeatSequence, endDefeatSequence }),
    [beginDefeatSequence, endDefeatSequence]
  );

  return <DefeatSequenceContext.Provider value={value}>{children}</DefeatSequenceContext.Provider>;
}

const noop = () => {};

export function useDefeatSequence() {
  const context = useContext(DefeatSequenceContext);
  if (!context) {
    return { beginDefeatSequence: noop, endDefeatSequence: noop };
  }

  return context;
}
