import { useEffect, useRef } from "react"

type FeedStatusProps = {
  isStale: boolean
  isWaiting: boolean
  connectionLabel: string
  heartbeatCount: number
  error?: string | null
}

export function FeedStatus({
  isStale,
  isWaiting,
  connectionLabel,
  heartbeatCount,
  error,
}: FeedStatusProps) {
  const pulseRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    const pulse = pulseRef.current
    const svg = pulse?.ownerSVGElement
    if (!pulse || !svg) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const x = width / 2
      const y = height / 2

      pulse.setAttribute(
        "d",
        `M0 ${y} H${x - 12} L${x - 6} ${y + 4} L${x} ${y - 12} L${x + 6} ${y + 10} L${x + 12} ${y} H${width}`,
      )
    })
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const pulse = pulseRef.current
    if (heartbeatCount === 0 || !pulse?.animate) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const animation = pulse.animate(
      [
        { strokeDashoffset: "0.8", opacity: 1 },
        { strokeDashoffset: "-0.8", opacity: 1 },
      ],
      { duration: 900, easing: "linear" },
    )

    return () => animation.cancel()
  }, [heartbeatCount])

  return (
    <section
      aria-label="Diagnostics"
      className="min-w-0 rounded-lg border border-divider bg-surface text-sm text-secondary shadow-sm sm:w-64"
    >
      <p className="rounded-t-lg border-b border-divider bg-surface-raised px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted">
        Diagnostics
      </p>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="space-y-3 p-4"
      >
        <p>Connection: {connectionLabel}</p>
        <div className="space-y-2">
          <p id="data-freshness">
            {isWaiting ? "Data: Waiting" : isStale ? "Data: Stale" : "Data: Live"}
          </p>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
            className="h-10 w-full overflow-hidden text-heartbeat"
          >
            <line x1="0" y1="50%" x2="100%" y2="50%" className="text-divider" />
            <path
              ref={pulseRef}
              pathLength="1"
              strokeDasharray="0.8 1"
              strokeDashoffset="0.8"
              opacity="0"
              strokeWidth="2"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        {error && <p className="wrap-anywhere text-warning">{error}</p>}
      </div>
    </section>
  )
}
