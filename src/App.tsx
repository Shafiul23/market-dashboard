import { Dashboard } from "./components/Dashboard"
import { useOrderBook } from "./hooks/useOrderBook"

export default function App() {
  const { view, status, isStale } = useOrderBook()

  return <Dashboard view={view} connectionLabel={status} isStale={isStale} />
}
