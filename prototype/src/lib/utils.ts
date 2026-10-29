/**
 * The class-name merge the shadcn components expect at "@/lib/utils".
 *
 * The shadcn CLI writes this file itself; the Charcoal theme install overwrote it, and
 * the components still import it. The `cn` package is the merge: clsx's arguments, with
 * Tailwind's conflicts resolved.
 */
export { cn } from "cn"
