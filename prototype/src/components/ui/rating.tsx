"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type RatingProps = {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  max?: number;
  /** Star size in px. */
  size?: number;
  readOnly?: boolean;
  className?: string;
  "aria-label"?: string;
};

const STAR = "M12 2.8l2.75 5.84 6.35.78-4.7 4.38 1.23 6.3L12 17.03 6.37 20.1l1.23-6.3-4.7-4.38 6.35-.78L12 2.8z";

export function Rating({
  value: valueProp,
  defaultValue = 0,
  onValueChange,
  max = 5,
  size = 28,
  readOnly = false,
  className,
  "aria-label": ariaLabel = "Rating",
}: RatingProps) {
  const reduce = useReducedMotion();
  const [inner, setInner] = React.useState(defaultValue);
  const value = valueProp ?? inner;
  const [hover, setHover] = React.useState<number | null>(null);
  const [burst, setBurst] = React.useState(0);
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const shown = hover ?? value;

  const select = (n: number) => {
    if (readOnly) return;
    if (valueProp === undefined) setInner(n);
    onValueChange?.(n);
    setBurst((b) => b + 1);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-readonly={readOnly || undefined}
      className={cn("inline-flex items-center gap-1", className)}
      onPointerLeave={() => setHover(null)}
    >
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        const on = n <= shown;
        return (
          <button
            key={n}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            disabled={readOnly}
            tabIndex={n === (value || 1) ? 0 : -1}
            onClick={() => select(n)}
            onPointerEnter={() => !readOnly && setHover(n)}
            onKeyDown={(e) => {
              const dir = ["ArrowRight", "ArrowUp"].includes(e.key) ? 1 : ["ArrowLeft", "ArrowDown"].includes(e.key) ? -1 : 0;
              if (!dir) return;
              e.preventDefault();
              const next = Math.min(max, Math.max(1, (value || 0) + dir));
              select(next);
              refs.current[next - 1]?.focus();
            }}
            className="cursor-pointer rounded-md p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
          >
            <motion.svg
              key={n <= value ? `${burst}-on` : "off"}
              viewBox="0 0 24 24"
              width={size}
              height={size}
              initial={n <= value && burst && !reduce ? { scale: 0.6, rotate: -20 } : false}
              animate={{ scale: hover === n && !reduce ? 1.15 : 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 14, delay: n <= value && !reduce ? i * 0.04 : 0 }}
              aria-hidden
            >
              <path
                d={STAR}
                strokeWidth={1.6}
                strokeLinejoin="round"
                className={cn(
                  "transition-colors duration-150",
                  on ? "fill-ember stroke-ember" : "fill-transparent stroke-muted-foreground/50",
                )}
              />
            </motion.svg>
          </button>
        );
      })}
    </div>
  );
}
