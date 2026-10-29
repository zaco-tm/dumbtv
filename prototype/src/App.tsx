import * as React from "react"
import { Rail } from "@/components/Rail"
import { STAGE_H, STAGE_W, useFit } from "@/lib/fit"
import { useStageFocus } from "@/lib/tvFocus"
import { Apps, Inputs } from "@/pages/Apps"
import { Home } from "@/pages/Home"
import { LiveTv } from "@/pages/LiveTv"

/**
 * The prototype of the home screen, at the television's own size.
 *
 * The stage is 1920x1080 and is scaled to fit the window it is shown in, so what the
 * browser shows is what the television would show, pixel for pixel.
 */
export default function App() {
  const scale = useFit()
  const stageRef = React.useRef<HTMLDivElement>(null)
  const onKeyDownCapture = useStageFocus(stageRef)
  const [destination, setDestination] = React.useState("home")

  // The remote's focus has to start somewhere, or the arrow keys do nothing.
  React.useEffect(() => {
    stageRef.current?.querySelector<HTMLElement>("[data-focusable]")?.focus()
  }, [])

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      <div
        ref={stageRef}
        onKeyDownCapture={onKeyDownCapture}
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
        // shrink-0: the stage is the television's size, and it is scaled to fit the
        // window rather than squeezed to fit it.
        className="flex shrink-0 origin-center overflow-hidden bg-background text-foreground"
      >
        <Rail active={destination} onSelect={setDestination} />
        <main className="flex-1 overflow-hidden">
          {destination === "live-tv" ? (
            <LiveTv />
          ) : destination === "apps" ? (
            <Apps />
          ) : destination === "inputs" ? (
            <Inputs />
          ) : (
            <Home />
          )}
        </main>
      </div>
    </div>
  )
}
