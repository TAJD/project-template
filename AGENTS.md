# AGENTS.md

Canonical instructions for any agent (Claude Code or otherwise) working in this
repository. `CLAUDE.md` just points here — this file is the single source of
truth.

## What this project is

<!-- TEMPLATE: fill in -->

This repo starts as `project-template`: a pnpm-workspace starter bundling a
React/Vite frontend and a Hono API on Cloudflare Workers, with auth, billing,
SEO/blog, search, and feedback modules already wired up. Replace this section
with a description of the actual product once this template is stamped into
a real project.

## Stack at a glance

- pnpm monorepo (`pnpm-workspace.yaml`: `apps/*`, `packages/*`, `tests/*`)
- `apps/web` — Vite 5 + React 19 + react-router 7, TypeScript, Tailwind (semantic tokens only, see below)
- `apps/worker` — Cloudflare Worker, Hono, D1, Drizzle ORM
- `packages/shared` — TypeScript types/utilities shared between web and worker (built to `dist/` and consumed via `workspace:*`)
- `tests/integration` — cross-system story tests that run inside the worker's `vitest-pool-workers` environment (not standalone)

## Dev commands

Read from the actual `package.json` scripts — don't guess at these.

Root (`package.json`):

- `pnpm check` — `format:check && lint && typecheck && test` (the quality gate)
- `pnpm format` / `pnpm format:check` — Prettier
- `pnpm lint` — ESLint across the workspace
- `pnpm typecheck` — `pnpm -r run typecheck`
- `pnpm test` — `pnpm -r run test` plus `node --test scripts/**/*.test.mjs`
- `pnpm build` — `pnpm -r run build`
- `pnpm seo` / `pnpm seo:live` — SEO audit scripts
- `pnpm deploy` — builds the workspace, then `wrangler deploy` from `apps/worker` (needs `pnpm run deploy`, not bare `pnpm deploy` — see Gotchas)

`apps/web`: `pnpm --filter web dev` (Vite dev server), `build`, `preview`, `typecheck`, `test` (Vitest + jsdom)

`apps/worker`: `pnpm --filter @template/worker dev` (`wrangler dev`), `build` (`wrangler deploy --dry-run`), `typecheck`, `test` (Vitest with `@cloudflare/vitest-pool-workers`), `db:generate` (Drizzle Kit)

`packages/shared`: `build`, `typecheck`, `test`

## Invariants

These are enforced by the current code, not aspirational — each was checked
against source before being written down here.

- **`apps/web` and `apps/worker` never import each other at runtime.** The
  only cross-references are code comments pointing between the two (e.g.
  `apps/worker/src/modules/billing/routes.ts:22`, `apps/worker/src/spa-routes.generated.ts:1`) — no live `import` crosses the boundary.
- **`packages/shared` never imports from `apps/web`.** `packages/shared/src/head-tags.ts` mentions `apps/web/scripts/generate-feeds.mjs` only in a comment.
- **Semantic design tokens only — no raw Tailwind colors in components.**
  `apps/web/tailwind.config.ts` replaces Tailwind's entire `colors` palette
  with `paper`, `ink`, `accent`, `muted`, `rule`, `elev`, `win`, `error` (each
  mapped to a `--token` CSS custom property defined in `apps/web/src/index.css`).
  Utilities like `bg-red-500` don't resolve — the palette itself makes raw
  colors unavailable, not just a lint rule.
- **Error contract:** route handlers and the helpers they call return
  `{ error: Response }`; pure logic throws. See `apps/worker/src/lib/errors.ts` —
  callers narrow on `'error' in result` and return it straight to Hono.
- **The SEO/sitemap registry is single-source.** `apps/web/src/seo.config.ts`
  exports a `routes` array and a `registerRoutes()` function that other
  modules push entries into at load time, so there is one list of routes
  that prerendering, the sitemap, and feeds all read from.

## Gotchas

- **`pnpm run ci` vs `pnpm ci`.** This repo has no `ci` script in
  `package.json` — CI (`.github/workflows/check.yml`) runs
  `pnpm install --frozen-lockfile` then `pnpm check` directly. If you're
  tempted to add a `ci` script: `pnpm ci` is already a real pnpm subcommand
  (alias for `clean-install`/`ic`, confirmed via `pnpm ci --help`) with
  npm-`ci`-like semantics. Adding a package.json script named `ci` means
  `pnpm run ci` runs your script but bare `pnpm ci` silently does something
  else entirely — same trap as `pnpm deploy` vs `pnpm run deploy` below.
- **`.husky/pre-commit` uses `#!/usr/bin/env sh`.** On Windows this only runs
  correctly through Git Bash/WSL (Husky's own shim on Windows shells out to
  `sh`); if you invoke git from a shell with no `sh` on `PATH`, the hook can
  silently fail to run `lint-staged`. Verify hooks actually fire after a
  fresh clone on Windows before relying on them.
- **`wrangler dev` port squatting.** `apps/worker`'s `dev` script is a bare
  `wrangler dev` (default port 8787, `wrangler.toml` sets no explicit
  `--port`). Two worktrees/checkouts running `pnpm --filter @template/worker dev`
  at once will collide on 8787 — pass `--port` explicitly if you need
  parallel worker instances.
- **`pnpm deploy` vs `pnpm run deploy`.** Bare `pnpm deploy` resolves to
  pnpm's own built-in deploy command, not this workspace's `deploy` script —
  always use `pnpm run deploy` (documented in `apps/worker/wrangler.toml`).
- **`pnpm.overrides` don't reach peer-dep auto-installs.** The root
  `package.json` has no `pnpm.overrides` block today, so this isn't yet
  active in this repo — but if one gets added later, know going in that
  pnpm's peer-dependency auto-install can pull a version that ignores an
  `overrides` entry for the same package pulled in transitively. Check
  `pnpm why <pkg>` if a version looks wrong after adding overrides.
- **Coverage thresholds start at 0.** `apps/web/vite.config.ts` sets
  `coverage.thresholds` (lines/functions/branches/statements) to `0` as the
  starting baseline — see the ratchet rule below.

### Adding a new gotcha

Found something that cost you real debugging time? Add a bullet here as a
short postmortem: what broke, why, and the one-line fix or workaround. Keep
it to what's actually been hit — don't speculate about problems that haven't
happened.

## Quality gate

Fix the gate, don't defer it. A red `pnpm check` blocks the change that broke
it — no skipping, no `--no-verify`, no "fix in a follow-up."

## Coverage

Coverage thresholds only ratchet up, never down.

## Session-completion checklist

1. `pnpm check` is green.
2. Changes are scoped to what was asked — no unrelated files touched.
3. Commits are small and conventional.
4. `git push`.

## Autonomous execution contract

Decide, don't stall — an autonomous agent session should keep moving on
ambiguity it can resolve from the code and docs already in the repo, rather
than blocking for input. The following are hard stops requiring a human
regardless of confidence:

- Creating or pushing a **public** GitHub repository.
- Creating any **Cloudflare resource** (D1 database, KV namespace, Workers
  Builds connection, secret, etc.).
- Any action that **spends money** (API keys with billing attached, paid
  tiers, Stripe live-mode anything).
- **Licence doubts on ported code** — if you're not sure code you're about
  to add is safe to include under this repo's licence, stop and ask instead
  of guessing.
- **Never merge to `main` unattended.** Open a PR and stop; a human merges.

## Projektor tracker

<!-- TEMPLATE: fill in projectId/key -->

This repo's issues and epics are tracked in Projektor. Fill in the project
key/ID here once this template is stamped into a real project (e.g.
`PROJ-123` style refs, workspace URL).
