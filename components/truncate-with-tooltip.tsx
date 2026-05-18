"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: string;
  className?: string;
  onTruncatedChange?: (truncated: boolean) => void;
};

export function TruncateWithTooltip({
  children,
  className,
  onTruncatedChange,
}: Props) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      setTruncated(el.scrollWidth > el.clientWidth);
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children]);

  React.useEffect(() => {
    onTruncatedChange?.(truncated);
  }, [truncated, onTruncatedChange]);

  return (
    <span
      ref={ref}
      className={cn("truncate", className)}
      title={truncated ? children : undefined}
    >
      {children}
    </span>
  );
}
