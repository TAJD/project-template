---
title: New project checklist
description: The steps that turn this template into a real project — renaming, re-tokening, provisioning Cloudflare, and deleting the modules you do not need.
sidebar:
  order: 2
---

Work through these in order — later steps assume earlier ones are done.

1. **Use the GitHub template.** On GitHub, "Use this template" → create a new
   repository. Clone it locally.

2. **Rename the project.**
   - `package.json` (root) — `"name"` field (currently `project-template`).
   - `apps/web/package.json` — `"name"` field (currently `web`). If you
     change it, also update every `pnpm --filter web ...` reference
     (`AGENTS.md`, `README.md`) to the new name.
   - `apps/worker/package.json` — `"name"` field (currently `@template/worker`).
     If you change this, also update every `@template/worker` reference (e.g.
     the root `deploy` script: `pnpm --filter @template/worker exec wrangler
deploy`) and `apps/worker/wrangler.toml`'s `name = "worker"`.
   - `packages/shared/package.json` — `"name"` field (currently
     `@template/shared`), and every `workspace:*` dependency on it in
     `apps/web/package.json`, `apps/worker/package.json`, and the root
     `package.json`.
   - `apps/web/src/seo.config.ts` — update the `/` route's `title` and
     `description` (currently `Exemplar` / "A production-ready starting point
     for new products."), plus every other route's copy as it becomes real.

3. **Re-token the brand.** Edit only `apps/web/src/index.css` — that's where
   every semantic design token lives (`--paper`, `--ink`, `--accent`,
   `--muted`, `--rule`, `--elev`, `--win`, `--error`, in both the light
   `:root` block and the dark-mode overrides). Don't add raw Tailwind colors
   elsewhere — `apps/web/tailwind.config.ts` replaces Tailwind's palette
   entirely, so only these tokens resolve. Swap the font import too if the
   project isn't using Inter. The docs site mirrors the same palette in
   `apps/docs/src/styles/theme.css`; update it to match.

4. **Replace `content/blog/`.** Delete the three sample posts
   (`getting-started-with-the-template.mdx`,
   `structured-data-without-the-headache.mdx`,
   `a-draft-post-in-progress.mdx`) and add real posts, or remove the blog
   module entirely per the [blog module page](../../modules/blog/) if the
   project doesn't need one.

5. **Create Cloudflare resources and set secrets.**
   - `wrangler d1 create <db-name>` — paste the returned `database_id` into
     `apps/worker/wrangler.toml`'s `[[d1_databases]]` block (replacing the
     `00000000-...` placeholder), then run
     `wrangler d1 migrations apply DB --local` (and `--remote` once deployed).
   - Create the KV/rate-limit bindings your modules need. The template ships
     one: `AUTH_RATE_LIMITER` (`[[unsafe.bindings]]`, native Workers Rate
     Limiting, no separate provisioning step — it's created on first deploy).
   - Copy `apps/worker/.dev.vars.example` to `apps/worker/.dev.vars` and fill
     in local values (gitignored, never commit real secrets).
   - Push real secrets to the deployed Worker with `scripts/push-secrets.ps1`
     (see that script's header for the exact list — currently
     `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
     optionally `TEST_LOGIN_SECRET` if the deployment runs smoke tests).
     `TEST_AUTH_TOKEN` is intentionally never pushed as a secret — see the
     [account module page](../../modules/account/).
   - Set the `STRIPE_PRICE_ID` var in `apps/worker/wrangler.toml` if the
     billing module is staying.

6. **Create a Projektor project.** Use the `mcp__projektor__create_project`
   tool (or the web UI) to create a project for this repo. Record the
   project key/ID in `AGENTS.md`'s `<!-- TEMPLATE: fill in projectId/key -->`
   marker under "Projektor tracker".

7. **Create a Projektor feedback source** for the feedback widget module (if
   keeping it) — `mcp__projektor__create_feedback_source`. Put the returned
   endpoint URL and token in `apps/web/.env` as `VITE_FEEDBACK_ENDPOINT` /
   `VITE_FEEDBACK_TOKEN` (see the
   [feedback module page](../../modules/feedback/)).

8. **Point the docs site at your repo — or delete it.** `apps/docs` is this
   site. To keep it:
   - Edit the `TEMPLATE:` marker region at the top of
     `apps/docs/astro.config.mjs` — `SITE`, `BASE`, `TITLE`, `DESCRIPTION`.
     For a project Pages site at `https://<user>.github.io/<repo>/`, `BASE` is
     `/<repo>`; for a user site or a custom domain it is `/`.
   - Match the same values in the `TEMPLATE:` region of
     `apps/docs/scripts/gen-llms-txt.mjs`.
   - Fix the base-prefixed links in
     `apps/docs/src/content/docs/index.mdx` — the only file that hard-codes
     `/project-template/`.
   - **Enable Pages by hand:** repo Settings → Pages → Source → "GitHub
     Actions". The `.github/workflows/docs.yml` workflow fails until someone
     does this; no workflow can do it for you.
   - Delete this template's own pages (`start/`, `modules/`, `architecture/`)
     and write your own.

   To drop the site instead: delete `apps/docs` and
   `.github/workflows/docs.yml`.

   A stamped project also inherits two Claude Code plugins from
   `.claude/settings.json` — `economist-style` for editing docs prose and
   `diagram-design` for architecture diagrams. Drop either by removing its
   entry from `enabledPlugins` (and `extraKnownMarketplaces`) in that file.

9. **Turn on dependency updates.** `.github/dependabot.yml` and
   `.github/workflows/dependabot-auto-merge.yml` come with the template, but
   the two repo settings that make auto-merge safe do not — GitHub does not
   copy settings into a repo made from a template. Set both:
   - Settings → General → **Allow auto-merge**.
   - A branch protection rule or ruleset on `main` **requiring the `check`
     status check**. This is the gate: without it there is nothing for
     auto-merge to wait on, and Dependabot PRs merge with CI unread.

   To opt out entirely, delete both files.

10. **Add the template as a remote** so future template improvements can be
    pulled in: `git remote add template <this-template-repo-url>`. The
    merge-conflict conventions to follow are on the
    [staying up to date](../updating/) page.

**Renormalize line endings once**, now that the template ships a
`.gitattributes`: `git add --renormalize .` and commit the result. A repo
generated before `.gitattributes` landed may already have inconsistent
line endings committed (e.g. a CRLF file edited by a Windows text-mode
writer); this brings them in line without changing any content.

11. **Delete unwanted modules.** For each module you don't need, follow the
    "Removal steps" on its page —
    [account](../../modules/account/), [billing](../../modules/billing/),
    [blog](../../modules/blog/), [feedback](../../modules/feedback/),
    [R2 proxy](../../modules/r2-proxy/) — and run `pnpm check` after each
    deletion.

12. **Deploy.** `pnpm run deploy` from the repo root (builds the workspace,
    then `wrangler deploy` from `apps/worker`), or connect a Cloudflare
    Workers Builds GitHub integration for deploy-on-push to `main` (dashboard
    setup, not scripted here).
