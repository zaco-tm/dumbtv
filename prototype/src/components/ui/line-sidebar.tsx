"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type LineSidebarItem = { label: string; icon?: React.ReactNode; href: string };

export type LineSidebarProps = {
  items: LineSidebarItem[];
  activeHref?: string;
  /** Grow the lines into labelled items while the pointer is over the rail. Focus always expands it. */
  expandOnHover?: boolean;
  /** Expanded width in px. */
  width?: number;
  /** Collapsed rail width in px. */
  railWidth?: number;
  /**
   * Where the items sit in the rail's height. The sidebar centres them; a television's
   * rail puts them at the top, because the gear and the children's face are at the
   * bottom and the space between them should stay empty.
   */
  align?: "start" | "center";
  onNavigate?: (item: LineSidebarItem, event: React.MouseEvent) => void;
  "aria-label"?: string;
  className?: string;
};

/** A sidebar reduced to short lines that grow into labelled items when the rail is hovered, the active one in ember. */
export function LineSidebar({
  items,
  activeHref,
  expandOnHover = true,
  width = 220,
  railWidth = 56,
  align = "center",
  onNavigate,
  "aria-label": ariaLabel = "Sidebar",
  className,
}: LineSidebarProps) {
  const reduce = useReducedMotion();
  const [hover, setHover] = React.useState(false);
  const [focusWithin, setFocusWithin] = React.useState(false);
  const open = !expandOnHover || hover || focusWithin;
  const listRef = React.useRef<HTMLUListElement>(null);
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 360, damping: 34 };

  // Roving focus: arrows move between links, Home/End jump; focus itself keeps the rail open.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const links = Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    e.preventDefault();
    const to = e.key === "Home" ? 0 : e.key === "End" ? links.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
    links[to]?.focus();
  };

  return (
    <motion.nav
      aria-label={ariaLabel}
      initial={false}
      animate={{ width: open ? width : railWidth }}
      transition={spring}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setFocusWithin(false)}
      onKeyDown={onKeyDown}
      className={cn("flex h-full shrink-0 flex-col overflow-hidden border-r bg-card", className)}
    >
      <ul
        ref={listRef}
        className={cn(
          "m-0 flex flex-1 list-none flex-col gap-1 p-2",
          align === "start" ? "justify-start" : "justify-center",
        )}
      >
        {items.map((item, i) => {
          const isActive = item.href === activeHref;
          return (
            <li key={item.href}>
              <a
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={open ? undefined : item.label}
                title={open ? undefined : item.label}
                onClick={(e) => onNavigate?.(item, e)}
                className={cn(
                  "group relative flex h-[60px] items-center gap-4 rounded-xl px-4 outline-none transition-colors hover:bg-accent focus:ring-4 focus:ring-ring focus-visible:ring-4 focus-visible:ring-ring",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="grid w-8 shrink-0 place-items-center">
                  {/* The line is the collapsed glyph; it shrinks to a dot-length tick when an icon takes over. */}
                  <motion.span
                    aria-hidden
                    initial={false}
                    animate={{ width: open && item.icon ? 0 : isActive ? 30 : 20, opacity: open && item.icon ? 0 : 1 }}
                    transition={{ ...spring, delay: reduce ? 0 : i * 0.02 }}
                    className={cn("absolute h-1 rounded-full", isActive ? "bg-ember shadow-[0_0_10px_var(--ember-glow)]" : "bg-current opacity-60")}
                  />
                  {item.icon && (
                    <motion.span
                      aria-hidden
                      initial={false}
                      animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.6 }}
                      transition={{ ...spring, delay: reduce ? 0 : i * 0.02 }}
                      className={cn("[&_svg]:size-[26px]", isActive && "text-ember")}
                    >
                      {item.icon}
                    </motion.span>
                  )}
                </span>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.span
                      key="label"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: reduce ? 0 : -6, transition: { duration: 0.12 } }}
                      transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1], delay: reduce ? 0 : 0.04 + i * 0.03 }}
                      className={cn("whitespace-nowrap text-[22px]", isActive && "font-medium")}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && <span aria-hidden className="absolute inset-y-2 -left-2 w-0.5 rounded-full bg-ember" />}
              </a>
            </li>
          );
        })}
      </ul>
    </motion.nav>
  );
}
