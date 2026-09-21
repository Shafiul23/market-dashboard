import { useState } from "react"
import { Dashboard } from "./components/Dashboard"
import { useOrderBook } from "./hooks/useOrderBook"

export default function App() {
  const [enabled, setEnabled] = useState(false)
  const { view, status, isStale } = useOrderBook(enabled)

  return (
    <Dashboard
      view={view}
      connectionLabel={status}
      isStale={isStale}
      enabled={enabled}
      onToggle={() => setEnabled((previous) => !previous)}
    />
  )
}
