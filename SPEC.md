# Next Up: SPEC

Fixes critique #1 (the list doesn't say which room is next) and builds #2 (one-tap problem
report that routes to maintenance and reports back). Mobile web, fake data, no backend.

**User:** a room attendant (Maya) mid-shift. Phone in one hand, little training, often ESL.

**Metrics** (these include walking time, so read them as before vs after, not as absolute numbers):
- **Main:** time from Finish to the next Start. This is the decision she makes every room.
- **Secondary:** time from opening the app to the first Start.
- **Guardrail:** the undo rate on Start and Finish. If it goes up, the order or the button is misleading her.

## Rules

**Clock.** The demo clock is fixed at **10:15 am** (`now = 615` demo minutes). Business rules take
`now` as a parameter. Event times (`at`) are real epoch ms supplied by the UI; they feed the
metrics and "oldest" ordering, never the room order. Every displayed time is 12-hour with
am/pm, e.g. "11:30 am".

**Words.** Cleaning state uses Lance's four words: *dirty / in progress / clean / inspected*.
Occupancy (*vacant / occupied*) is a separate chip with its own colour and icon. "Ready" never
appears as a word. The check is `/\bready\b/i`, so "already" passes.

**Maya's order** (one list, top row is Next Up):
1. **Guest waiting or arriving.** A checkout whose arrival is ≤ now + 120 min. Earliest arrival first.
   Reason: "Guest waiting since 11:30 am" (arrival ≤ now) or "Guest arrives 11:30 am".
2. **Checkouts.** Room number order. Reason: "Checkout" (+ "· guest arrives 2:00 pm" if known).
3. **Stayovers.** Room number order. Reason: "Stayover".
4. **Greyed, at the bottom, no Start.** DND until a time later than now ("Do not disturb until 10:45 am"),
   or a late checkout later than now ("Late checkout 12:00 pm"). Room number order.
5. **Done** (collapsed): clean and inspected rooms. Row reads e.g. "Clean" or "Clean · AC fixed by Sam".

A room that is in progress is always Next Up, and only one room can be in progress at a time.
**Her pick:** when nothing is in progress, tapping a row that isn't greyed makes that room Next Up,
and the rest stay in the usual order below it. To change her mind she taps another row. Starting the
room clears the pick. While a room is in progress, tapping a row does nothing; tapping a greyed row
always does nothing.
VIP is shown as a badge but doesn't change the order. A room on hold keeps its place: the hold stops
the room being sold, not the cleaning.

**Big button** (bottom bar, safe-area padded) always names the room: "Start 106" → "Finish 106".
For 500 ms after its room or label changes it is `disabled` (it looks dimmed and ignores taps).
**Nothing to start:** when only greyed rooms are left, the Next Up panel says when the next one opens
("Nothing to start. 105 opens at 10:45 am") and the big button is hidden. When every room is done it says
"All your rooms are done".

**Toast** sits at the **top** of the screen, under the demo bar and well away from the big button,
so Undo is never just above Start. One toast at a time: a new one replaces the old, so Undo always
means the last thing she did. Each toast lasts 5 s, and it disappears early as soon as any other action
is accepted (a pick, a user switch, a dismiss). The toast text stays on one line: Start shows
"Started 106 · Undo", and Finish shows "106 clean · 5 left · Undo".
**After Finish or a pick** the page scrolls back to the top, so the new Next Up plate is fully visible and
not under the toast.

**Report.** The Next Up card has an outlined button that names the room, "Report problem · 106"
(deliberately not in the bottom bar, so she can't confuse it with Finish). Tap 1 opens a 4-icon grid:
AC (snowflake) · Plumbing (drop) · Light (bulb) · Broken item (wrench), each a plain black line
icon with its word. No emoji: colour only means cleaning state, and emoji look different on Android. Tap 2 files the report: no typing, no send button. The grid closes on that tap, so a double tap can't
file two reports. It shows
a toast with Undo. The report reaches Sam immediately, and Undo removes it for both Maya and Sam.

**Hold** is derived from tasks and never stored on the room: a room is on hold while it has an open
AC or Plumbing task. Light and Broken item don't hold. More than one report per room is allowed, and the
hold lifts when the last open AC or Plumbing task on that room is fixed.

**Undo.** Start, Finish and Report each save a copy of `rooms`, `tasks` and `picked` into `before`,
tagged with that action's id. Undo puts that copy back, so undoing a Start returns her to the room she
picked. Any other accepted action clears `before`, so only the newest action can be undone. The log
only grows: `undo` is a new event, and undone actions are left out of the metrics.

**Saving.** Each new state is written to localStorage under `lance-nextup:v1`, and loaded from there on
start. If it's missing, can't be parsed, or doesn't have `user`, `rooms`, `tasks` and `log` of the right
kind, the app starts from the seed. The undo copy is never loaded, so an Undo can't come back after a
reload. Bump the key whenever types.ts changes.

**Sam's order:** tasks that hold their room first, then soonest arrival of that room's next guest
(rooms with no arrival go after), then oldest. His big button is a single tap: "Fixed 106 · AC".

**Notice back.** When Maya is the active user, each of her reports that Sam fixed and she hasn't
dismissed shows as a banner: "106 AC fixed by Sam ✕". The banner stays until she taps ✕, and her
done row for that room keeps "AC fixed by Sam".

**Demo bar** (top): Maya | Sam.

**README** shows Maya's order at both 10:15 am and 12:05 pm, because the fixed clock means the app only
ever shows the first.

## Seed (Maya's board at 10:15 am)

| Room | Service | Occ. | State | Arrival | Other |
|---|---|---|---|---|---|
| 101 | checkout | vacant | inspected | | filler, done |
| 102 | checkout | vacant | clean | | filler, done |
| 103 | checkout | vacant | dirty | 2:00 pm | King |
| 104 | stayover | occupied | dirty | | |
| 105 | stayover | occupied | dirty | | DND until 10:45 am |
| 106 | checkout | vacant | dirty | 11:30 am | Suite, VIP |
| 107 | checkout | occupied | dirty | | Late checkout 12:00 pm |
| 108 | checkout | vacant | dirty | | |
| 204 | stayover | occupied | dirty | | Priya's room |

Sam starts with one open task: **204 · Light**, reported by Priya, older than anything Maya files.

## Types (src/domain/types.ts)

```ts
export type Minutes = number;               // demo minutes since midnight; 10:15 am = 615
export type UserId = 'maya' | 'sam' | 'priya';
export type CleanState = 'dirty' | 'in_progress' | 'clean' | 'inspected';
export type Occupancy = 'vacant' | 'occupied';
export type Service = 'checkout' | 'stayover';
export type Category = 'ac' | 'plumbing' | 'light' | 'broken';
export const HOLDS: readonly Category[] = ['ac', 'plumbing'];

export interface Room {
  id: string;                               // '106'
  service: Service;
  occupancy: Occupancy;
  state: CleanState;
  assignee: UserId;
  roomType?: string;                        // 'Suite'
  vip?: boolean;
  arrival?: Minutes;                        // next guest; checkouts only
  dndUntil?: Minutes;
  lateCheckout?: Minutes;
}                                           // no hold field: hold is derived from tasks

export interface Task {
  id: string;                               // = the report action's id
  roomId: string;
  category: Category;
  reportedBy: UserId;
  createdAt: number;                        // epoch ms
  status: 'open' | 'fixed' | 'needs_part';  // needs_part is stretch
  noticeDismissed?: boolean;
}

export type Action =
  | { type: 'pick'; roomId: string; at: number }
  | { type: 'start'; id: string; roomId: string; at: number }
  | { type: 'finish'; id: string; roomId: string; at: number }
  | { type: 'report'; id: string; roomId: string; category: Category; at: number }
  | { type: 'undo'; actionId: string; at: number }  // must match before.actionId
  | { type: 'fix'; taskId: string; at: number }
  | { type: 'dismiss'; taskId: string; at: number }
  | { type: 'switchUser'; to: UserId; at: number }
  // stretch:
  | { type: 'needsPart'; taskId: string; at: number }
  | { type: 'stop'; roomId: string; at: number }
  | { type: 'open'; at: number };           // app opened as the current user

export interface State {
  user: UserId;
  picked?: string;                          // room id she tapped; cleared on start
  rooms: Room[];
  tasks: Task[];
  before?: { actionId: string; rooms: Room[]; tasks: Task[]; picked?: string };  // set by start/finish/report
  log: Action[];                            // accepted actions only, append-only
}
```

## Acceptance criteria

`[u]` = Vitest on src/domain, `[e]` = Playwright on iPhone 13.

**Core**
1. `[u]` At 10:15 am with the seed, Maya's order is exactly **106, 103, 108, 104**, then greyed **105, 107**,
   with **101, 102** in Done. Once she finishes 106, 103, 108 and 104, the panel reads "Nothing to start.
   105 opens at 10:45 am".
2. `[u]` At 12:05 pm with the seed, the order is exactly **106, 103, 107, 108, 104, 105**, with nothing greyed.
   Boundary: arrival at now + 120 counts as arriving and now + 121 doesn't; arrival ≤ now reads "Guest waiting".
3. `[e]` On load as Maya, the Next Up card shows 106 with "Guest arrives 11:30 am", a VIP badge, separate
   occupancy and state chips (vacant / dirty), and a "Report problem · 106" button. The big button reads
   "Start 106". 105 and 107 are greyed, with their reason and no Start. No visible text matches
   `/\bready\b/i`, and every time on screen matches `/\d{1,2}:\d{2} (am|pm)/`.
4. `[e]` Tapping Start 106 makes the button read "Finish 106" and 106 shows in progress. Tapping Finish puts
   106 in Done as clean, the button reads "Start 103", and a one-line toast says "106 clean · 5 left". The
   toast sits above the Next Up card. Even if she had scrolled down before Finish, the 103 plate is then
   fully on screen and not covered by the toast or the bottom bar. Tapping Undo on it puts 106 back in progress with
   "Finish 106". Finishing again and then tapping the 104 row makes 104 Next Up ("Start 104"), and the toast
   disappears.
5. `[u]` `reduce` rejects, returning the *same state object* and adding nothing to the log: a Start while
   another room is in progress, a Start on a greyed room, a Finish on a room that isn't in progress, a pick
   while a room is in progress or on a greyed room, a fix of a task that isn't open, and an undo whose
   `actionId` doesn't match `before` (including after a pick has cleared `before`).
6. `[e]` After Start 106, two `page.touchscreen.tap` calls 350 ms apart on the big button's position leave
   106 clean and 103 still dirty, and the button reads "Start 103". (350 ms lands late inside the 500 ms guard,
   like a hesitant second tap. Verified: with the guard removed this test fails.)
7. `[e]` Report problem · 106 → AC (2 taps, no text field, no send button) shows a toast with Undo, and 106
   shows an "On hold · AC" badge and stays Next Up. A second run: tapping Undo removes the badge, and Sam's
   list doesn't have the task.
8. `[u]` Hold is derived: an open AC or Plumbing task holds its room, and Light or Broken doesn't. With two
   holding tasks on 106, fixing one keeps the hold and fixing both lifts it.
9. `[u]` For each of start, finish and report: undo restores `rooms`, `tasks` and `picked` to their state
   before that action, clears `before`, and the log ends with both the original event and the `undo` event.
   Pick 104, Start, undo: 104 is dirty and still picked.
10. `[u]` Sam's order: seed + AC on 106 → [106, 204]. Seed + Light on 106 → [106, 204] (an arrival beats
    an older task). Seed + Light on 108 → [204, 108] (no arrival, so oldest first).
11. `[e]` Maya reports AC on 106 and the demo bar switches to Sam. His Next Up is "106 · AC" with a
    "Fixed 106 · AC" button, and one tap shows 204 next. Switching back to Maya shows the banner
    "106 AC fixed by Sam". After ✕ the banner is gone, and once 106 is finished its done row reads
    "Clean · AC fixed by Sam".
12. `[e]` After Start 106 and a page reload, the button still reads "Finish 106" and 106 is in progress.
    With unreadable JSON stored under `lance-nextup:v1`, the app loads the seed without errors. (The
    wrong-shape and no-Undo-after-reload rules are unit-tested on `load`.)

**Stretch** (in this order)
13. `[u]` Needs part: the task becomes `needs_part`, the hold stays, it drops to the bottom of Sam's list,
    and Maya gets the banner "106 AC needs a part".
14. `[e]` Stop: on an in-progress room, Stop returns it to dirty and to its usual place in the order. The big
    button then reads "Start <that room>".
15. `[u]` Metrics, from a fixture log with one undone Start and one undone report: each user gets their
    Finish → next Start times (main) and their open → first Start time (secondary), with undone actions left
    out. The undo rate is undone Starts and Finishes divided by all Starts and Finishes, so in this fixture
    the undone Start counts and the undone report doesn't.

Also stretch, with no AC until it's picked up: reporting a problem from a done row.

## Build order
1. Domain with Vitest: sort (AC 1, 2), rejections (5), hold (8), undo (9), Sam's order (10).
2. One screenshot at 390×664 with every element showing (demo bar, banner, toast, card, list, bottom bar)
   to check it fits before wiring anything up.
3. Big button with the `disabled` guard, plus AC 6. Every e2e flow depends on this behaving.
4. Maya's screens (AC 3, 4), then saving (12), then report (7), then Sam and the notice (11).
5. Stretch, in the order listed.

## Out of scope / next steps
- Lock problems (a lock should hold the room). Today it sits in Broken item, which doesn't hold.
- Undo for Sam's Fixed. A mis-tap today sends Maya a false "fixed" banner.
- Atkinson Hyperlegible Next font. 1/l/I and 0/O look clearly different, which helps with room numbers
  and ESL readers. It would be one self-hosted .woff2; we use `system-ui` for now.
- Supervisor screens, inspection (clean → inspected), assignment and moves (critique #3, #4).
- A clock that moves: DND and late checkout never expire in the app itself.
- Guest-out state for stayovers, front-desk view, translation, real backend.
