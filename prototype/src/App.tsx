import * as React from "react"
import { Rail } from "@/components/Rail"
import { STAGE_H, STAGE_W, useFit } from "@/lib/fit"
import { useStageFocus } from "@/lib/tvFocus"
import { Gaming } from "@/pages/Gaming"
import { Home } from "@/pages/Home"
import { Inputs } from "@/pages/Inputs"
import { LiveTv } from "@/pages/LiveTv"
import { Settings } from "@/pages/Settings"
import { Streaming } from "@/pages/Streaming"

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
          ) : destination === "streaming" ? (
            <Streaming />
          ) : destination === "gaming" ? (
            <Gaming />
          ) : destination === "inputs" ? (
            <Inputs />
          ) : destination === "settings" ? (
            <Settings />
          ) : destination === "kids" ? (
            <Coming page="Kids" />
          ) : (
            <Home />
          )}
        </main>
      </div>
    </div>
  )
}

/**
 * The pages that come with the native side are not here yet — the same words the app
 * uses, so the two do not disagree about what is missing.
 */
function Coming({page}: {page: string}) {
  return (
    <div className="px-16 pt-8">
      <h1 className="text-[72px] font-semibold leading-none tracking-tight">{page}</h1>
      <p className="mt-4 text-[30px] text-muted-foreground">This page is not here yet.</p>
    </div>
  )
}
