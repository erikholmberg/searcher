"use client";

import * as React from "react";

const STORAGE_KEY = "searcher:dashboard-sidebar-width";

export const SIDEBAR_WIDTH_DEFAULT = 256;
export const SIDEBAR_WIDTH_MIN = 200;
export const SIDEBAR_WIDTH_MAX = 480;

function clamp(width: number) {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, width));
}

function readStoredWidth(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? clamp(n) : null;
  } catch {
    return null;
  }
}

function writeStoredWidth(width: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    /* ignore quota / private mode */
  }
}

export function useResizableSidebarWidth() {
  const [width, setWidth] = React.useState(SIDEBAR_WIDTH_DEFAULT);

  React.useEffect(() => {
    const stored = readStoredWidth();
    if (stored != null) {
      // Restore saved width after mount (client-only).
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe preference restore
      setWidth(stored);
    }
  }, []);

  const persistWidth = React.useCallback((next: number) => {
    const clamped = clamp(next);
    setWidth(clamped);
    writeStoredWidth(clamped);
  }, []);

  const resetWidth = React.useCallback(() => {
    persistWidth(SIDEBAR_WIDTH_DEFAULT);
  }, [persistWidth]);

  const startResize = React.useCallback((clientX: number, startWidth: number) => {
    const startX = clientX;
    let latest = startWidth;

    const onMove = (event: MouseEvent) => {
      latest = clamp(startWidth + (event.clientX - startX));
      setWidth(latest);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      writeStoredWidth(latest);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const onSeparatorKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      const step = event.shiftKey ? 32 : 8;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setWidth((current) => {
          const next = clamp(current - step);
          writeStoredWidth(next);
          return next;
        });
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setWidth((current) => {
          const next = clamp(current + step);
          writeStoredWidth(next);
          return next;
        });
      } else if (event.key === "Home") {
        event.preventDefault();
        persistWidth(SIDEBAR_WIDTH_MIN);
      } else if (event.key === "End") {
        event.preventDefault();
        persistWidth(SIDEBAR_WIDTH_MAX);
      }
    },
    [persistWidth],
  );

  return {
    width,
    startResize,
    resetWidth,
    onSeparatorKeyDown,
  };
}
