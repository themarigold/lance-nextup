# Next Up

A mobile web MVP for hotel room attendants, built as a take-home for Lance. It does two things:

1. **Tells the attendant which room to clean next, and why.** One Next Up room at the top with its
   reason ("Guest arrives 11:30 am"), the rest below in order, and one big button that always names the
   room ("Start 106" → "Finish 106"). This fixes problem #1 from my critique of Lance's app: the list runs
   in room-number order and never says what to do next.
2. **A 2-tap problem report that routes to maintenance and reports back.** Report problem · 106 → AC.
   No typing, no send button, just Undo. AC and Plumbing put the room on hold automatically. Sam in
   maintenance gets it as his next task, closes it with Fixed (or Needs part), and Maya gets a notice back.

**Live:** https://lance-nextup.vercel.app. Built for a phone; on a laptop, use your browser's iPhone view.

Fake data and no backend. A demo bar at the top switches between Maya (room attendant) and Sam (maintenance),
and Reset puts the shift back to the start.

## Try the demo path

1. As Maya, tap **Start 106**.
2. Tap **Report problem · 106**, then **AC**. 106 shows "On hold · AC" and stays Next Up.
3. Tap **Finish 106**. 103 becomes Next Up, and 106's Done row reads "Clean · On hold · AC".
4. Wait for the toast to go (up to 5 s; it covers the demo bar), then switch to **Sam**. His next task is
   106 AC: "Room on hold · guest arrives 11:30 am · from Maya". Tap **Fixed 106 · AC**.
5. Switch back to **Maya**. The banner reads "106 AC fixed by Sam", and the hold is gone.

## Maya's order

The demo clock is fixed at **10:15 am**, so the app always shows the first order. The second order shows
how the same rooms re-sort later in the shift. Both are asserted exactly in `src/domain/rules.test.ts`.

| | Next Up, then in order | Greyed (can't start yet) | Done |
|---|---|---|---|
| **10:15 am** | 106, 103, 108, 104 | 105 (DND until 10:45 am), 107 (late checkout 12:00 pm) | 101, 102 |
| **12:05 pm** | 106, 103, 107, 108, 104, 105 | none | 101, 102 |

**The rules:**
1. Guests waiting, or arriving within 2 hours, go first, earliest arrival first.
2. Then checkouts.
3. Then stayovers.
4. DND and late-checkout rooms are greyed at the bottom until their time passes.

At 12:05 pm, 103's 2:00 pm guest is within 2 hours, and 107's late checkout and 105's DND have both ended.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # build, then the Vitest domain tests, then Playwright on an iPhone 13 (WebKit)
```

`npm run check` is the definition of done for every change: 58 unit tests and 16 browser tests.

**Where things are:**
- `SPEC.md` is the source of truth: rules, seed data, types and the 15 acceptance criteria.
- `NOTES.md` has the decision log.
- `src/domain/` holds the pure rules: order, holds, undo and metrics.
- `src/*.tsx` is the UI.
- `e2e/` holds the browser tests.

## Main decisions and tradeoffs

- **Lance's four words only:** dirty / in progress / clean / inspected. Never "ready", because clean
  isn't inspected. Occupancy (vacant / occupied) is a separate chip, so the two signals never merge
  into one label like "Vacant dirty".
- **Colour means cleaning state and nothing else.**
  - A dirty room is a white plate, so a list of mostly dirty rooms isn't a wall of red.
  - In progress is amber, clean is blue, and **green is only ever inspected**.
  - Icons are plain black line icons, not emoji, which add colour and look different on Android.
- **The room number is a door plate,** large enough to match against the door from arm's length.
- **The hold comes from the open task,** never from a flag on the room, so the two can't get out of sync.
  A held room keeps its place in Maya's list: the hold stops the room being sold, not the cleaning.
- **Report problem lives on the Next Up card, not next to Finish,** so a one-handed tap can't hit the wrong
  one. The button always names the room.
- **Start, Finish and Report each get a 5-second Undo.** It's the safety net for a wrong tap, and the undo
  rate is the guardrail metric. Undo adds an event to the log and never deletes one, so the metrics stay
  honest.
- **Double taps can't land on the next thing.** Wherever a new button can appear under the finger, it stays
  disabled for 500 ms:
  - the big button, after any action;
  - the report sheet's buttons, when it opens;
  - Report itself, after a report;
  - Needs part, after any action.

  The tests check which button is really under the finger.
- **The toast sits at the top, covering the demo bar,** never near the big button. Tradeoff: switching
  between Maya and Sam waits up to 5 s while a toast is showing.
- **The clock is fixed at 10:15 am,** so nothing time-based can drift during a demo. Tradeoff: DND and late
  checkout never expire in the app, and the 12:05 pm order only exists in the tests (and the table above).
- **State is saved across reloads** (`localStorage`, key `lance-nextup:v1`), so a phone recording survives
  a reload. Reset clears it for the next take.
- **Metrics are calculated, not shown:**
  - **Main:** Finish → next Start. That's the decision she makes every room.
  - **Secondary:** open → first Start.
  - **Guardrail:** the undo rate on Start and Finish.

  Walking time is included, so they're for comparing before and after, not absolute numbers.

## What I cut, and why

- **A "Back to suggested" button after tapping a row.** Scrolling doesn't fire a tap in Safari, and tapping
  another row switches back. Another button wasn't worth it.
- **A "+30 min" clock button.** No clock to debug. The README table shows the later order instead.
- **Typing, a send button or photos in the report.** Two taps and Undo are the whole point.
- **Stop** (put an in-progress room back to dirty). It was stretch and didn't fit; it's spec'd as AC 14.
- **Reporting a problem from a Done row.** Stretch, never picked up. She normally reports while she's
  still in the room.
- **The Atkinson Hyperlegible font.** It was considered for clearer 1/l/I and 0/O; `system-ui` is used for now.

## What I'd build next

1. **A front desk view of the hold,** so a held room actually can't be sold. Today the hold is only shown to
   Maya and Sam.
2. **Undo for Sam's Fixed**, so a mis-tap doesn't send Maya a false "fixed" notice.
3. **Guest-out state for stayovers, and a clock that moves,** so the order reacts as guests leave and as DND
   and late checkouts end, not only at a fixed 10:15 am.
4. **The supervisor's move screen and inspection:** a mid-shift move that shows floor and workload
   (critique #4), and clean → inspected.
5. **Lock problems should hold the room.** Today a lock is filed under Broken item, which doesn't hold.
6. **A screen or export for the metrics**, to compare Finish → next Start before and after with real attendants.
7. **Stop** (AC 14), and reporting from a Done row.
8. **A stricter check on saved data:** today it checks the lists exist, not what's in them. Also, the demo
   needs https or localhost, because the ids it creates need a secure context.
9. **The Atkinson Hyperlegible font** and translation. Then separate occupancy and cleaning signals
   everywhere in Lance's app (critique #3), and a real backend.

## How I used AI

I did the video critique beforehand myself, then wrote the spec and built this in one Claude Code session (transcript attached). The product decisions and cuts were mine, Claude wrote most of the code and tests, and I reviewed and steered it. Along the way I used two skills I wrote for my own setup, /pre-mortem to stress test the spec and /prove-it to check each slice, plus the /frontend-design plugin, and the final review came from both a Claude subagent and a Codex agent used as an external reviewer so no model only reviewed its own vendor's work. I also ran the ponytail plugin to keep the code small, and I made every acceptance criteria require a test. For longer projects I usually run a heavier spec —> plan —> build loop with cross-model review (Claude + GPT + Gemini), but that didn't fit the time box for this one.
