# Load Balancing Puzzles

Factorio-inspired belt-balancing puzzle game in the browser. Each puzzle gives
you fixed sources (input belts with mixed resources) and sinks (output belts
requiring a balanced composition). Connect them with belts, splitters,
undergrounds, and filters using only the available footprint.

## Stack

- Vite + React + TypeScript
- PixiJS for the grid render
- Hybrid sim: rate-based win-check today; discrete item animation later.
- Puzzles defined as JSON (`src/puzzles/data/*.json`) or as TS modules added in
  `src/puzzles/index.ts`. An in-browser level editor is a planned stretch goal.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and
publishes to GitHub Pages. The Vite `base` is set to `/load-balancing-puzzles/`.
Enable Pages → "GitHub Actions" in the repo settings the first time.

## Roadmap

- [x] Grid + belt placement
- [x] Steady-state flow solver for belts
- [x] Sink composition check with tolerance
- [ ] Splitters (with optional filters)
- [ ] Undergrounds (paired entrance/exit)
- [ ] Item-level animation on top of rate sim
- [ ] In-browser puzzle editor and shareable puzzle URLs
- [ ] Solution scoring (cells used, tier cost)

## Project layout

```
src/
  sim/        domain types + flow solver
  puzzles/    schema, JSON data, registry
  ui/         Pixi board component
  App.tsx     sidebar + tool palette
```
