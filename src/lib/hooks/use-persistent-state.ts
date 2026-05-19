"use client";

import { useState, useCallback, useEffect } from "react";

/**
 * A custom hook to persist state in sessionStorage or localStorage.
 * Guaranteed 100% hydration-safe for Next.js SSR.
 *
 * @param key The key under which the state is saved in storage.
 * @param defaultValue The initial state if no persisted state is found.
 * @param storageType Either 'session' or 'local' (defaults to 'session').
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  storageType: "session" | "local" = "session"
): [T, (value: T | ((val: T) => T)) => void] {
  // Initialize state with default value strictly to avoid hydration mismatches
  const [state, setState] = useState<T>(defaultValue);

  // Load from storage after mount
  useEffect(() => {
    try {
      const storage = storageType === "local" ? window.localStorage : window.sessionStorage;
      const item = storage.getItem(key);
      if (item !== null) {
        setState(JSON.parse(item));
      }
    } catch (error) {
      console.warn(`Error reading persistent state key "${key}":`, error);
    }
  }, [key, storageType]);

  const setPersistentState = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        setState((current) => {
          const next = value instanceof Function ? value(current) : value;
          if (typeof window !== "undefined") {
            const storage = storageType === "local" ? window.localStorage : window.sessionStorage;
            storage.setItem(key, JSON.stringify(next));
          }
          return next;
        });
      } catch (error) {
        console.warn(`Error setting persistent state key "${key}":`, error);
      }
    },
    [key, storageType]
  );

  return [state, setPersistentState];
}
