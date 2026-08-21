---
title: Quickstart
description: Clone, install, run the dev server, and prove the quality gate is green before you change anything.
sidebar:
  order: 1
---

Node 22.18 or later, and pnpm 10. Then:

```bash
pnpm install
pnpm --filter web dev
pnpm check
```

`pnpm check` is the gate: `format:check`, `lint`, `typecheck` and `test`, in that
order. It should be green on a fresh clone. If it is not, fix that before writing any
code — a red gate blocks the change that broke it.

## The commands worth knowing

Run these from the repo root.

| Command                              | What it does                                       |
| ------------------------------------ | -------------------------------------------------- |
| `pnpm check`                         | The quality gate: format, lint, typecheck, test    |
| `pnpm build`                         | `pnpm -r run build` across every workspace package |
| `pnpm format`                        | Prettier, writing in place                         |
| `pnpm --filter web dev`              | Vite dev server for the frontend                   |
| `pnpm --filter @template/worker dev` | `wrangler dev` for the API                         |
| `pnpm --filter @template/docs dev`   | This documentation site                            |
| `pnpm seo` / `pnpm seo:live`         | SEO audit, against the build or a live URL         |
| `pnpm run deploy`                    | Build, then `wrangler deploy` from `apps/worker`   |

Two traps in that list. `pnpm deploy` without `run` calls pnpm's own built-in deploy
command, not the script above. And `pnpm --filter <name>` exits 0 when the filter
matches nothing, so a stale package name fails silently rather than loudly.

## What you get

The repo starts with five modules already wired up: account, billing, blog, search and
feedback. Each documents its own touch-points and its exact removal steps, so a project
that does not need billing deletes it in a few minutes rather than working around it.

Once the gate is green, the [new project checklist](../new-project/) covers renaming,
re-tokening the brand, and provisioning Cloudflare.
