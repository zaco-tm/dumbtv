import { Favorites } from "@/sections/Favorites"
import { Greeting } from "@/sections/Greeting"
import { Trending } from "@/sections/Trending"

/** The home screen: the greeting, the weather, Favorites, and Trending. */
export function Home() {
  return (
    <>
      <Greeting />
      <Favorites />
      <Trending />
    </>
  )
}
