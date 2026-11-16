# fitness

Private personal fitness PWA for Sebas. Slice 1 is an installable offline shell plus a typed, validated import of the read-only Leeds exercise library snapshot. The app does not give medical advice.

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

## Refresh the library snapshot

The canonical seed file lives in Leeds’s repo as `index.json`. This project keeps a **read-only copy** at `data/snapshot/index.json`. Do not hand-edit that file.

Copy a fresh export over the snapshot:

```bash
npm run sync-library -- /path/to/index.json
```

Commit the updated snapshot in its own PR when Leeds publishes changes.

## Overlay file

`data/overlay.json` is keyed by **stable exercise IDs** (see below). It adds fields the snapshot lacks: `swap_to`, `max_reps`, `max_hold_s`, `kettlebell`, `location` (`home` | `gym`), and `defaultDose`. `swap_to` must reference an exercise ID that exists in the snapshot after import; unknown IDs fail validation.

## Exercise ID scheme

Each exercise ID is `ex_` plus the first 16 hex characters of SHA-256(`routineId` + `\0` + exact `name`). IDs are stable across machines and runs. Implementation: `src/library/exercise-id.ts`.

## Stack

TypeScript, [Vite](https://vite.dev/), [Vitest](https://vitest.dev/), and `vite-plugin-pwa` for manifest + service worker. Storage is local-only; no backend in v1.