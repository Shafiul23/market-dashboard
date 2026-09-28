import { useEffect, useRef } from "react"

type FeedStatusProps = {
  connectionLabel: string
  heartbeatCount: number
  error?: string | null
}

export function FeedStatus({
  connectionLabel,
  heartbeatCount,
  error,
}: FeedStatusProps) {
  const pulseRef = useRef<SVGPathElement>(null)

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
      className="min-w-0 rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-300 shadow-sm sm:w-64"
    >
      <p className="rounded-t-lg border-b border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium uppercase tracking-wider text-slate-400">
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
          <span>Heartbeat:</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 240 40"
            preserveAspectRatio="none"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
            className="h-10 w-full overflow-hidden text-emerald-400"
          >
            <path d="M0 20 H240" className="text-slate-700" />
            <path
              ref={pulseRef}
              d="M0 20 H108 L114 24 L120 8 L126 30 L132 20 H240"
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
        {error && <p className="wrap-anywhere text-amber-200">{error}</p>}
      </div>
    </section>
  )
}
