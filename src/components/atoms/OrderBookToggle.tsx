type OrderBookToggleProps = {
  enabled: boolean
  onClick: () => void
}

export function OrderBookToggle({ enabled, onClick }: OrderBookToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
    >
      {enabled ? "Stop order book" : "Start order book"}
    </button>
  )
}
