# Changelog

This is the template's own changelog — not a downstream project's. Its job is
to document changes here in a way that lets a downstream project (one that
cloned this template, stamped it, and added `template` as a second git
remote per `docs/new-project.md`) merge future template updates safely.

## Convention

- **Every entry states what changed AND what a merge conflict there means.**
  A downstream project merging `template/main` needs to know, per entry,
  whether a conflict is safe to resolve by taking the template's side, the
  downstream's side, or needs a manual look. Write entries with that reader
  in mind, not just "what we did."
- **The template never touches, in a way downstream should blindly accept:**
  - `content/` — sample blog posts are stamp-time scaffolding, not template
    content. If a template update touches `content/blog/`, downstream should
    treat it as a conflict to resolve manually (usually: keep downstream's
    posts, ignore the template's).
  - Brand tokens in `apps/web/src/index.css` — the `--paper`/`--ink`/`--accent`/
    etc. custom-property values are stamp-time branding. A template update
    that changes token _values_ is a conflict downstream should resolve by
    keeping their own values; a template update that adds a _new_ token name
    is safe to take.
  - `TEMPLATE:` marker regions (`AGENTS.md`'s "What this project is" and
    "Projektor tracker" sections) — these are filled in per-project at stamp
    time. A template update inside one of these regions is a conflict
    downstream should resolve by keeping their own filled-in content, unless
    the changelog entry explicitly says otherwise.
  - Any change to the above MUST be called out explicitly in its changelog
    entry, naming the exact effect, so downstream isn't left guessing from a
    diff alone.
- **Deleted-module conflicts resolve "keep deleted."** If a downstream
  project followed a `docs/modules/*.md` removal doc to delete a module
  (e.g. billing), and a later template update touches files that no longer
  exist downstream, the merge conflict (or the update silently reintroducing
  deleted files) should be resolved by keeping the deletion — do not
  resurrect a module a project deliberately removed. This applies to code,
  the module's `docs/modules/*.md` file, and any touch-point edits (routes,
  nav links, env var declarations) the removal doc listed.
- **Everything else** (bug fixes, new modules, tooling/CI changes, dependency
  bumps) is safe to merge normally — call out only genuine exceptions above.

## [Unreleased]

Convention established (this entry); no template-authored feature changes
yet beyond what's already described in `docs/modules/*.md` and `AGENTS.md`.
