# project-template

A pnpm-workspace starter for shipping a React + Vite frontend and a Hono API
on Cloudflare Workers from one repo. It bundles the tooling (lint, format,
typecheck, test, CI) and a set of self-contained, deletable feature modules,
so new projects start from a green, working baseline instead of reassembling
one from scratch.

## Features

- **Account module** — Drizzle/D1 users + sessions, WebCrypto PBKDF2 password
  hashing, HttpOnly cookie sessions, sign-up/sign-in/sign-out, email
  verification + password reset (with a zero-credential dev mailbox standing
  in for a real provider), self-serve account settings, and two-tier test
  auth for automated suites. See `docs/modules/account.md`.
- **Billing module** — Stripe Checkout, customer-portal redirect, webhook
  signature verification + event-dedup + subscription mirror to D1, a
  pricing/upgrade page, a gated sample page (`/members`), and a narrative
  story-test suite covering subscribe/trial/cancel/refund/dispute flows. See
  `docs/modules/billing.md`.
- **Blog module** — an MDX-backed blog with drafts, tags, RSS/Atom feeds, and
  full SEO registration (sitemap, OG image generation, prerendering). See
  `docs/modules/blog.md`.
- **Search** — a Pagefind-powered search dialog over whatever's prerendered
  into `apps/web/dist`, not blog-specific.
- **Feedback module** — a thumbs-up/down + optional comment widget, env-gated
  and POSTs to any HTTP endpoint (e.g. a Projektor feedback source). The
  reference example of a minimal, cleanly-removable module. See
  `docs/modules/feedback.md`.
- **SEO/sitemap registry** — a single-source route registry
  (`apps/web/src/seo.config.ts`) that prerendering, the sitemap, and feeds
  all read from, plus a live SEO audit script (`pnpm seo:live`).
- **CI + hygiene** — GitHub Actions running `pnpm check` on every push,
  Dependabot, Husky + lint-staged pre-commit hooks, and a Cloudflare Workers
  Builds-ready deploy setup.

Every module above documents its own touch-points and exact removal steps in
`docs/modules/*.md` — delete what a given project doesn't need.

## Stack at a glance

See [`AGENTS.md`](./AGENTS.md) for the full stack breakdown, dev commands,
and repo invariants — this README won't duplicate it.

## Quickstart

```bash
pnpm install
pnpm --filter web dev
pnpm check
```

## Stamping a new project

Starting a real project from this template involves renaming manifests,
re-tokening the brand, provisioning Cloudflare resources, and more. Full
checklist: [`docs/new-project.md`](docs/new-project.md).

## Keeping up to date

Projects stamped from this template can pull in future template improvements
by adding it as a second git remote (`git remote add template <this-repo-url>`)
and merging from it periodically. The merge-conflict conventions — what
downstream should never blindly accept from an upstream merge (sample
content, brand tokens, `TEMPLATE:` marker regions) and how to handle
deleted-module conflicts — are documented in [`CHANGELOG.md`](CHANGELOG.md).

## Developing on Windows

Issues specific to Windows (not exercised by this template's Linux CI) are
tracked in [`docs/windows-notes.md`](docs/windows-notes.md).
