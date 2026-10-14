type OrderBookToggleProps = {
  enabled: boolean
  onClick: () => void
}

export function OrderBookToggle({ enabled, onClick }: OrderBookToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-accent bg-accent text-on-accent px-4 py-2 text-sm font-medium hover:border-accent-hover hover:bg-accent-hover active:border-accent-pressed active:bg-accent-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      {enabled ? "Stop order book" : "Start order book"}
    </button>
  )
}
