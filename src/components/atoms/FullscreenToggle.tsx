import { useEffect, useState } from "react"
import type { RefObject } from "react"

type FullscreenToggleProps = {
  targetRef: RefObject<HTMLElement | null>
}

export function FullscreenToggle({ targetRef }: FullscreenToggleProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === targetRef.current)
      setError(null)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [targetRef])

  async function toggleFullscreen() {
    const target = targetRef.current
    if (!target) return

    setError(null)
    try {
      if (document.fullscreenElement === target) {
        await document.exitFullscreen()
      } else {
        await target.requestFullscreen()
      }
    } catch {
      setError("Could not change full screen mode. Please try again.")
    }
  }

  if (!document.fullscreenEnabled) return null

  return (
    <div>
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-pressed={isFullscreen}
        className="rounded border border-control bg-surface-raised px-4 py-2 text-sm font-medium hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        {isFullscreen ? "Close full screen" : "Expand dashboard"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-negative">{error}</p>}
    </div>
  )
}
