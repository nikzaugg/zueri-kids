# zueri-kids

What can we do today with a 0–4 year old in Zurich?

- **Web app** – day view, week view, search and filters for activities in the
  city of Zurich (community centres, clubs, libraries, indoor playgrounds, …).
- **Data** – curated YAML files in `data/`, one per venue.
- **Research tool** – Claude Code commands (`/research`, `/discover`,
  `/reverify`) and CLI scripts (`validate`, `report`, `trace`).

This project is spec-driven: see [`docs/specs/`](docs/specs/000-overview.md).

## Run it

```bash
nvm use
npm install
npm run dev        # http://localhost:4321
npm test           # unit tests
npm run e2e        # Playwright smoke tests
npm run validate   # check data
```

Deployment: pushing to `main` on GitHub runs `.github/workflows/ci.yml`
and publishes the site to GitHub Pages (Settings → Pages → Source:
GitHub Actions).
