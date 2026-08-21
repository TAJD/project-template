---
title: Staying up to date
description: How a project stamped from this template pulls in later template improvements, and which merge conflicts it should never resolve in the template's favour.
sidebar:
  order: 3
---

A project stamped from this template can keep pulling improvements from it. Add the
template as a second remote and merge from it when you want to:

```bash
git remote add template <template-repo-url>
git fetch template
git merge template/main
```

Most of what arrives that way — bug fixes, new modules, tooling and CI changes,
dependency bumps — is safe to take. Four kinds of conflict are not.

## Never take the template's side

**Sample content (`content/blog/`).** The three sample posts are stamp-time
scaffolding, not template content. If an upstream change touches them, keep yours and
ignore the template's.

**Brand tokens in `apps/web/src/index.css`.** The values of `--paper`, `--ink`,
`--accent` and the rest are your branding. A change to a token's _value_ is a conflict
you resolve by keeping your own. A _new_ token name is safe to take. The docs theme in
`apps/docs/src/styles/theme.css` mirrors the same palette, so treat it the same way.

**`TEMPLATE:` marker regions.** These regions — `AGENTS.md`'s "What this project is"
and "Projektor tracker" sections, and the `site`/`base`/`title` block in
`apps/docs/astro.config.mjs` — are filled in per project at stamp time. Keep your own
content unless the changelog entry says otherwise.

**Modules you deleted.** If you followed a module's removal steps, a later template
change may touch files that no longer exist in your repo, or quietly reintroduce them.
Resolve by keeping the deletion. That covers the module's code, its docs page, and
every touch-point the removal steps listed: routes, nav links, env var declarations.

## What the template owes you

Every entry in the template's `CHANGELOG.md` states both what changed and what a
conflict there means — take the template's side, keep yours, or look by hand. Any
change inside one of the four categories above is called out by name in its entry, so
you are never left inferring the answer from a diff.
