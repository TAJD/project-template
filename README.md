# project-template

A pnpm-workspace starter for shipping a React + Vite frontend and a Hono API on Cloudflare Workers from one repo. It bundles the tooling (lint, format, typecheck, test, CI) so new projects start from a green baseline instead of reassembling it each time.

## Quickstart

```bash
pnpm install
pnpm --filter web dev
pnpm check
```

## Keeping up to date

Projects created from this template can pull in future template improvements by adding it as a second remote (e.g. `git remote add template <this-repo-url>`) and merging from it periodically. Full detail on this workflow lands in a later ticket.

See [`docs/new-project.md`](docs/new-project.md) for the checklist to run through when starting a new project from this template.
