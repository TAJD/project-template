---
name: web-design-guidelines
description: Use when adding or editing a page/component in apps/web — covers the semantic design-token system, existing component patterns, and mobile-first checks so new UI matches the rest of the app instead of introducing a one-off style.
---

# Web design guidelines

This project's UI (`apps/web`) is built on a small set of semantic design
tokens, plain Tailwind utility classes for layout, and a handful of shared
components in `apps/web/src/components/`. The goal of any new page or
component is to look like it was always there — reuse tokens and existing
patterns rather than inventing new ones.

## The token system (non-negotiable)

`apps/web/src/index.css` defines eight CSS custom properties, each with a
light value on `:root` and a dark override under
`@media (prefers-color-scheme: dark)` / `:root[data-theme='dark']`:

| Token      | Use for                                            |
| ---------- | -------------------------------------------------- |
| `--paper`  | page/surface background                            |
| `--ink`    | primary text                                       |
| `--accent` | links, primary actions, focus rings, active states |
| `--muted`  | secondary text                                     |
| `--rule`   | borders, dividers                                  |
| `--elev`   | raised surfaces (cards, secondary buttons)         |
| `--win`    | success/positive state                             |
| `--error`  | error/destructive state                            |

`apps/web/tailwind.config.ts` replaces Tailwind's entire `colors` palette
with these eight names mapped to the CSS variables — `bg-paper`, `text-ink`,
`border-rule`, `bg-accent`, `text-muted`, `bg-elev`, `text-win`,
`text-error`, etc. **Raw Tailwind colors don't exist in this config** —
`bg-red-500` or `text-blue-600` won't resolve to anything, because the
`colors` key is replaced, not extended. If you need a color, it's one of
these eight or it isn't the right color.

Do not reach for an inline hex value or a new CSS custom property for a
one-off. If none of the eight tokens fit, that's a signal to either reuse
`--muted`/`--elev` for a subdued case or raise it as a real design decision
(new token, added deliberately to `index.css` and `tailwind.config.ts`
together) rather than a local workaround.

## Component patterns to follow

Look at `apps/web/src/components/` before writing a new primitive — most
needs (button, card, input, nav) are already covered:

- **`Button.tsx`** — variant map (`primary` / `secondary`) keyed to token
  classes, spreads `ButtonHTMLAttributes`, always includes
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`
  and a `disabled:` state. New interactive elements should carry the same
  focus-visible treatment — it's the accessible-focus-ring convention for
  the whole app, not just buttons.
- **`Card.tsx`** — thin wrapper (`rounded-lg border border-rule bg-elev p-4 text-ink`)
  over a `div`, spreads `HTMLAttributes`. Prefer composing this over
  hand-rolling a bordered box.
- **`Input.tsx`** — pairs a `<label>` with the field, derives `id` from
  `name` when not given, so labels stay associated without every call site
  wiring it up manually.
- All of the above accept `className` and merge it onto their own classes
  (`` `...base-classes... ${className}`.trim() ``) — extend an existing
  component with `className` rather than reimplementing it.

## Mobile-first checks

The app is mobile-first: `Layout.tsx` renders a `BottomTabBar` (fixed,
`md:hidden`) for small screens and a horizontal nav (`hidden md:flex`) for
`md:` and up. When adding a page:

- Design for the small viewport first; add `md:` (and up) utilities to
  layer on wider-screen layout, not the reverse.
- If your page/layout adds fixed bottom or top chrome, account for
  `BottomTabBar`'s height (`main` already carries `pb-20 md:pb-6` for this)
  and for `env(safe-area-inset-bottom)` on notched devices (see
  `BottomTabBar.tsx`).
- Every interactive element needs a visible, keyboard-reachable focus state
  — don't remove the `focus-visible:outline-accent` pattern above.
- Check both themes: toggle `data-theme` (the `Layout.tsx` theme toggle, or
  `prefers-color-scheme` in devtools) and confirm text stays readable
  against `--paper`/`--elev` in both.
- Use semantic HTML and `aria-label` on icon-only or ambiguous nav regions
  (see `aria-label="Primary"` on `BottomTabBar`, `aria-label="Main"` on the
  header nav) — `eslint-plugin-jsx-a11y` is wired into `eslint.config.mjs`
  and will flag obvious a11y gaps, but it doesn't catch everything.

## Before opening a PR

1. Does every color come from one of the eight tokens (no raw hex, no
   arbitrary Tailwind color utility)?
2. Did you reuse `Button`/`Card`/`Input` instead of rebuilding them?
3. Does the layout work at a narrow (mobile) width first, then adapt with
   `md:`?
4. Does the new UI look correct in both light and dark (`data-theme`)?
5. Can you reach and see the focus state on every interactive element with
   keyboard-only navigation?
