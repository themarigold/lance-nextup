# Notes

## Decisions
- Fix critique #1 (which room next) and build #2 (2-tap problem report). SPEC.md is the source of truth.
- Demo clock fixed at 10:15 am. No time-travel button: no clock to debug, and tests stay deterministic.
- 12-hour times with am/pm everywhere. "Ready" is banned as a whole word (`/\bready\b/i`).
- A held room keeps its place: the hold stops it being sold, not the cleaning.
- Hold is derived from open AC or Plumbing tasks, never stored on the room, so it can't get out of sync.
- Report button is on the Next Up card and names the room ("Report problem · 106"), not in the bottom
  bar, so she can't hit it instead of Finish.
- Sam closes with one tap (Fixed). Lance's work orders already track his time.
- Maya's notice is a banner until she dismisses it, plus the note on her done row.
- Sam's order: holds first, then soonest arrival, then oldest, so a VIP arriving at 11:30 am doesn't wait
  behind an older task.
- Start, Finish and Report all get a 5 s undo, which doubles as the guardrail metric.
- Undo saves a copy of rooms, tasks and the pick before the action and puts it back (undoing a Start
  returns her to the room she picked). Any other action clears the copy,
  and the log only grows.
- One toast at a time, at the top of the screen (Undo just above Start invites a wrong tap). A new toast
  replaces the old one and any other action hides it, so there's never an Undo that can't work.
- The 500 ms guard on the big button is a real `disabled` attribute. Playwright waits for it, and Maya
  sees it dim.
- Reload-save moved into core, to protect the demo recording.
- Main metric: Finish → next Start. Secondary: open → first Start. These are for before vs after only,
  since walking time is mixed in.

- **Nothing to start:** when only greyed rooms are left, the panel says when the next one opens and the
  big button is hidden. With the fixed clock the demo reaches this after four rooms.
- **Review by a fresh agent (61 single changes, 32 not caught):** every real gap now has a test, and
  re-running those changes turns a test red each time.
  - `reduce` clears the undo copy by default (only Start, Finish and Report keep it), so new actions can't
    forget to clear it.
  - `load()` drops the undo copy and rejects wrong-shape data.
  - The hold categories, the banners, the "AC fixed by Sam" done note, rooms left, and the
    nothing-to-start message are in `rules.ts`, so Vitest covers them.
  - The report grid closes on the first tap.
- `reduce(state, action, now)` takes the demo time, because Start and pick depend on whether a room is
  greyed. `useReducer` wraps it with `NOW`.
- **Design:** `system-ui` font (nothing to add). The room number sits on a plate like a door sign. Dirty
  is a neutral white plate, so the list isn't a wall of red. Amber is in progress, blue is clean, and
  green is only ever inspected, which puts "never say ready" into the colours. Occupancy is an outline
  chip with no colour. Icons are plain black inline SVG, not emoji (emoji add colour and differ on
  Android). The plate uses 64px numerals, or 52px for 4-digit rooms like 1308 so they still fit
  (measured in the mock). The toast covers the demo bar, so switching to Sam waits up to 5 s.

- **Toast:** one line ("106 clean · 5 left"). After Finish or a pick the page scrolls to the top, so the
  new Next Up plate is never under the toast. AC 4 scrolls down first, then checks the plate is fully
  on screen and nothing covers it.
- **AC 6 at 350 ms**, late inside the 500 ms guard. Lesson from verifying it: my first "guard removed"
  change left a variable unused, so `tsc` failed and Playwright tested the old (guarded) build. Any
  break-the-code check must stop when the build fails, or its result means nothing.

- **Report sheet:** "Problem in 106", four big icon buttons, ✕, and no text field or send button. It
  covers the Next Up panel, not the big button, so a second tap after it closes lands on the plate or
  chips, never on Start. It closes on the first tap.
- **Sam's screen:** the same layout as Maya's. The plate is the room, the title is the category, and the
  line reads "Room on hold · guest arrives 11:30 am · from Maya" (`taskReason` in rules.ts, where the
  hold comes from open tasks). The big button is "Fixed 106 · AC", one tap, no toast and no undo.

- **Demo path test (AC 7):** Start 106, report AC while cleaning, then Finish. 106 stays Next Up and on hold
  until Finish, and its Done row then reads "Clean · On hold · AC".
- **Needs part (AC 13):** an outlined button in Sam's card. The task waits at the bottom of his list, and the
  hold stays because it comes from the task that's still open. Maya gets "106 AC needs a part". Fixed still
  closes it later (so AC 5 now rejects a fix only on an already-fixed task), and each new outcome shows a
  fresh banner even if she dismissed the earlier one.
- **Two independent reviews** (a fresh subagent that ran the app, and Codex, read-only) found these fixes:
  - **Double tap on Report** filed a report, because the sheet opens under the finger. The sheet's buttons are
    now disabled for 500 ms after it opens.
  - **Double tap on Needs part** also marked 204. It now has the same guard.
  - **The guard re-arms on every accepted action** (`useArmed`, keyed on the log length), not only when the
    label changes. That covers Start then a quick Undo, and two same-category tasks on one room.
  - **Reset in the demo bar** (with a confirm) clears saved state and reloads the seed, so a rehearsal can't
    leak into the demo. It clears storage and reloads instead of going through `reduce`, because it's demo
    chrome, not app state.
  - **The spec now says the toast covers the demo bar.** It said "under" before, which disagreed with the code.
  - **New tests:**
    - the AC 3 plate and the grey background on greyed rows;
    - AC 5 deep-freezes the state;
    - AC 13 in the browser, through Fixed and to Sam's empty screen;
    - Plumbing through Needs part.
- **Metrics (AC 15):** calculation only, no UI (`metrics(log, firstUser)` in src/domain/metrics.ts). Undone
  actions are left out of the times; the undo rate counts only Starts and Finishes. Actions don't record a
  user, so it replays `switchUser`, and a switch counts as opening the app as that user. `reduce` now accepts
  `open` (it's only logged), and the app logs one on load. In dev, StrictMode logs it twice; the metric uses
  the latest open before a Start, so that's harmless.
- **No duplicate reports:** a category the room already has with Sam (open, or waiting for a part) shows as
  "Reported" and is disabled until he fixes it. `reduce` rejects the duplicate too, so the rule holds outside
  the UI. As a result, two tasks of the same category on one room can't happen any more, so the tests that used
  two AC tasks now use AC plus Plumbing. The Undo test still covers the guard re-arming when the label comes
  back unchanged.
- **Sam's pick:** he taps a row to make it his Next Up (`pickTask`, `state.pickedTask`). Fixed and Needs part
  act on it, and the pick clears once he does. The rows share the 500 ms guard. This changed `types.ts`, so the
  saved-data key is now `lance-nextup:v2`; old v1 data is ignored and the app starts from the seed.

## Cuts
- A "Back to suggested" button after picking a row. Safari doesn't fire a tap when she scrolls, and
  tapping another row switches back.
- A "+30 min" clock button. The 12:05 pm order goes in the README instead.
- A send button, typing, or photos in the report.

## Deferred
- Stop (AC 14): skipped for now, in the spec's next steps.
- Reporting from a done row (stretch, never picked up).
- A screen or export for the metrics.
- Lock problems should hold the room. For now a lock is filed under Broken item, which doesn't hold.
- Undo for Sam's Fixed.
- Atkinson Hyperlegible Next font (one self-hosted .woff2), for clearer 1/l/I and 0/O. `system-ui` for now.
- README: replace the Vite template and show the 10:15 am and 12:05 pm orders (the spec requires this).
- **Stricter saved-data check:** `load` checks that `rooms`, `tasks` and `log` are arrays but not what's in
  them. `rooms: [null]` passes and then crashes the board, and any `user` string (e.g. "priya") is accepted.
  This only happens with hand-edited storage.
- **Demo over https only:** `crypto.randomUUID()` needs a secure context. Over plain http on a LAN address
  (`npm run dev -- --host` on the phone), Start, Finish and Report fail. Vercel (https) and localhost are fine.
