import { useEffect, useState } from "react"

export function NavBar() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("market-dashboard-theme") === "light" ? "light" : "dark"
    } catch {
      return "dark"
    }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem("market-dashboard-theme", theme)
    } catch {
      // Switching still works when browser storage is unavailable.
    }
  }, [theme])

  const isDark = theme === "dark"

  return (
    <nav aria-label="Main navigation" className="border-b border-divider bg-surface px-4 sm:px-6">
      <div className="flex items-center justify-between gap-4 py-3">
        <a href="/" className="rounded text-sm font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
          Market dashboard
        </a>
        <button
          type="button"
          role="switch"
          aria-label="Dark mode"
          aria-checked={isDark}
          title={`Switch to ${isDark ? "light" : "dark"} mode`}
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="relative flex shrink-0 items-center gap-1 rounded-full border border-control bg-surface-raised p-1 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <span
            aria-hidden="true"
            className={`absolute left-1 top-1 h-9 w-9 rounded-full bg-accent transition-transform duration-[160ms] motion-reduce:transition-none ${isDark ? "translate-x-10" : "translate-x-0"}`}
          />
          <span className={`relative flex h-9 w-9 items-center justify-center rounded-full ${!isDark ? "text-on-accent" : "text-muted"}`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="h-5 w-5">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
            </svg>
          </span>
          <span className={`relative flex h-9 w-9 items-center justify-center rounded-full ${isDark ? "text-on-accent" : "text-muted"}`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M20.9 13.3A9 9 0 0 1 10.7 3.1a9 9 0 1 0 10.2 10.2Z" />
            </svg>
          </span>
        </button>
      </div>
    </nav>
  )
}
