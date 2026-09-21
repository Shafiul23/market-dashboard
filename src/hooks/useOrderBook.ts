import { useEffect, useState } from "react"
import { createBookFeed, initialBookFeedState } from "../feed/bookFeed"

export function useOrderBook() {
  const [state, setState] = useState(initialBookFeedState)

  // Each effect owns one controller; its disposer also guards late callbacks.
  useEffect(() => createBookFeed({ onChange: setState }), [])

  return state
}
