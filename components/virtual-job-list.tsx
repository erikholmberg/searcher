"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

const ESTIMATED_ROW_HEIGHT = 168;
const ROW_GAP = 12;

type Props<T> = {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey: (item: T, index: number) => string;
  scrollRef: React.RefObject<HTMLElement | null>;
  className?: string;
  /** Disable virtualization below this count (simpler DOM for tiny lists). */
  virtualizeMin?: number;
};

export function VirtualJobList<T>({
  items,
  renderItem,
  getKey,
  scrollRef,
  className,
  virtualizeMin = 25,
}: Props<T>) {
  const useVirtual = items.length >= virtualizeMin;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT + ROW_GAP,
    overscan: 6,
    enabled: useVirtual,
  });

  if (!useVirtual) {
    return (
      <div className={cn("space-y-3 w-full min-w-0", className)}>
        {items.map((item, index) => (
          <React.Fragment key={getKey(item, index)}>
            {renderItem(item, index)}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        className="relative w-full min-w-0"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={getKey(item, virtualRow.index)}
              className="absolute left-0 top-0 w-full"
              style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="pb-3">{renderItem(item, virtualRow.index)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
