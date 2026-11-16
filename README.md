# fitness

Offline-first personal fitness PWA. Slice 1 is an installable shell plus a typed, validated import of an exercise library supplied through private config at build or deploy time. The app does not give medical advice.

## Required CI check

Every pull request must pass the **`ci`** GitHub Actions job (workflow file: `.github/workflows/ci.yml`). It runs, in order:

1. `npm run typecheck` — TypeScript project references
2. `npm run test` — Vitest (library import and normalization)
3. `npm run build` — production bundle and PWA assets

Run the same gate locally:

```bash
npm ci
npm run ci
```

Individual steps: `npm run typecheck`, `npm run test`, `npm run build`, `npm run dev` (local dev server).

## Configuration

Copy the example config and point it at your data:

```bash
cp config.example.json config.json
```

| File | Committed? | Purpose |
|------|------------|---------|
| `config.example.json` | yes | Generic shape and sample paths for CI |
| `config.json` | **no** (gitignored) | Your library path, health conditions, disclaimer contact |
| `data/sample-library.json` | yes | Small invented library for tests and demos |
| `data/private/` | **no** (gitignored) | Real library JSON after `sync-library` |

### Config shape

```json
{
  "libraryPath": "data/sample-library.json",
  "overlayPath": "data/overlay.json",
  "conditions": [
    {
      "id": "concern_a",
      "label": "Concern A",
      "libraryField": "concern_a_risk"
    }
  ],
  "disclaimerContact": "A licensed clinician familiar with your health history"
}
```

- **`conditions`**: each entry maps a configured health concern to a per-exercise field in the library JSON (`libraryField`, typically ending in `_risk` with values `low` | `moderate` | `high`).
- **`libraryPath`**: JSON array of routines. In production, set this to a file under `data/private/`.
- **`disclaimerContact`**: optional string for future UI disclaimers (never hardcoded in source).

Import is **fail-closed**: a missing or unknown risk value for any configured condition is treated as `high`.

## Refresh the private library

The sync script writes only to the gitignored private location (from `config.json`’s `libraryPath`, or `data/private/library.json` if no config exists):

```bash
cp config.example.json config.json
# edit config.json: set libraryPath to data/private/library.json and your conditions
npm run sync-library -- /path/to/your/library.json
```

Do not commit `config.json` or files under `data/private/`.

## Build with a real library

1. Create `config.json` from `config.example.json`.
2. Map each of your conditions to the matching `*_risk` fields in your library export (`libraryField` per condition).
3. Set `libraryPath` to `data/private/library.json` (or another gitignored path).
4. Run `npm run sync-library -- <export.json>` to refresh the private copy.
5. Run `npm run ci` (or wire the same paths into your deploy pipeline via env-specific config).

`npm run build` bundles the PWA; slice 1 still renders a shell while library import is validated in tests. Later slices will load `config.json` at build time.

## Overlay file

`data/overlay.json` is keyed by **stable exercise IDs** (see below). It adds fields the library export may lack: `swap_to`, `max_reps`, `max_hold_s`, `kettlebell`, `location` (`home` | `gym`), and `defaultDose`. `swap_to` must reference an exercise ID that exists in the library after import; unknown IDs fail validation.

## Exercise ID scheme

Each exercise ID is `ex_` plus the first 16 hex characters of SHA-256(`routineId` + `\0` + exact `name`). IDs are stable across machines and runs. Implementation: `src/library/exercise-id.ts`.

## Stack

TypeScript, [Vite](https://vite.dev/), [Vitest](https://vitest.dev/), and `vite-plugin-pwa` for manifest + service worker. Storage is local-only; no backend in v1.