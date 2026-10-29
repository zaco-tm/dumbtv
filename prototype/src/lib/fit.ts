import { useEffect, useState } from "react"

/**
 * The stage is designed at the television's own size — 1920x1080 — and scaled to fit the
 * window it is shown in. Everything inside is therefore in "stage pixels", which is what
 * the React Native app will use too (there, scaled by the screen's density).
 */
export const STAGE_W = 1920
export const STAGE_H = 1080

export function useFit() {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const onResize = () =>
      setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H))
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return scale
}
