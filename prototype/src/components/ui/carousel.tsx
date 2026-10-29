"use client";

import * as React from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type CarouselProps = {
  children: React.ReactNode[];
  /** Slide width as a fraction of the viewport. */
  slideSize?: number;
  gap?: number;
  label?: string;
  className?: string;
};

/** Drag, flick, arrow-key or dot your way through slides. Snaps to the nearest one. */
export function Carousel({ children, slideSize = 0.82, gap = 16, label = "Carousel", className }: CarouselProps) {
  const reduce = useReducedMotion();
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [index, setIndex] = React.useState(0);
  const x = useMotionValue(0);
  const count = children.length;
  const slideW = width * slideSize;
  const step = slideW + gap;

  React.useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const go = React.useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(count - 1, i));
      setIndex(next);
      animate(x, -next * step + (width - slideW) / 2, reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 36 });
    },
    [count, step, width, slideW, x, reduce],
  );

  React.useEffect(() => go(index), [width]); // re-centre on resize

  return (
    <section aria-roledescription="carousel" aria-label={label} className={cn("w-full", className)}>
      <div
        ref={viewportRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1);
          else if (e.key === "ArrowLeft") go(index - 1);
          else return;
          e.preventDefault();
        }}
        className="overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <motion.div
          className="flex cursor-grab touch-pan-y active:cursor-grabbing"
          style={{ x, gap }}
          drag="x"
          dragConstraints={{ left: -(count - 1) * step + (width - slideW) / 2, right: (width - slideW) / 2 }}
          dragElastic={0.12}
          onDragEnd={(_, info) => {
            const projected = -(x.get() - (width - slideW) / 2 + info.velocity.x * 0.18) / step;
            go(Math.round(projected));
          }}
        >
          {children.map((child, i) => (
            <motion.div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== index}
              className="shrink-0 overflow-hidden rounded-2xl"
              style={{ width: slideW }}
              animate={{ scale: i === index || reduce ? 1 : 0.94, opacity: i === index ? 1 : 0.55 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {child}
            </motion.div>
          ))}
        </motion.div>
      </div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button type="button" aria-label="Previous slide" onClick={() => go(index - 1)} disabled={index === 0} className="grid size-9 cursor-pointer place-items-center rounded-full border text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
        <div className="flex items-center gap-1.5">
          {children.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index || undefined}
              onClick={() => go(i)}
              className="grid h-6 cursor-pointer place-items-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <motion.span className={cn("block h-1.5 rounded-full", i === index ? "bg-foreground" : "bg-muted-foreground/40")} animate={{ width: i === index ? 20 : 6 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
          ))}
        </div>
        <button type="button" aria-label="Next slide" onClick={() => go(index + 1)} disabled={index === count - 1} className="grid size-9 cursor-pointer place-items-center rounded-full border text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>
    </section>
  );
}
