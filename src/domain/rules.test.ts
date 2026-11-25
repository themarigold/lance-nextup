import { describe, it, expect } from 'vitest'
import { NOW, seed } from './seed'
import { board, fmt, isOnHold, samQueue } from './rules'
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
