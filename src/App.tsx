function App() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-300">
              Coinbase · Market dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              BTC-GBP
            </h1>
            <p className="mt-2 text-sm text-slate-400">Bitcoin / British Pound</p>
          </div>
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-slate-400"
            />
            Connection: Not connected
          </p>
        </header>

        <section aria-labelledby="overview-heading">
          <h2 id="overview-heading" className="text-lg font-semibold">
            Market overview
          </h2>
          <p className="mt-1 text-sm text-slate-400">Waiting for market data.</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            {["Best bid", "Best ask", "Spread"].map((label) => (
              <div
                key={label}
                className="rounded-lg border border-slate-800 bg-slate-900 p-5"
              >
                <dt className="text-sm text-slate-300">{label} (GBP)</dt>
                <dd className="mt-3 text-3xl font-medium text-slate-400">
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">Waiting for data</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="book-heading">
          <h2 id="book-heading" className="text-lg font-semibold">
            Order book
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Prices in GBP · Quantities in BTC · Up to 10 levels per side
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {["Bids", "Asks"].map((side) => (
              <section
                key={side}
                aria-labelledby={`${side.toLowerCase()}-heading`}
                className="rounded-lg border border-slate-800 bg-slate-900 p-5"
              >
                <h3 id={`${side.toLowerCase()}-heading`} className="font-semibold">
                  {side}
                </h3>
                <p className="py-10 text-center text-sm text-slate-400">
                  Waiting for data.
                </p>
              </section>
            ))}
          </div>
        </section>

        <footer className="border-t border-slate-800 pt-4 text-sm text-slate-400">
          <p>Last book update received: Waiting for data.</p>
        </footer>
      </div>
    </main>
  )
}

export default App
