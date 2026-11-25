# Next Up: Lance take-home

Mobile-first web app: a housekeeper's "which room now" screen, plus a 2-tap problem
report that routes to maintenance. SPEC.md is the source of truth. If code and spec
disagree, stop and ask me; don't pick one.

## Commands
- `npm run check`: build, then domain unit tests, then Playwright on the built app.
  This is the definition of done for every change. Quote its summary line.
- `npm run dev`: Vite on :5173, for poking around only.
- Screenshots: `shot(page, name)` from e2e/helpers.ts (CSS scale). Open only the shots I name.

## Gotchas
- Tailwind v4 is CSS-first: `@import "tailwindcss"` in src/index.css. No tailwind.config.js.
  Write class names out in full in lookup objects ({dirty: 'bg-red-100 text-red-900', ...});
  never build them from strings, because v4's scanner won't see them.
- Use `active:` for tap feedback; `hover:` doesn't fire on touch.
- `min-h-dvh`, `touch-manipulation` on buttons, and safe-area padding on the bottom bar.
- Import describe/it/expect from 'vitest' explicitly. `tsc -b` type-checks tests, so globals
  break the deploy.
- Playwright uses `devices['iPhone 13']` unmodified (390x664, WebKit, touch). Use `.tap()`.
  Every e2e test calls `trackErrors` and `assertPhoneRules`.

## Conventions
- src/domain/ is pure TypeScript: no React, no Date.now(), no localStorage. Business
  rules take `now` in demo minutes.
- All writes go through `reduce`. It never mutates and never creates ids or times; the UI
  passes `id` and `at` in the action. A rejected action returns the same state object.
- One `useReducer`. If saving across reloads gets built (it may be stretch), use the
  localStorage key `lance-nextup:v1` and bump it when types.ts changes.
  No router, no UI kit, no state library. Ask before adding any dependency.
- Vitest covers src/domain only. The UI is checked by Playwright.
- Tests come from SPEC.md's acceptance criteria. Every criterion gets its test, even when
  the code is small. If a test looks wrong, tell me; don't edit it.
- Copy uses Lance's four words: dirty / in progress / clean / inspected. Never "ready".
- Commit after each green `npm run check`. The message names the slice and its ACs.
