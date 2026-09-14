# Market Dashboard

A minimal React + TypeScript app built with Vite and Tailwind CSS.

Use Node.js 24 and npm. Run these commands from the project directory:

- `npm ci` — install the dependencies from the npm lockfile.
- `npm run dev` — start the development server; open the URL printed in the terminal.
- `npm run lint` — run ESLint.
- `npm test` — run the unit tests once.
- `npm run test:watch` — rerun unit tests as files change.
- `npm run build` — check TypeScript and create a production build in `dist/`.
- `npm run preview` — serve the production build locally after building.

To inspect the layout with sample data, run `npm run dev` and open
`/fixtures.html` on the local URL printed by Vite. Use the selector to review
populated, waiting, short-book, stale, empty-bid, and larger-value states.
Resize the browser to check desktop and stacked layouts. The fixture page uses
the same `createOrderBook` → `createBookView` → `App` path as real data.
Edit `src/dev/FixturePreview.tsx` to try different prices and quantities. This separate
preview entry is excluded from the production build.
