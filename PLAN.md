# Build plan: Next Up (3 core slices + stretch)

## Context
The spec is committed (`ecc4680`): 12 core acceptance criteria (AC) and 3 stretch. The scaffold is only an empty `App.tsx`, the e2e helpers (`shot`, `trackErrors`, `assertPhoneRules` in `e2e/helpers.ts`) and a smoke test.
Each slice ends with `npm run check` passing, then /prove-it (one "Verified:" line), then a commit naming the slice and its ACs.

Scaffold facts that shape the plan:
- `tsconfig.app.json` includes `src`, uses `verbatimModuleSyntax` (so `import type`) and `erasableSyntaxOnly` (no enums).
- `main.tsx` uses StrictMode, which runs the reducer twice in dev, so `reduce` must be pure (the spec already requires it).
- `index.html` has no `viewport-fit=cover`, so `env(safe-area-inset-bottom)` would always be 0. Slice 2 adds it.
- `assertPhoneRules` fails on any button under 48px, including disabled buttons and row buttons.

---

## Slice 1: domain + unit tests (~35 min)
**Files (all new):**
- `src/domain/types.ts`: copied from SPEC.md.
- `src/domain/seed.ts`: `NOW = 615`, the seed table, and Priya's 204 Light task with a small fixed `createdAt`.
- `src/domain/rules.ts`:
  - `fmt(min)`: 12-hour time with am/pm.
  - `mayaBoard(state, now)`: returns `{ next, rows, greyed, done }`, each row with its tier and reason string.
  - `isOnHold(tasks, roomId)`.
  - `samQueue(state)`.
- `src/domain/reduce.ts`: `reduce(state, action)`. Rejects by returning the same object; sets or clears `before`; appends to the log. Stretch actions are rejected for now.
- `src/domain/rules.test.ts`, `src/domain/reduce.test.ts`: import from `'vitest'` explicitly.

**ACs:** 1, 2 (orders and the 2-hour boundary, plus the "Guest waiting" reason), 5 (rejections), 8 (hold), 9 (undo restores rooms, tasks and pick), 10 (Sam's order).

**Most likely to go wrong:**
- Rejected actions that aren't really rejected. A rejection written as `{...state}` breaks the same-object rule without anyone noticing. Every rejection test uses `toBe(state)` and checks the log length.
- `before` not cleared by every other accepted action (fix, dismiss, switchUser, pick). If it isn't, the toast in slice 2 shows a dead Undo. One test loops over all of them.
- `fmt` edge cases: 720 → "12:00 pm", 0 → "12:00 am".
- Greyed boundaries: DND or late checkout greys only when the end time is later than now, which is the difference between 10:15 am and 12:05 pm.

---

## Slice 2: Maya's screen (~60 min, the biggest)
**Files:**
- `index.html`: add `viewport-fit=cover`; title "Next Up".
- `src/App.tsx`:
  - one `useReducer((s, a) => reduce(s, a, NOW), …)`, started from `load(localStorage.getItem('lance-nextup:v1'), seed)`; saved in an effect;
  - the demo bar;
  - the toast;
  - ids and times come from `crypto.randomUUID()` and `Date.now()` in event handlers, never in `reduce`.
- `src/ui.tsx`: pieces Sam reuses in slice 3: `BigButton` (500 ms `disabled` after its label changes), `Toast`, and the chip lookup objects (class names written out in full).
- `src/Maya.tsx`: Next Up card, list, greyed rows, collapsed Done, bottom bar. It reads `board`, `idle`
  (nothing to start: no big button) and `roomsLeft` from `rules.ts`, and doesn't repeat any of their logic.
- Design (see NOTES.md): `system-ui`, the door-plate room number, a neutral white plate for dirty, and green only for inspected.
- `e2e/maya.spec.ts`. The smoke test stays, as long as the card still says "Next Up".

**Order inside the slice:**
0. **Visual direction first.** Run /frontend-design to pick a direction: big type, high contrast, readable
   at arm's length. That covers the type scale, the colours for the four states and the two occupancy
   values, and how much weight the room number and reason get. **I stop and show you the direction (a short
   write-up and one static mock shot) before anything else.**
1. Layout screenshot `shots/01-layout.png` at 390×664 with every element present, using static data: demo bar, banner, toast, card with Report button and hold badge, list, bottom bar. I'll show you this one shot before wiring anything.
2. `BigButton` guard plus AC 6. The test waits for "Finish 106" to be enabled, reads the button's position, then calls `page.touchscreen.tap` twice, 100 ms apart.
3. AC 3, then AC 4, then saving (AC 12).

**The toast is derived from state:** it shows while `state.before?.actionId === toast.actionId` and less than 5 s have passed. Any accepted action clears `before`, so the toast disappears without extra code.

**ACs:** 3, 4, 6, 12.

**Most likely to go wrong:**
- **It doesn't fit at 664px** once every button is at least 48px. Step 1 catches this before any wiring.
- **Playwright and the guard:** with a real `disabled` attribute Playwright waits automatically. The risk is AC 6 passing without testing anything if the second tap misses, so the test also asserts that 103 is still dirty.
- **The time check in AC 3:** find every `\d{1,2}:\d{2}` in the page text and assert each one is followed by " am" or " pm". It must not just test that one matching time exists.
- **Leftover state between tests:** each Playwright test gets a fresh context, so localStorage starts empty. AC 12 reloads in the same context.

**After slice 2: stop.** You deploy a preview and check it on your phone. On a real iPhone the safe-area
padding and the 500 ms guard behave differently than in Playwright. Slice 3 starts when you say so.

---

## Slice 3: report, Sam, notice back (~40 min)
**Files:**
- `src/Maya.tsx`:
  - the "Report problem · 106" button;
  - the 4-icon grid sheet, which closes on the first tap so a double tap can't file two reports;
  - the "On hold · AC" badge;
  - the banner with ✕;
  - the done row "Clean · AC fixed by Sam".
- `src/Sam.tsx`: card plus list from `samQueue`, and a `BigButton` reading "Fixed 106 · AC".
- `src/App.tsx`: the demo bar switches screens.
- `e2e/report.spec.ts`.

**ACs:** 7, 11.

**Most likely to go wrong:**
- **AC 7 depends on Sam's screen** to check that the undone task is gone, so Sam's screen comes first in this slice.
- **The banner pushes the card down** and pushes the list off screen. The slice-2 screenshot already includes the banner.
- **Category labels must match exactly** across the banner, the badge and the done row. They already come from `rules.ts` (`CATEGORY_LABEL`, `holdCategories`, `notices`, and the done reason in `board`), so the UI only displays them.

---

## Slice 4: stretch, only once core (AC 1–12) is green (each step is its own check, /prove-it and commit)
1. **Needs part, AC 13:**
   - `reduce` handles `needsPart`: the hold stays, and the task sorts to the bottom of `samQueue`.
   - Sam gets an outlined "Needs part" button on his card, away from the big button.
   - Maya's banner reads "106 AC needs a part".
   - Files: `reduce.ts`, `rules.ts`, `Sam.tsx`, `Maya.tsx`, and the tests.
2. **Metrics, AC 15:**
   - `src/domain/metrics.ts` calculates Finish → next Start, open → first Start and the undo rate, from a fixture log.
   - `App` sends an `open` action on load and on each user switch.
   - Watch out: `open` is an accepted action, so it clears `before`. That's fine, because switching hides the toast anyway.
3. **Stop, AC 14:**
   - `reduce` handles `stop`: the room goes back to dirty.
   - Stop is an outlined button on the in-progress card, not in the bottom bar.
   - e2e test.

Reporting from a done row stays unbuilt unless you ask for it.

## What doesn't fit in about 2 hours
- Core is about 2h15 including check runs, before any debugging, so slice 4 relies on the extra time you mentioned. Needs part is about 15 min, metrics about 20 min, Stop about 15 min.
- **README:** left until you ask for it after the review.
- **Deploy:** you deploy the preview after slice 2. `playwright.config.ts` can also run the e2e tests against it with `BASE_URL`.
- **If slice 2 runs long, first to cut:** the strict every-time-format check in AC 3 (keep the "ready" check), then the unreadable-JSON half of AC 12.

## Verification per slice
- After each slice: `npm run check`, quoting its summary line. Then /prove-it and its single "Verified: …" line. Then a commit, e.g. "Slice 1: domain (AC 1, 2, 5, 8, 9, 10)".
- Slice 1: vitest output lists one test per AC.
- Slice 2: you look at the direction mock, `shots/01-layout.png` and the AC 4 end-state shot. Then you check the deployed preview on your phone.
- Slice 3: the AC 11 shots for Sam's queue and Maya's banner. Plus one manual run on `npm run dev`: Maya reports AC, switch to Sam, Fixed, back to Maya.
