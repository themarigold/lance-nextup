import { describe, it, expect } from 'vitest'
import { NOW, seed } from './seed'
import { load, reduce } from './reduce'
import type { Action, State } from './types'

const run = (s: State, ...as: Action[]) => as.reduce((st, a) => reduce(st, a, NOW), s)
const start = (roomId: string): Action & { id: string } => ({ type: 'start', id: `s-${roomId}`, roomId, at: 1000 })
const finish = (roomId: string): Action & { id: string } => ({ type: 'finish', id: `f-${roomId}`, roomId, at: 2000 })
const report = (id: string, roomId: string): Action & { id: string } => ({ type: 'report', id, roomId, category: 'ac', at: 1500 })
const pick = (roomId: string): Action => ({ type: 'pick', roomId, at: 500 })
const fix = (taskId: string): Action => ({ type: 'fix', taskId, at: 3000 })
const undo = (actionId: string): Action => ({ type: 'undo', actionId, at: 4000 })

/** A rejected action returns the very same state object, so nothing is logged. */
function expectRejected(s: State, a: Action) {
  const out = reduce(s, a, NOW)
  expect(out).toBe(s)
  expect(out.log).toHaveLength(s.log.length)
}

describe('AC 5: reduce rejects invalid actions', () => {
  it('accepts a valid action and logs it (control)', () => {
    const s = reduce(seed, start('106'), NOW)
    expect(s).not.toBe(seed)
    expect(s.log).toEqual([start('106')])
  })

  it('rejects a Start while another room is in progress', () => {
    expectRejected(run(seed, start('106')), start('103'))
  })

  it('rejects a Start on a greyed room', () => {
    expectRejected(seed, start('105'))
    expectRejected(seed, start('107'))
  })

  it('accepts a Start once DND or late checkout ends exactly now', () => {
    const endsNow: State = {
      ...seed,
      rooms: seed.rooms.map((r) => (r.id === '105' ? { ...r, dndUntil: NOW } : r.id === '107' ? { ...r, lateCheckout: NOW } : r)),
    }
    expect(reduce(endsNow, start('105'), NOW)).not.toBe(endsNow)
    expect(reduce(endsNow, start('107'), NOW)).not.toBe(endsNow)
  })

  it("rejects a Start or pick on someone else's room (Priya's 204)", () => {
    expectRejected(seed, start('204'))
    expectRejected(seed, pick('204'))
  })

  it('rejects a Finish on a room that is not in progress', () => {
    expectRejected(seed, finish('106'))
  })

  it('rejects a pick while a room is in progress, or on a greyed room', () => {
    expectRejected(run(seed, start('106')), pick('104'))
    expectRejected(seed, pick('105'))
  })

  it('rejects a fix of a task that is not open', () => {
    expectRejected(run(seed, fix('t-204')), fix('t-204'))
  })

  it('rejects an undo whose actionId does not match before', () => {
    expectRejected(run(seed, start('106')), undo('nope'))
  })

  it('rejects an undo after a pick has cleared before', () => {
    expectRejected(run(seed, start('106'), finish('106'), pick('104')), undo('f-106'))
  })
})

describe('AC 9: undo restores rooms, tasks and pick; the log only grows', () => {
  const cases: [string, () => State, Action & { id: string }][] = [
    ['start', () => seed, start('106')],
    ['finish', () => run(seed, start('106')), finish('106')],
    ['report', () => seed, report('r1', '106')],
  ]

  for (const [name, setup, action] of cases) {
    it(`undoes a ${name}`, () => {
      const base = setup()
      const done = run(base, action)
      expect(done.before?.actionId).toBe(action.id)
      const undone = run(done, undo(action.id))
      expect(undone.rooms).toEqual(base.rooms)
      expect(undone.tasks).toEqual(base.tasks)
      expect(undone.picked).toBe(base.picked)
      expect(undone.before).toBeUndefined()
      expect(undone.log.slice(-2)).toEqual([action, undo(action.id)])
    })
  }

  it('pick 104, Start, undo: 104 is dirty and still picked', () => {
    const s = run(seed, pick('104'), start('104'), undo('s-104'))
    expect(s.rooms.find((r) => r.id === '104')?.state).toBe('dirty')
    expect(s.picked).toBe('104')
  })

  it('any other accepted action clears before (pick, fix, dismiss, switchUser)', () => {
    const base = run(seed, report('r', '103'), fix('r'), start('106'), finish('106'))
    expect(base.before?.actionId).toBe('f-106')
    const others: Action[] = [pick('104'), fix('t-204'), { type: 'dismiss', taskId: 'r', at: 5000 }, { type: 'switchUser', to: 'sam', at: 5000 }]
    for (const a of others) {
      const s = reduce(base, a, NOW)
      expect(s.log).toHaveLength(base.log.length + 1)
      expect(s.before).toBeUndefined()
    }
  })
})

describe('Review gaps (AC 5, 9)', () => {
  it('Finish makes the room clean; a report records its own time', () => {
    const s = run(seed, start('106'), finish('106'), report('r', '103'))
    expect(s.rooms.find((r) => r.id === '106')?.state).toBe('clean')
    expect(s.tasks.find((t) => t.id === 'r')?.createdAt).toBe(1500)
  })

  it('rejects a Start or pick on a clean or inspected room', () => {
    for (const id of ['101', '102']) {
      expectRejected(seed, start(id))
      expectRejected(seed, pick(id))
    }
  })

  it('starting the picked room clears the pick', () => {
    expect(run(seed, pick('104'), start('104')).picked).toBeUndefined()
  })

  it('a report keeps her pick, and undoing it restores the pick', () => {
    const s = run(seed, pick('104'), report('r', '104'))
    expect(s.picked).toBe('104')
    expect(run(s, undo('r')).picked).toBe('104')
  })

  it('rejects a second dismiss, a dismiss of an open task, and a switch to the current user', () => {
    const fixed = run(seed, report('r', '106'), fix('r'))
    expectRejected(run(fixed, { type: 'dismiss', taskId: 'r', at: 5000 }), { type: 'dismiss', taskId: 'r', at: 6000 })
    expectRejected(seed, { type: 'dismiss', taskId: 't-204', at: 5000 })
    expectRejected(seed, { type: 'switchUser', to: 'maya', at: 5000 })
  })
})

describe('AC 12: loading saved state', () => {
  it('drops the saved undo copy, so Undo never comes back after a reload', () => {
    const s = run(seed, start('106'))
    const loaded = load(JSON.stringify(s), seed)
    expect(loaded.rooms).toEqual(s.rooms)
    expect(loaded.before).toBeUndefined()
  })

  it('falls back to the seed for missing, unreadable or wrong-shape data', () => {
    for (const raw of [null, '{not json', 'null', '{}', '{"user":"maya","rooms":[],"tasks":{},"log":[]}']) expect(load(raw, seed)).toBe(seed)
  })
})
