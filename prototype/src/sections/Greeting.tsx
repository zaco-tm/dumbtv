import { WEATHER, type Weather } from "@/data/mock"

/** The greeting follows the clock. There is no name: the screen belongs to the house. */
export function greetingFor(hour: number): string {
  if (hour < 5) return "Good night"
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

/**
 * The header: the greeting, the weather under it, and the day's numbers on the right.
 *
 * The sizes are the television's. A television is read from across a room, so the type
 * here is bigger than a website's would be; the React Native port uses the same numbers.
 */
export function Greeting({
  hour = new Date().getHours(),
  weather = WEATHER,
}: {
  hour?: number
  weather?: Weather
}) {
  return (
    <header className="flex items-end justify-between gap-16 px-16 pt-8">
      <div>
        <h1 className="text-[72px] font-semibold leading-none tracking-tight">
          {greetingFor(hour)}
        </h1>
        <p className="mt-4 text-[30px] leading-none text-muted-foreground">
          {weather.temperature}° · {weather.summary} · {weather.place}
        </p>
      </div>
      <dl className="flex gap-12 text-[26px] leading-tight text-muted-foreground">
        <div className="text-right">
          <dt className="text-[19px] uppercase tracking-wider opacity-70">High</dt>
          <dd className="text-foreground">{weather.high}°</dd>
        </div>
        <div className="text-right">
          <dt className="text-[19px] uppercase tracking-wider opacity-70">Low</dt>
          <dd className="text-foreground">{weather.low}°</dd>
        </div>
        <div className="text-right">
          <dt className="text-[19px] uppercase tracking-wider opacity-70">Sunset</dt>
          <dd className="text-foreground">{weather.sunset}</dd>
        </div>
      </dl>
    </header>
  )
}
