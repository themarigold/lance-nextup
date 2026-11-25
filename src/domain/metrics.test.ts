import { describe, it, expect } from 'vitest'
import { metrics } from './metrics'
import { reduce } from './reduce'
import { NOW, seed } from './seed'
import type { Action, State } from './types'

const run = (s: State, ...as: Action[]) => as.reduce((st, a) => reduce(st, a, NOW), s)

describe('AC 15: metrics from the log', () => {
  // A real, accepted log (built through reduce), times in ms. Maya opens the app, cleans 106,
  // mis-taps Start 103 and undoes it, files and undoes a report, then cleans 108 and starts 104.
  const s = run(
    seed,
    { type: 'open', at: 0 },
    { type: 'start', id: 's1', roomId: '106', at: 10_000 },
    { type: 'finish', id: 'f1', roomId: '106', at: 60_000 },
    { type: 'start', id: 's2', roomId: '103', at: 65_000 },
    { type: 'undo', actionId: 's2', at: 66_000 },
    { type: 'report', id: 'r1', roomId: '108', category: 'light', at: 70_000 },
    { type: 'undo', actionId: 'r1', at: 71_000 },
    { type: 'start', id: 's3', roomId: '108', at: 80_000 },
    { type: 'finish', id: 'f2', roomId: '108', at: 120_000 },
    { type: 'start', id: 's4', roomId: '104', at: 125_000 },
    { type: 'switchUser', to: 'sam', at: 130_000 },
  )

  it('every action in the fixture was accepted', () => {
    expect(s.log).toHaveLength(11)
  })

  it("main: each user's Finish → next Start, leaving out the undone Start", () => {
    // 60 s → 80 s (not 65 s: that Start was undone), then 120 s → 125 s. Sam starts no rooms.
    expect(metrics(s.log, seed.user).finishToStart).toEqual({ maya: [20_000, 5_000] })
  })

  it("secondary: each user's open → first Start", () => {
    expect(metrics(s.log, seed.user).openToStart).toEqual({ maya: [10_000] })
  })

  it('guardrail: undo rate counts the undone Start, not the undone report', () => {
    // Starts and Finishes: s1, f1, s2, s3, f2, s4 = 6, of which s2 was undone.
    expect(metrics(s.log, seed.user).undoRate).toBe(1 / 6)
  })

  it('a user switch counts as opening the app as that user', () => {
    const back = run(s, { type: 'finish', id: 'f3', roomId: '104', at: 140_000 }) // rejected: Sam has no 104
    expect(back).toBe(s)
    const t = run(s, { type: 'switchUser', to: 'maya', at: 200_000 }, { type: 'finish', id: 'f3', roomId: '104', at: 210_000 }, { type: 'start', id: 's5', roomId: '103', at: 215_000 })
    expect(metrics(t.log, seed.user).openToStart).toEqual({ maya: [10_000, 15_000] }) // back as Maya at 200 s, first Start at 215 s
    expect(metrics(t.log, seed.user).finishToStart).toEqual({ maya: [20_000, 5_000, 5_000] })
  })

  it('an empty log has no times and a 0 undo rate', () => {
    expect(metrics([], 'maya')).toEqual({ finishToStart: {}, openToStart: {}, undoRate: 0 })
  })
})
