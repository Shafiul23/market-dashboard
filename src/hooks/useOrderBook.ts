import { useEffect, useState } from "react"
import { createBookFeed, initialBookFeedState } from "../feed/bookFeed"
import type { BookFeedState } from "../feed/bookFeed"

export function useOrderBook(enabled: boolean): BookFeedState {
  const [state, setState] = useState(initialBookFeedState)

  useEffect(() => {
    if (!enabled) return
    return createBookFeed({ onChange: setState })
  }, [enabled])

  return enabled ? state : { ...state, status: "Stopped", isStale: true }
}
