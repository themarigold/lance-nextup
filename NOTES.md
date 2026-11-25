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

## Cuts
- A "Back to suggested" button after picking a row. Safari doesn't fire a tap when she scrolls, and
  tapping another row switches back.
- A "+30 min" clock button. The 12:05 pm order goes in the README instead.
- A send button, typing, or photos in the report.

## Deferred
- Stretch: Needs part, Stop, metrics, reporting from a done row.
- Lock problems should hold the room. For now a lock is filed under Broken item, which doesn't hold.
- Undo for Sam's Fixed.
- README: replace the Vite template and show the 10:15 am and 12:05 pm orders (the spec requires this).
