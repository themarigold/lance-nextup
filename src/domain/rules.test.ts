import { describe, it, expect } from 'vitest'
import { NOW, seed } from './seed'
import { board, fmt, holdCategories, idle, isOnHold, notices, roomsLeft, samQueue, taskReason } from './rules'
import { reduce } from './reduce'
import type { Action, Category, Room, State } from './types'

const ids = (rows: { room: Room }[]) => rows.map((r) => r.room.id)
const run = (s: State, ...as: Action[]) => as.reduce((st, a) => reduce(st, a, NOW), s)
const report = (id: string, roomId: string, category: Category): Action => ({ type: 'report', id, roomId, category, at: 1000 })
const fix = (taskId: string): Action => ({ type: 'fix', taskId, at: 2000 })
const PM_12_05 = 725

describe('AC 1: order at 10:15 am', () => {
  it('is 106, 103, 108, 104, then greyed 105, 107, with 101, 102 done', () => {
    const b = board(seed, NOW)
    expect(ids(b.active)).toEqual(['106', '103', '108', '104'])
    expect(ids(b.greyed)).toEqual(['105', '107'])
    expect(ids(b.done)).toEqual(['101', '102'])
  })

  it('gives each room its reason', () => {
    const b = board(seed, NOW)
    const reason = Object.fromEntries([...b.active, ...b.greyed].map((r) => [r.room.id, r.reason]))
    expect(reason).toEqual({
      '106': 'Guest arrives 11:30 am',
      '103': 'Checkout · guest arrives 2:00 pm',
      '108': 'Checkout',
      '104': 'Stayover',
      '105': 'Do not disturb until 10:45 am',
      '107': 'Late checkout 12:00 pm',
    })
  })
})

describe('AC 2: order at 12:05 pm and the 2-hour boundary', () => {
  it('is 106, 103, 107, 108, 104, 105 with nothing greyed', () => {
    const b = board(seed, PM_12_05)
    expect(ids(b.active)).toEqual(['106', '103', '107', '108', '104', '105'])
    expect(b.greyed).toEqual([])
  })

  it('reads "Guest waiting" once the arrival has passed', () => {
    const reason = board(seed, PM_12_05).active.find((r) => r.room.id === '106')?.reason
    expect(reason).toBe('Guest waiting since 11:30 am')
  })

  it('counts arrival at now + 120 as arriving, but not now + 121', () => {
    const with108Arriving = (arrival: number): State => ({
      ...seed,
      rooms: seed.rooms.map((r) => (r.id === '108' ? { ...r, arrival } : r)),
    })
    expect(ids(board(with108Arriving(NOW + 120), NOW).active)).toEqual(['106', '108', '103', '104'])
    expect(ids(board(with108Arriving(NOW + 121), NOW).active)).toEqual(['106', '103', '108', '104'])
  })

  it('stops greying a DND or late checkout that ends exactly now', () => {
    const endsNow: State = {
      ...seed,
      rooms: seed.rooms.map((r) => (r.id === '105' ? { ...r, dndUntil: NOW } : r.id === '107' ? { ...r, lateCheckout: NOW } : r)),
    }
    const b = board(endsNow, NOW)
    expect(ids(b.active)).toEqual(['106', '103', '107', '108', '104', '105'])
    expect(b.greyed).toEqual([])
  })

  it('formats 12-hour times with am/pm', () => {
    expect([fmt(0), fmt(615), fmt(720), fmt(840)]).toEqual(['12:00 am', '10:15 am', '12:00 pm', '2:00 pm'])
  })
})

describe('Next Up rules behind AC 4', () => {
  it('puts her pick first, the rest in the usual order', () => {
    const s = run(seed, { type: 'pick', roomId: '104', at: 1000 })
    expect(ids(board(s, NOW).active)).toEqual(['104', '106', '103', '108'])
  })

  it('puts the in-progress room first', () => {
    const s = run(seed, { type: 'start', id: 's-108', roomId: '108', at: 1000 })
    expect(ids(board(s, NOW).active)).toEqual(['108', '106', '103', '104'])
  })
})

describe('AC 8: hold is derived from open tasks', () => {
  it('AC and Plumbing hold their room; Light and Broken item do not', () => {
    const soft = run(seed, report('a', '106', 'light'), report('b', '103', 'broken'))
    expect([isOnHold(soft.tasks, '106'), isOnHold(soft.tasks, '103')]).toEqual([false, false])
    const hard = run(seed, report('c', '106', 'ac'), report('d', '103', 'plumbing'))
    expect([isOnHold(hard.tasks, '106'), isOnHold(hard.tasks, '103')]).toEqual([true, true])
  })

  it('with two holding tasks, fixing one keeps the hold and fixing both lifts it', () => {
    const two = run(seed, report('a', '106', 'ac'), report('b', '106', 'plumbing'))
    const one = run(two, fix('a'))
    expect(isOnHold(one.tasks, '106')).toBe(true)
    expect(isOnHold(run(one, fix('b')).tasks, '106')).toBe(false)
  })
})

describe("AC 10: Sam's order", () => {
  const queue = (s: State) => samQueue(s).map((t) => t.roomId)

  it('a hold goes first: AC on 106 → [106, 204]', () => {
    expect(queue(run(seed, report('r', '106', 'ac')))).toEqual(['106', '204'])
  })

  it('an arrival beats an older task: Light on 106 → [106, 204]', () => {
    expect(queue(run(seed, report('r', '106', 'light')))).toEqual(['106', '204'])
  })

  it('with no arrival, oldest first: Light on 108 → [204, 108]', () => {
    expect(queue(run(seed, report('r', '108', 'light')))).toEqual(['204', '108'])
  })
})

describe('Review gaps (AC 1, 2, 8, 10 and the rules behind AC 4, 11)', () => {
  const start = (roomId: string): Action => ({ type: 'start', id: `s-${roomId}`, roomId, at: 1000 })
  const finish = (roomId: string): Action => ({ type: 'finish', id: `f-${roomId}`, roomId, at: 2000 })

  it('sorts by room number even when the seed is out of order', () => {
    const b = board({ ...seed, rooms: [...seed.rooms].reverse() }, NOW)
    expect([ids(b.active), ids(b.greyed), ids(b.done)]).toEqual([['106', '103', '108', '104'], ['105', '107'], ['101', '102']])
  })

  it('reads "Guest waiting" when the arrival is exactly now', () => {
    expect(board(seed, 690).active[0].reason).toBe('Guest waiting since 11:30 am')
  })

  it('VIP and a hold do not change the order', () => {
    const vip = { ...seed, rooms: seed.rooms.map((r) => (r.id === '108' ? { ...r, vip: true } : r)) }
    expect(ids(board(vip, NOW).active)).toEqual(['106', '103', '108', '104'])
    expect(ids(board(run(seed, report('r', '106', 'ac')), NOW).active)).toEqual(['106', '103', '108', '104'])
  })

  it('a pick on the second row becomes Next Up', () => {
    const s = run(seed, { type: 'pick', roomId: '103', at: 1000 })
    expect(ids(board(s, NOW).active)).toEqual(['103', '106', '108', '104'])
  })

  it('a hold only holds its own room, and the badge knows the category', () => {
    const s = run(seed, report('a', '106', 'ac'), report('b', '106', 'light'))
    expect(isOnHold(s.tasks, '103')).toBe(false)
    expect(holdCategories(s.tasks, '106')).toEqual(['ac'])
  })

  it("Sam: holds beat arrival (AC on 108 + Light on 106 → [108, 106, 204]); fixed tasks leave", () => {
    const s = run(seed, report('a', '108', 'ac'), report('b', '106', 'light'))
    expect(samQueue(s).map((t) => t.roomId)).toEqual(['108', '106', '204'])
    expect(samQueue(run(s, fix('a'))).map((t) => t.roomId)).toEqual(['106', '204'])
  })

  it('done rows read Inspected / Clean, plus "AC fixed by Sam" on her reports', () => {
    expect(board(seed, NOW).done.map((r) => r.reason)).toEqual(['Inspected', 'Clean'])
    const s = run(seed, report('r', '106', 'ac'), start('106'), finish('106'), fix('r'))
    expect(board(s, NOW).done.find((r) => r.room.id === '106')?.reason).toBe('Clean · AC fixed by Sam')
  })

  it('notices: her fixed reports until dismissed', () => {
    const s = run(seed, report('r', '106', 'ac'), fix('r'))
    expect(notices(s).map((n) => n.text)).toEqual(['106 AC fixed by Sam'])
    expect(notices(run(s, { type: 'dismiss', taskId: 'r', at: 3000 }))).toEqual([])
    expect(notices(run(seed, fix('t-204')))).toEqual([]) // Priya's report, not Maya's
  })

  it('rooms left counts greyed rooms too (the "5 rooms left" toast)', () => {
    expect(roomsLeft(board(run(seed, start('106'), finish('106')), NOW))).toBe(5)
  })

  it('with only greyed rooms left, says when the next one opens; with none, says done', () => {
    const s = run(seed, ...['106', '103', '108', '104'].flatMap((id) => [start(id), finish(id)]))
    expect(idle(board(s, NOW))).toBe('Nothing to start. 105 opens at 10:45 am')
    expect(idle(board(seed, NOW))).toBeUndefined()
    const allDone = { ...seed, rooms: seed.rooms.map((r) => ({ ...r, state: 'clean' as const })) }
    expect(idle(board(allDone, NOW))).toBe('All your rooms are done')
  })
})

describe("Sam's card reason (AC 11)", () => {
  it('says the room is on hold, when the guest arrives, and who reported it', () => {
    const s = run(seed, report('r', '106', 'ac'))
    const [first, second] = samQueue(s)
    expect(taskReason(s, first, NOW)).toBe('Room on hold · guest arrives 11:30 am · from Maya')
    expect(taskReason(s, second, NOW)).toBe('From Priya')
    expect(taskReason(s, first, PM_12_05)).toBe('Room on hold · guest waiting since 11:30 am · from Maya')
  })
})

describe('Done row while held, and AC 13: Needs part', () => {
  const start = (roomId: string): Action => ({ type: 'start', id: `s-${roomId}`, roomId, at: 1000 })
  const finish = (roomId: string): Action => ({ type: 'finish', id: `f-${roomId}`, roomId, at: 2000 })
  const needsPart = (taskId: string): Action => ({ type: 'needsPart', taskId, at: 2500 })
  const done106 = (s: State) => board(s, NOW).done.find((r) => r.room.id === '106')?.reason

  it('a room finished while still held reads "Clean · On hold · AC"', () => {
    expect(done106(run(seed, start('106'), report('r', '106', 'ac'), finish('106')))).toBe('Clean · On hold · AC')
  })

  it('needs part: the hold stays, it drops to the bottom of Sam\'s list, Maya gets the banner', () => {
    const s = run(seed, report('r', '106', 'ac'), needsPart('r'))
    expect(s.tasks.find((t) => t.id === 'r')?.status).toBe('needs_part')
    expect(isOnHold(s.tasks, '106')).toBe(true)
    expect(samQueue(s).map((t) => t.roomId)).toEqual(['204', '106'])
    expect(notices(s).map((n) => n.text)).toEqual(['106 AC needs a part'])
    expect(taskReason(s, samQueue(s)[1], NOW)).toBe('Waiting for a part · room on hold · guest arrives 11:30 am · from Maya')
    expect(done106(run(s, start('106'), finish('106')))).toBe('Clean · AC needs a part')
  })

  it('Plumbing through Needs part: held while waiting, its own banner, lifted by Fixed', () => {
    const waiting = run(seed, report('p', '106', 'plumbing'), needsPart('p'))
    expect(holdCategories(waiting.tasks, '106')).toEqual(['plumbing'])
    expect(notices(waiting).map((n) => n.text)).toEqual(['106 Plumbing needs a part'])
    expect(isOnHold(run(waiting, fix('p')).tasks, '106')).toBe(false)
  })

  it('Fixed still closes it later: the hold lifts and the fixed banner shows, even after dismissing the first', () => {
    const waiting = run(seed, report('r', '106', 'ac'), needsPart('r'), { type: 'dismiss', taskId: 'r', at: 2600 })
    expect(notices(waiting)).toEqual([])
    const fixed = run(waiting, fix('r'))
    expect(isOnHold(fixed.tasks, '106')).toBe(false)
    expect(samQueue(fixed).map((t) => t.roomId)).toEqual(['204'])
    expect(notices(fixed).map((n) => n.text)).toEqual(['106 AC fixed by Sam'])
  })
})
