import * as React from "react"
import { Baby, Cable, Gamepad2, House, Play, Settings, Tv } from "lucide-react"
import { LineSidebar, type LineSidebarItem } from "@/components/ui/line-sidebar"

const MAIN: LineSidebarItem[] = [
  { label: "Home", href: "home", icon: <House /> },
  { label: "Live TV", href: "live-tv", icon: <Tv /> },
  { label: "Streaming", href: "streaming", icon: <Play /> },
  { label: "Gaming", href: "gaming", icon: <Gamepad2 /> },
  { label: "Inputs", href: "inputs", icon: <Cable /> },
]

const BOTTOM: LineSidebarItem[] = [
  { label: "Kids", href: "kids", icon: <Baby /> },
  { label: "Settings", href: "settings", icon: <Settings /> },
]

/** The rail's width, in stage pixels. The television's port uses the same number. */
export const RAIL_W = 220

export function Rail({
  active,
  onSelect,
}: {
  active: string
  onSelect: (href: string) => void
}) {
  const navRef = React.useRef<HTMLElement>(null)

  // The rail is column 0 of the screen's focus grid, and its items are the bands down
  // it. The Charcoal sidebar draws its own links, so the grid positions are set here.
  React.useEffect(() => {
    const links = navRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []
    links.forEach((link, i) => {
      link.dataset.focusable = ""
      link.dataset.row = String(i)
      link.dataset.col = "0"
    })
  }, [])

  return (
    // The border is on the rail itself, so the line is one unbroken stroke; the two
    // sidebars inside carry their own but they land on the same edge.
    <nav
      ref={navRef}
      className="flex h-full w-[220px] shrink-0 flex-col border-r border-border bg-card"
    >
      <div className="flex-none">
        <LineSidebar
          items={MAIN}
          activeHref={active}
          width={RAIL_W}
          railWidth={56}
          align="start"
          // There is no pointer on a television. The rail is always open, and the labels
          // are always there: the person holding the remote needs to see where they are.
          expandOnHover={false}
          aria-label="AverageTV"
          onNavigate={(item, event) => {
            event.preventDefault()
            onSelect(item.href)
          }}
        />
      </div>
      <div className="mt-auto border-t border-border">
        <LineSidebar
          items={BOTTOM}
          activeHref={active}
          width={RAIL_W}
          railWidth={56}
          expandOnHover={false}
          aria-label="AverageTV"
          onNavigate={(item, event) => {
            event.preventDefault()
            onSelect(item.href)
          }}
        />
      </div>
    </nav>
  )
}
