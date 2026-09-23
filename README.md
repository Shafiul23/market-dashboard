# Market Dashboard

A minimal React + TypeScript app built with Vite and Tailwind CSS.

Use Node.js 24 and npm. Run these commands from the project directory:

- `npm ci` — install the dependencies from the npm lockfile.
- `npm run dev` — start the development server; open the URL printed in the terminal.
- `npm run lint` — run ESLint.
- `npm test` — run unit and integration tests once.
- `npm run test:watch` — rerun tests as files change.
- `npm run build` — check TypeScript and create a production build in `dist/`.
- `npm run preview` — serve the production build locally after building.

To inspect the layout with sample data, run `npm run dev` and open
`/fixtures.html` on the local URL printed by Vite. Use the selector to review
populated, waiting, short-book, stale, empty-bid, and larger-value states.
Resize the browser to check desktop and stacked layouts. The fixture page uses
the same `createOrderBook` → `createBookView` → `Dashboard` path as real data.
Edit `src/dev/FixturePreview.tsx` to try different prices and quantities. This separate
preview entry is excluded from the production build.

## Dashboard acceptance checks

Run `npm test -- src/App.test.tsx` for page-level acceptance tests. They render
the real app, hook and feed controller with `FakeSocket` replacing WebSocket;
no exchange connection is opened. They cover loading to Live, sorted top ten,
add/replace/remove and level promotion, three kinds of interruption, stale
recovery, replacement snapshots, empty sides, receipt time and stopping.
The current app connects only after **Start order book** is pressed.

Unit tests check individual book/feed rules; these integration tests check their
visible result together. The DOM checks protect the single polite connection
live region and keep routine prices outside it. Neither proves browser layout,
spoken announcements or real network recovery.

Manual checks (run live-feed checks yourself):

| Check             | Procedure and expected result                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Layout            | Open `/fixtures.html`; inspect every scenario at desktop width, 320px narrow mobile and actual browser zoom of 200%. Prices, quantities, stale text and receipt time must remain readable without horizontal page scrolling.                                                                                                                                                                                                                                                                     |
| Screen reader     | With VoiceOver or NVDA running, use the fixture selector to switch Waiting → Populated → Stale. Listen for connection changes. Navigate both named tables and their GBP/BTC column headers. On the real page, start the book and leave focus away from prices: routine price and receipt updates must not produce live announcements.                                                                                                                                                            |
| Real interruption | On `/`, start the book and wait for Live. In DevTools Network, inspect the feed WebSocket's messages. Disable the active network connection (including any alternative connection) or use a network blocker that terminates existing connections. Confirm incoming heartbeats/updates cease and the socket closes or the app's heartbeat watchdog retires it. DevTools Offline alone is not proof that the socket stopped. Expect Reconnecting, stale values and a frozen last-book-update time. |
| Recovery          | Restore connectivity without reloading or pressing Start. Observe a new feed connection and a new `snapshot` message; opening the socket or receiving a heartbeat alone must not restore Live. Once the snapshot and heartbeat have both arrived, expect Live, fresh values and a new receipt time. Record the message order and observed transitions.                                                                                                                                           |
