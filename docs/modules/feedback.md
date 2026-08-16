# Feedback module

The smallest module in the template — the demo case for a minimal, cleanly-removable
module. A thumbs-up/thumbs-down + optional comment control that POSTs to a
configurable HTTP endpoint (a projektor feedback source, or anything else that
accepts the payload below). Env-gated: with either env var unset it renders nothing,
so a fresh stamp of the template builds and tests clean with no live endpoint
configured.

## Touch-points

- **`apps/web/src/modules/billing/GatedSamplePage.tsx`** — one `<FeedbackWidget />`
  mount in the premium-content state.
- **`apps/web/src/modules/blog/BlogPostPage.tsx`** — one `<FeedbackWidget />` mount in
  the post footer (applies to every post, since it's the shared template).
- **`apps/web/.env.example`** — documents `VITE_FEEDBACK_ENDPOINT` and
  `VITE_FEEDBACK_TOKEN`.
- **`apps/web/src/vite-env.d.ts`** — types the two `VITE_*` vars on `ImportMetaEnv`.
- **`apps/web/src/modules/feedback/`** — all module code (client, component).

## Removal steps

1. In `apps/web/src/modules/billing/GatedSamplePage.tsx`, remove the `FeedbackWidget`
   import and its `<FeedbackWidget />` mount.
2. In `apps/web/src/modules/blog/BlogPostPage.tsx`, remove the `FeedbackWidget` import
   and the `<footer>` block that mounts it.
3. Delete `apps/web/src/modules/feedback/`.
4. Remove the `VITE_FEEDBACK_ENDPOINT`/`VITE_FEEDBACK_TOKEN` entries from
   `apps/web/.env.example`, and the `ImportMetaEnv` additions from
   `apps/web/src/vite-env.d.ts`.
5. Run `pnpm check` to confirm the rest of the suite is still green with the module
   gone.

## Environment variables

Both are read via `import.meta.env` (Vite's standard client-env convention), so they
must be prefixed `VITE_` and are set in `apps/web/.env` (gitignored; copy from
`.env.example`) or the deploy environment.

- `VITE_FEEDBACK_ENDPOINT` — full URL the widget POSTs to. Unset (or empty) disables
  the widget entirely — it renders `null`.
- `VITE_FEEDBACK_TOKEN` — sent as `Authorization: Bearer <token>` when set. **This is
  public by design, not a secret.** Vite bakes every `VITE_*` variable into the
  client bundle at build time, so anyone can read it from the shipped JS. Treat it as
  a lightweight anti-spam token (e.g. to scope a projektor feedback source), never as
  an access-control credential — don't reuse a real secret here.

## Payload shape

```ts
{
  rating: 'up' | 'down' | null; // null in comment-only mode, or if neither thumb was picked
  comment?: string;             // omitted when the comment box was left empty
  page: string;                 // the pathname the widget was mounted on
}
```

## Usage

```tsx
import { FeedbackWidget } from '../feedback/FeedbackWidget';

<FeedbackWidget />                    // thumbs + comment (default)
<FeedbackWidget mode="comment-only" /> // comment box only, no thumbs
```
