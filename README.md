# Pixelar

A personal library for games, films, and TV: track a backlog, organise shelves, and keep up with upcoming releases. Designed to combine provider metadata with personal notes and edits without losing either.

## Tech stack

Next.js 16 · React 19 · TypeScript · Supabase/PostgreSQL · CSS Modules · Vitest · PGlite · Biome

## What it does

- Organises titles by status or service, with search, filters, and reorderable shelves.
- Imports lists of notes, with automatic matching and review of uncertain results.
- Tracks release dates, reminders, custom covers, and regional streaming options.

## Engineering decisions

- **Provider boundaries.** [Provider adapters](lib/providers) keep API credentials on the server. Cached metadata remains available during failures, and refreshes preserve user overrides.
- **Imports users can review.** [Parsing](lib/import.ts) and [matching](lib/import-matching.ts) distinguish clear matches from ambiguous titles. Nothing saves before confirmation; partial failures can be retried.
- **Atomic persistence.** [PostgreSQL functions and ownership constraints](supabase/schema.sql) keep item/reminder updates consistent. Release processing uses locks and unique delivery keys to tolerate concurrent requests.
- **Tests at the database boundary.** [PGlite tests](supabase/schema.test.ts) run the actual SQL and check repeatable migrations, account isolation, daylight-saving boundaries, and duplicate delivery.

Reminders are processed when the app is opened; there is no background scheduler.

## Run locally

Use Node 26 and Yarn Classic. Follow the [database and environment setup](docs/DEVELOPMENT.md#apply-the-updated-library-schema). RAWG and TMDB keys enable provider search; manual entries work without them. OMDb is optional.

```sh
nvm use
yarn install --frozen-lockfile
yarn dev --port 3002
```

## Checks

```sh
yarn test
yarn typecheck
yarn lint
yarn build
```

Tests use doubles or isolated PGlite databases and do not modify live accounts.

## Documentation and license

[Development guide](docs/DEVELOPMENT.md) — setup, providers, imports, release processing, media handling, and installation.

Licensed under [AGPL-3.0-only](LICENSE). Account and session code adapted from Caelum retains its licence.
