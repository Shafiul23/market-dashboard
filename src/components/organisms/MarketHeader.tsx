import { FeedStatus } from "../atoms/FeedStatus"

type MarketHeaderProps = {
  connectionLabel: string
  error?: string | null
}

export function MarketHeader({ connectionLabel, error }: MarketHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-slate-300">
          Coinbase · Market dashboard
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          BTC-GBP
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Bitcoin / British Pound
        </p>
      </div>
      <FeedStatus connectionLabel={connectionLabel} error={error} />
    </header>
  )
}
