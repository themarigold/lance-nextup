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

/** Categories holding the room: its AC or Plumbing tasks that aren't fixed. */
export const holdCategories = (tasks: Task[], roomId: string): Category[] =>
  tasks.filter((t) => t.roomId === roomId && t.status !== 'fixed' && HOLDS.includes(t.category)).map((t) => t.category)

export const isOnHold = (tasks: Task[], roomId: string) => holdCategories(tasks, roomId).length > 0

/** Categories already with Sam for this room (open or waiting for a part): the sheet shows them as Reported. */
export const reportedCategories = (tasks: Task[], roomId: string): Category[] =>
  tasks.filter((t) => t.roomId === roomId && t.status !== 'fixed').map((t) => t.category)

/** What Sam did with it: "AC fixed by Sam" / "AC needs a part". */
const outcome = (t: Task) => `${CATEGORY_LABEL[t.category]} ${t.status === 'fixed' ? 'fixed by Sam' : 'needs a part'}`

/** Banners: her reports Sam fixed or is waiting on a part for, until she dismisses them. */
export const notices = (s: State) =>
  s.tasks
    .filter((t) => t.reportedBy === s.user && t.status !== 'open' && !t.noticeDismissed)
    .map((task) => ({ task, text: `${task.roomId} ${outcome(task)}` }))

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
    done: mine.filter((r) => DONE_WORD[r.state]).map((room) => ({ room, reason: doneReason(s, room) })).sort(byNumber),
  }
}

// "Clean · On hold · AC" while held, then "Clean · AC needs a part" / "Clean · AC fixed by Sam".
// The note stays on the row after she dismisses the banner.
function doneReason(s: State, room: Room) {
  const notes = s.tasks.filter((t) => t.roomId === room.id).flatMap((t) => {
    if (t.status === 'open') return HOLDS.includes(t.category) ? [`On hold · ${CATEGORY_LABEL[t.category]}`] : []
    return t.status === 'needs_part' || t.reportedBy === s.user ? [outcome(t)] : []
  })
  return [DONE_WORD[room.state]!, ...notes].join(' · ')
}

export const roomsLeft = (b: Board) => b.active.length + b.greyed.length

const opensAt = (r: Room) => Math.max(r.dndUntil ?? -1, r.lateCheckout ?? -1)

/** What the Next Up panel says when there's nothing to start; undefined when there is. */
export function idle(b: Board): string | undefined {
  if (b.active.length) return undefined
  if (!b.greyed.length) return 'All your rooms are done'
  const first = b.greyed.reduce((a, r) => (opensAt(r.room) < opensAt(a.room) ? r : a))
  return `Nothing to start. ${first.room.id} opens at ${fmt(opensAt(first.room))}`
}

const NAME: Record<Task['reportedBy'], string> = { maya: 'Maya', sam: 'Sam', priya: 'Priya' }

/** Sam's card line: "Room on hold · guest arrives 11:30 am · from Maya". The hold comes from open tasks. */
export function taskReason(s: State, t: Task, now: Minutes): string {
  const arrival = s.rooms.find((r) => r.id === t.roomId)?.arrival
  const text = [
    t.status === 'needs_part' && 'waiting for a part',
    isOnHold(s.tasks, t.roomId) && 'room on hold',
    arrival !== undefined && `${arrival <= now ? 'guest waiting since' : 'guest arrives'} ${fmt(arrival)}`,
    `from ${NAME[t.reportedBy]}`,
  ].filter(Boolean).join(' · ')
  return text[0].toUpperCase() + text.slice(1)
}

/** Holds first, then soonest arrival of the room's next guest, then oldest; tasks waiting on a part go last. */
export function samQueue(s: State): Task[] {
  const arrival = (t: Task) => s.rooms.find((r) => r.id === t.roomId)?.arrival ?? Infinity
  const soft = (t: Task) => (HOLDS.includes(t.category) ? 0 : 1)
  const waiting = (t: Task) => (t.status === 'needs_part' ? 1 : 0)
  const queue = s.tasks
    .filter((t) => t.status !== 'fixed')
    .sort((a, b) => waiting(a) - waiting(b) || soft(a) - soft(b) || arrival(a) - arrival(b) || a.createdAt - b.createdAt)
  // His pick becomes Next Up; the rest keep their order (same as Maya's pick).
  const picked = queue.findIndex((t) => t.id === s.pickedTask)
  if (picked > 0) queue.unshift(...queue.splice(picked, 1))
  return queue
}
