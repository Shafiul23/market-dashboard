import { useEffect, useState } from "react"
import { createBookFeed, initialBookFeedState } from "../feed/bookFeed"
import type { BookFeedOptions, BookFeedState } from "../feed/bookFeed"

export function useOrderBook(
  enabled: boolean,
  options?: Omit<BookFeedOptions, "onChange">,
): BookFeedState {
  const [feedState, setFeedState] = useState(initialBookFeedState)

  useEffect(() => {
    if (!enabled) return
    return createBookFeed({
      ...options,
      onChange: (nextState) => {
        setFeedState((previousState) => {
          if (nextState.receivedAt !== null) {
            return nextState
          }

          return {
            ...nextState,
            book: previousState.book,
            receivedAt: previousState.receivedAt,
          }
        })
      },
    })
  }, [enabled, options])

  return {
    ...feedState,
    status: enabled ? feedState.status : "Stopped",
    isStale: !enabled || feedState.isStale,
  }
}
