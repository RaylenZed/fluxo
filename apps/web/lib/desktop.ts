"use client";

import { useSyncExternalStore } from "react";

type DesktopWindow = Window & {
  fluxoDesktop?: unknown;
};

export function isDesktopRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as DesktopWindow).fluxoDesktop) || navigator.userAgent.includes("Electron/");
}

export function useDesktopMode(): boolean {
  return useSyncExternalStore(
    () => () => {},
    isDesktopRuntime,
    () => false,
  );
}
