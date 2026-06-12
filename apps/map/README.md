# Scout Alumni Map

> **Note:** this feature now also ships inside the Scout web app at `/map`
> (`apps/web/app/map/`), auth-gated and themed with Scout's design tokens.
> That copy is canonical for product work; this workspace remains the **data
> pipeline home** (`scripts/` + `data/geocache.json`) and a standalone static
> demo. `npm run pipeline` updates both apps' data.

Interactive map of Cornell student-athlete alumni for current student-athletes:
explore where ~17k alumni live and work, filter by sport / class year / industry /
company / location, and use the teammate-overlap network to find warm introductions.

Fully static — the deployed app is HTML/JS/CSS plus one baked `alumni.json`.
No backend, no database connection, no credentials in the bundle.

## How it works

```
Supabase (alumni table)
        │  scripts/build-data.mjs  (service-role key, build time only)
        ▼
data/alumni.json   ←  cleaned, deduped, geocoded, campus-year windows baked in
        │  vite build  (JSON ships as a lazy-loaded chunk)
        ▼
dist/              ←  deploy anywhere static (Vercel/Netlify/S3)
```

- **Pipeline** (`scripts/`): pulls all alumni via the Supabase service-role key,
  normalizes sports (87 raw variants → canonical names), merges duplicate
  re-scrapes (same name + sport family + class year ±1), geocodes locations
  (offline GeoNames gazetteer first, Nominatim fallback at 1 req/s), and writes
  `data/alumni.json` + a data-quality `data/report.md`.
- **Geocode cache** (`data/geocache.json`): every resolved (or failed) location
  string is cached, so re-runs only geocode *new* strings. Commit this file.
- **Overlap network**: the pipeline bakes each person's campus window
  (`education` start/end when present, else class year − 4 → class year) and
  canonical sports. The app builds a sport→members index once at load (O(n)),
  which makes teammate lists, "on campus at the same time", 2-hop connection
  paths, and warm-intro candidates instant. (Shipping the full pairwise
  adjacency would be ~850k edges / ~10 MB for zero gain.)

## Credentials

The build script looks for `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and
`SUPABASE_SERVICE_ROLE_KEY` in, in order:

1. `apps/map/.env`
2. repo root `.env`
3. `apps/web/.env.local` (the repo's canonical secrets file — usually already set up)

All of these are gitignored. The key is used only at build time on your machine/CI;
the deployed site contains only the processed `alumni.json`.

## Commands (from repo root)

| Command | What it does |
|---|---|
| `npm run pipeline --workspace=apps/map` | Re-pull from Supabase, re-clean, re-geocode (cached), rewrite `data/alumni.json` + `data/report.md` |
| `npm run dev --workspace=apps/map` | Vite dev server |
| `npm run build --workspace=apps/map` | Typecheck + production build into `apps/map/dist` |
| `npm run preview --workspace=apps/map` | Serve the production build locally |

Pipeline flags: `node scripts/build-data.mjs --retry-failures` retries locations
that previously failed geocoding (e.g. after fixing source data).

## When the Supabase data changes

```sh
npm run pipeline --workspace=apps/map   # seconds, unless many *new* locations appeared
npm run build --workspace=apps/map
# redeploy dist/
```

Check `data/report.md` after each run — it lists geocoding failures, merged
duplicates, implausible class years, and same-name pairs that need a human eye.

## Deploying

Any static host. For Vercel/Netlify: project root `apps/map`, build command
`npm run build`, output directory `dist`. Run the pipeline before building (or
commit `data/alumni.json`, which this repo does) so CI never needs DB access.

Basemap tiles come from [OpenFreeMap](https://openfreemap.org) (free, no API key).
If you ever need a different provider, change `STYLE_URL` in
`src/components/MapView.tsx`.

## Tech choices

- **Vite + React + TypeScript** — fastest path to a polished interactive SPA;
  React keeps the filter/list/map/detail state graph manageable.
- **MapLibre GL** — vector rendering + built-in clustering handles 16k points
  without breaking a sweat; no Leaflet plugin stack needed.
- **Fuse.js** — typo-tolerant name/company search.
- List virtualization, the dual-range year slider, the seasons-together timeline,
  and URL state are hand-rolled to keep the dependency count at four.

## Key UX concepts

- **Cohort lens** (`coh=` URL param): one click on a profile's "Teammates on map"
  filters the entire app — map, list, counts — to that person's circle, while
  your own filters (city, industry, era) stay applied. This is the core flow:
  *know one name → see the whole crew → narrow to the ones near you.*
- **Seasons-together timeline**: each teammate is a row; the solid stretch of
  their bar is the years they shared with the selected person. Sorted by most
  seasons together.
- **Story cards** on the welcome panel seed example filter combinations so a
  first-time user immediately understands what the tool is for.

## Data notes / known limitations

- **One location per person.** The source `location` column mixes hometowns
  (roster scrapes) with current cities (LinkedIn). There is no separate hometown
  field, so the map has a single location view. If hometown is ever added as a
  column, the pipeline is ready to geocode it the same way.
- People with no mappable location still appear in search and the list view —
  the map shows an "N not shown on map" link that lists them.
- Class years 2027–2029 are current students from roster scrapes; they're
  included (useful for "on campus at the same time") and filterable by year.
