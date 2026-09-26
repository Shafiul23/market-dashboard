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
  const heartRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const heart = heartRef.current
    if (heartbeatCount === 0 || !heart?.animate) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const animation = heart.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.5)" },
        { transform: "scale(1)" },
      ],
      { duration: 300, easing: "ease-in-out" },
    )

    return () => animation.cancel()
  }, [heartbeatCount])

  return (
    <section
      aria-label="Diagnostics"
      className="min-w-0 rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-300 shadow-sm sm:w-64"
    >
      <h2 className="rounded-t-lg border-b border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium uppercase tracking-wider text-slate-400">
        Diagnostics
      </h2>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="space-y-3 p-4"
      >
        <p>Connection: {connectionLabel}</p>
        <div className="flex items-center gap-3">
          <span>Heartbeat:</span>
          <svg
            ref={heartRef}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="size-6 shrink-0 text-red-500"
          >
            <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
          </svg>
        </div>
        {error && <p className="wrap-anywhere text-amber-200">{error}</p>}
      </div>
    </section>
  )
}
