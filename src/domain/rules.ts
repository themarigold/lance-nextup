import { HOLDS } from './types'
import type { Category, CleanState, Minutes, Room, State, Task } from './types'

export const CATEGORY_LABEL: Record<Category, string> = { ac: 'AC', plumbing: 'Plumbing', light: 'Light', broken: 'Broken item' }
const DONE_WORD: Partial<Record<CleanState, string>> = { clean: 'Clean', inspected: 'Inspected' }

export interface Row { room: Room; reason: string }
/** active[0] is Next Up. */
export interface Board { active: Row[]; greyed: Row[]; done: Row[] }

/** 615 → "10:15 am". */
export function fmt(min: Minutes): string {
  const h = Math.floor(min / 60) % 24
  return `${h % 12 || 12}:${String(min % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

/** Held while any AC or Plumbing task on the room is not fixed. */
export const isOnHold = (tasks: Task[], roomId: string) =>
  tasks.some((t) => t.roomId === roomId && t.status !== 'fixed' && HOLDS.includes(t.category))

export const isGreyed = (r: Room, now: Minutes) => (r.dndUntil ?? -1) > now || (r.lateCheckout ?? -1) > now

/** 0 = guest waiting or arriving within 2 h, 1 = checkout, 2 = stayover. */
function tier(r: Room, now: Minutes) {
  if (r.service === 'checkout' && r.arrival !== undefined && r.arrival <= now + 120) return 0
  return r.service === 'checkout' ? 1 : 2
}

function reason(r: Room, now: Minutes): string {
  if (r.dndUntil !== undefined && r.dndUntil > now) return `Do not disturb until ${fmt(r.dndUntil)}`
  if (r.lateCheckout !== undefined && r.lateCheckout > now) return `Late checkout ${fmt(r.lateCheckout)}`
  if (tier(r, now) === 0) return `${r.arrival! <= now ? 'Guest waiting since' : 'Guest arrives'} ${fmt(r.arrival!)}`
  if (r.service === 'stayover') return 'Stayover'
  return r.arrival === undefined ? 'Checkout' : `Checkout · guest arrives ${fmt(r.arrival)}`
}

const byNumber = (a: Row, b: Row) => a.room.id.localeCompare(b.room.id, undefined, { numeric: true })

export function board(s: State, now: Minutes): Board {
  const mine = s.rooms.filter((r) => r.assignee === s.user)
  const todo = mine.filter((r) => r.state === 'dirty' || r.state === 'in_progress')
  const live = (r: Room) => r.state === 'in_progress' || !isGreyed(r, now)

  const active = todo.filter(live).map((room) => ({ room, reason: reason(room, now) })).sort((a, b) => {
    const ta = tier(a.room, now)
    return ta - tier(b.room, now) || (ta === 0 ? a.room.arrival! - b.room.arrival! : 0) || byNumber(a, b)
  })
  // In progress beats her pick; either one becomes Next Up, the rest keep their order.
  let first = active.findIndex((r) => r.room.state === 'in_progress')
  if (first < 0) first = active.findIndex((r) => r.room.id === s.picked)
  if (first > 0) active.unshift(...active.splice(first, 1))

  return {
    active,
    greyed: todo.filter((r) => !live(r)).map((room) => ({ room, reason: reason(room, now) })).sort(byNumber),
    done: mine.filter((r) => DONE_WORD[r.state]).map((room) => ({ room, reason: DONE_WORD[room.state]! })).sort(byNumber),
  }
}

/** Holds first, then soonest arrival of the room's next guest, then oldest. */
export function samQueue(s: State): Task[] {
  const arrival = (t: Task) => s.rooms.find((r) => r.id === t.roomId)?.arrival ?? Infinity
  const soft = (t: Task) => (HOLDS.includes(t.category) ? 0 : 1)
  return s.tasks
    .filter((t) => t.status === 'open')
    .sort((a, b) => soft(a) - soft(b) || arrival(a) - arrival(b) || a.createdAt - b.createdAt)
}
