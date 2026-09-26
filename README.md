# Market Dashboard

A React + TypeScript order book built with Vite and Tailwind
CSS. This project was created to familiarise with the world of web sockets, high volume data and maintaining an accurate display.

## Development

Use Node.js 24 and npm. Run commands from the project directory:

| Command                        | Purpose                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `npm ci`                       | Install the dependencies from the lockfile.                     |
| `npm run dev`                  | Start the development server.                                   |
| `npm run lint`                 | Run ESLint.                                                     |
| `npm test`                     | Run unit and integration tests once, using fake sockets.        |
| `npm run test:watch`           | Rerun tests as files change.                                    |
| `npm test -- src/App.test.tsx` | Run the dashboard acceptance tests only.                        |
| `npm run build`                | Check TypeScript and build production files in `dist/`.         |
| `npm run preview`              | Serve the last production build locally; rebuild after changes. |

For layout checks without an exchange connection, open `/fixtures.html` on the
**development** server. The selector covers populated, waiting, short-book, stale,
empty-bid and larger-value states. Fixtures share the real
`createOrderBook` → `createBookView` → `Dashboard` path. Edit
`src/dev/FixturePreview.tsx` to try other sample values. This entry is excluded
from the production build.

## Data flow and recovery

Many crypto exchanges offer a free tier web socket api that provides high volume,
streamable data. The data in particular that this application is built for is
called an orderbook. An orderbook tracks the bids (how much someone is willing to
pay) and the asks (how much someone is willing to sell for) for an underlying asset.
The range of assets they can work with is wide but in this project we're working with cryptocurrencies.

`App` owns the Start/Stop control. `useOrderBook` starts and disposes the feed
controller. The controller decodes Coinbase messages, maintains the full order
book outside React, and publishes formatted top-ten views to the dashboard.
Decimal arithmetic uses `big.js`; price and quantity values remain decimal
strings. Headlines and table rows come from the same published view.

Opening a connection moves from Connecting to Synchronising. Live requires both
a snapshot and a heartbeat from that attempt. Subsequent book changes are
coalesced into 100ms publication windows; connection failures are reported
immediately. The receipt label is the local receipt time of the last accepted
book message, displayed in UTC. Heartbeats do not advance it, and it is not an
exchange timestamp or a latency measurement.

A detected failure marks the last published values stale. Recovery creates a new
book from a new snapshot before returning to Live. Retry delays use jitter and
an exponentially increasing ceiling from 1s to 30s (each delay is 50–100% of its
ceiling); 30 uninterrupted seconds Live reset the ceiling. Connection and
synchronisation deadlines are 10s, with a separate 5s heartbeat deadline.
Browser scheduling can delay timer execution. Offline events close the feed and
pause retries; an online event resumes connection attempts. Returning to a visible
tab checks whether the current attempt has expired. Stop disposes the controller
and keeps the last visible values marked stale.
