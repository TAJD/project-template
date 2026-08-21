# New project checklist

Steps to stamp this template into a real project. Work through them in order —
later steps assume earlier ones are done.

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
   project isn't using Inter.

4. **Replace `content/blog/`.** Delete the three sample posts
   (`getting-started-with-the-template.mdx`,
   `structured-data-without-the-headache.mdx`,
   `a-draft-post-in-progress.mdx`) and add real posts, or remove the blog
   module entirely per `docs/modules/blog.md` if the project doesn't need one.

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
     `TEST_AUTH_TOKEN` is intentionally never pushed as a secret — see
     `docs/modules/account.md`.
   - Set the `STRIPE_PRICE_ID` var in `apps/worker/wrangler.toml` if the
     billing module is staying.

6. **Create a Projektor project.** Use the `mcp__projektor__create_project`
   tool (or the web UI) to create a project for this repo. Record the
   project key/ID in `AGENTS.md`'s `<!-- TEMPLATE: fill in projectId/key -->`
   marker under "Projektor tracker".

7. **Create a Projektor feedback source** for the feedback widget module (if
   keeping it) — `mcp__projektor__create_feedback_source`. Put the returned
   endpoint URL and token in `apps/web/.env` as `VITE_FEEDBACK_ENDPOINT` /
   `VITE_FEEDBACK_TOKEN` (see `docs/modules/feedback.md`).

8. **Add the template as a remote** so future template improvements can be
   pulled in: `git remote add template <this-template-repo-url>`. See
   `CHANGELOG.md` for the merge-conflict conventions to follow when you do.

   **Renormalize line endings once**, now that the template ships a
   `.gitattributes`: `git add --renormalize .` and commit the result. A repo
   generated before `.gitattributes` landed may already have inconsistent
   line endings committed (e.g. a CRLF file edited by a Windows text-mode
   writer); this brings them in line without changing any content.

9. **Delete unwanted modules.** For each module you don't need, follow the
   "Removal steps" in its `docs/modules/*.md` file (`account.md`,
   `billing.md`, `blog.md`, `feedback.md`) and run `pnpm check` after each
   deletion.

10. **Deploy.** `pnpm run deploy` from the repo root (builds the workspace,
    then `wrangler deploy` from `apps/worker`), or connect a Cloudflare
    Workers Builds GitHub integration for deploy-on-push to `main` (dashboard
    setup, not scripted here).
