# Pixelar

Use Node 26 and Yarn Classic. Run `yarn test`, `yarn typecheck`, `yarn lint`, and `yarn build` for meaningful code changes. Run locally on port 3002 to coexist with Caelum.

## Shared Supabase project

Pixelar uses the existing Caelum Supabase project, with the required environment values in ignored `.env.local`. Keep secrets out of output, commits, and client bundles.

Pixelar owns `public.pixelar_members`, `public.pixelar_member_credentials`, and `public.create_pixelar_account`. Prefix new Pixelar database objects and storage buckets with `pixelar_`. Reference `pixelar_members` for account foreign keys. Keep Caelum's existing objects and data intact; sharing the project does not mean sharing accounts.

Authentication matches Caelum's custom login, with `pixelar_unlock` and `pixelar_who` cookies and Pixelar-specific signature payloads. The privileged Supabase client stays server-only. RLS is enabled and public browser roles are denied, but service-role queries bypass RLS: derive every owner ID from the verified server session and filter user-owned queries by that ID.

`supabase/schema.sql` is the additive setup migration. Apply it to the shared project only as authorized; tests mock database access and must not create live accounts or modify Caelum data.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
