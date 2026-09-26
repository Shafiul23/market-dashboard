import { useState } from "react"
import { Dashboard } from "./components/Dashboard"
import { useOrderBook } from "./hooks/useOrderBook"

export default function App() {
  const [enabled, setEnabled] = useState(false)
  const { view, status, isStale, error, heartbeatCount } = useOrderBook(enabled)

  return (
    <Dashboard
      view={view}
      connectionLabel={status}
      heartbeatCount={heartbeatCount}
      error={enabled ? error : null}
      isStale={isStale}
      enabled={enabled}
      onToggle={() => setEnabled((previous) => !previous)}
    />
  )
}
