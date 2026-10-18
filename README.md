# Pixelar

A personal games, movies, and TV backlog with status shelves, a release calendar, reminders, provider search, and a reviewed notes import. Built with Next.js App Router, React 19, TypeScript 7, Node 26, Yarn Classic, CSS Modules/global design tokens, Biome, and Vitest.

## Run locally

```sh
nvm use
yarn install --frozen-lockfile
yarn dev --port 3002
```

Copy `.env.example` to `.env.local` only if the ignored file is missing. Keep its existing Caelum project URL, server secret key, and Pixelar app passcode. Never print, commit, or expose these values in browser code.

## Apply the updated library schema

The original account-only SQL is no longer sufficient for the tracker. In the existing **Caelum Supabase project**, open SQL Editor, create or reopen the `pixelar` query, replace its contents with **all of `supabase/schema.sql`**, and Run. Naming the editor query does not create a database schema; Pixelar tables live under `public`.

The script runs as a transaction and can be reapplied. It retains Pixelar accounts, creates the new library tables/functions and the private `pixelar_avatars` bucket, and leaves Caelum objects and data intact. Review and explicitly authorize live database application; local tests never connect to the shared project. No SQL administration key is required in the app.

Tables: `pixelar_members`, `pixelar_member_credentials`, `pixelar_profiles`, `pixelar_item_statuses`, `pixelar_items`, `pixelar_metadata_cache`, `pixelar_reminders`, and `pixelar_notifications`. New functions are `pixelar_save_item`, `pixelar_update_profile`, and `pixelar_process_releases`.

Pixelar uses custom salted-password accounts and signed HTTP-only `pixelar_unlock`/`pixelar_who` cookies, not Supabase Auth. Register a separate Pixelar account even if you already have a Caelum account. RLS is enabled and browser roles are denied. Service-role operations bypass RLS: every account-owned server query must filter by the verified member ID. Composite foreign keys also enforce item/reminder ownership. The shared metadata cache contains only public provider data.

## Add metadata API credentials

Manual adding, editing, and unmatched imports work without provider keys. Add the following to ignored `.env.local`, restart development, and set the same values in the hosting environment before deploying:

| Variable | Get it from | Used for |
| --- | --- | --- |
| `RAWG_API_KEY` | https://rawg.io/apidocs | Game search, artwork, publishers, platforms, release dates, Metacritic |
| `TMDB_API_KEY` | https://www.themoviedb.org/settings/api | Movie/show search, posters, details, release dates, regional streaming suggestions |
| `OMDB_API_KEY` | https://www.omdbapi.com/apikey.aspx | Optional screen Metascores, using TMDB's IMDb ID |

Use the TMDB API key, rather than its read access token, for this variable. Providers may lack scores or release dates. OMDb failure leaves the score blank; RAWG/TMDB failures show a retry/manual-add state. Keys only reach provider requests from server code. API errors never return request URLs containing credentials.

Public metadata is cached in Supabase and reused for 24 hours when adding or linking. Browsing does not refetch providers. **Refresh metadata** explicitly fetches again; user overrides, including intentionally cleared fields, remain. **Use fetched value** removes a particular override. API-suggested services require confirmation and use the Profile region (GB by default). Owned platforms/subscriptions prefill matching defaults.

RAWG personal-use terms require attribution/backlinks. TMDB requires attribution and its approved logo; `public/tmdb.svg` is the approved logo from https://www.themoviedb.org/about/logos-attribution. Source links and the TMDB non-endorsement statement appear in the library. Check current provider terms/quotas when configuring credentials. No automatic price provider is enabled; `PriceProvider` is the extension interface and each entered price retains its currency.

## Library and import

- Games default to status shelves, with a filterable grid; Screen groups by services or status. Multiple service tags can display a title on several shelves.
- Change a status through its picker, or drag the handle between shelves. Touch handles are supported; keyboard dragging uses Space to pick up/drop and arrow keys to jump between shelves. The picker is always available.
- Whole TV shows are tracked. Dates can be unknown, year, month, or exact day. Loose windows show in upcoming lists but never trigger reminders or automatic movement.
- Quick-add saves just a title; link it later through search. All fetched fields can be overridden.
- Notes import recognises inline movie services, TV service headings, Anticipated Game Titles, Scheduled Release Calendar, Playing now, and Out/Re prefixes. Outlook footers are ignored. Date prefixes retain a hint without guessing a year; a confirmed API result supplies the date/year. No match is chosen automatically. Duplicate rows are skipped initially. Nothing saves before review; successful rows are removed so partial failures can be retried. Use matched title explicitly replaces misspellings after you choose a result.

## Release processing when opening the app

Opening Games, TV, or Calendar calls the service-role-only `pixelar_process_releases` transaction for the signed-in member. There is no scheduled background job. Release changes and reminders appear the next time you load one of these pages; they do not run while the app is closed.

- On page load after release-day midnight in the owner's timezone, Scheduled games become Backlog and Upcoming movies/shows become Watchlist, unless auto-move is disabled for the item.
- Reminders become due at 09:00 local time and deliver on the next page load. New titles get release-day reminders by default; Profile can disable this default or all in-app delivery.
- Item locks and unique delivery keys make concurrent page loads safe. Changing a release date reschedules pending reminders; unknown/partial dates suspend them. Missed release-day alerts catch up once. Stale advance alerts are skipped on or after release day.

## Deployment

Deploy changes through your normal push workflow. Configure the hosting dashboard to use Node 26, Yarn Classic, `yarn build`, and the `.next` build output. Keep the existing server environment values configured there. The repository contains no Netlify functions, scheduled jobs, or Netlify configuration file.

## Profile and appearance

Defaults are GB / GBP / Europe/London, dark appearance with light mode available in Profile, and 09:00 reminders. Email changes require the current password and normalized-email uniqueness; there is no verification-email service yet. Tap the profile picture to choose a replacement; it saves immediately through a separate server action. As in Fitnessjourni, the browser shrinks pictures to a 512px maximum edge before upload, with an original-file fallback. The server still validates JPEG/PNG/WebP bytes, caps size/pixels, strips metadata, and stores a WebP of at most 512px (preserving aspect ratio) at one replaceable `member-id/profile.webp` path in the private Pixelar bucket. Existing avatar paths continue to work; the first successful replacement removes the old object. Downloads derive the path from the signed-in profile, never a client-supplied owner.

The interface uses PlayStation-inspired navy surfaces, blue controls, and artwork-led game shelves. Older Follow device preferences use the new dark default; choosing Light in Profile keeps an explicit light preference. No live data migration is required for the appearance change. Colour, spacing, radius, and status tokens live in `styles/globals.css`. Reduced motion disables animations. Runtime additions: `@dnd-kit/core` for accessible drag interactions and `sharp` for image processing. Test-only PGlite runs the actual SQL migration in isolated PostgreSQL/WASM.

## Checks

```sh
yarn test
yarn typecheck
yarn lint
yarn build
```

Tests mock database/providers or run SQL in an isolated PGlite database. They never create live accounts. SQL tests cover repeat migration, non-Pixelar isolation, browser-role denial, ownership, atomic saves, release boundaries, DST, missed/concurrent runs, opt-outs, and date changes. Application tests cover parsing, metadata overrides, provider failure, owner filtering, email/password checks, and avatar validation.

`types/database.ts` describes the SQL schema and types the server client. Keep it aligned with migration changes; the SQL suite verifies migration behavior. Review deployment and live schema application separately from local checks.

## Source and license

Account/session implementation and auth form components were adapted from Caelum and retain its AGPL-3.0-only license; see `LICENSE`. Caelum's astrology engine, data, artwork, and product pages are not included.

## Install Pixelar

Pixelar follows Caelum's install setup: a standalone web manifest, 192/512px regular and maskable icons, a browser favicon, an Apple home-screen icon, and an install button in the desktop sidebar or mobile footer. Signed-out pages use the footer. Supported browsers show the button when their native installation prompt is available. On iPhone/iPad it opens Safari's Share → Add to Home Screen instructions; installed standalone windows hide the button.

The service worker provides a small offline message when navigation fails. It does not cache account pages, library data, or profile pictures. Install support requires HTTPS in production (localhost works for development).
