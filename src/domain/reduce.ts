import { isGreyed } from './rules'
import type { Action, CleanState, Minutes, State, Task } from './types'

const UNDOABLE: Action['type'][] = ['start', 'finish', 'report']

/** The only way state changes. A rejected action returns `s` itself and is not logged. */
export function reduce(s: State, a: Action, now: Minutes): State {
  const next = apply(s, a, now)
  if (!next) return s
  // Only Start, Finish and Report keep their undo copy; every other accepted action clears it.
  return { ...next, before: UNDOABLE.includes(a.type) ? next.before : undefined, log: [...s.log, a] }
}

function apply(s: State, a: Action, now: Minutes): State | undefined {
  const room = 'roomId' in a ? s.rooms.find((r) => r.id === a.roomId && r.assignee === s.user) : undefined
  const task = 'taskId' in a ? s.tasks.find((t) => t.id === a.taskId) : undefined
  const busy = s.rooms.some((r) => r.assignee === s.user && r.state === 'in_progress')
  const canStart = room?.state === 'dirty' && !busy && !isGreyed(room, now)

  const setRoom = (state: CleanState) => s.rooms.map((r) => (r === room ? { ...r, state } : r))
  const setTask = (patch: Partial<Task>) => s.tasks.map((t) => (t === task ? { ...t, ...patch } : t))
  const snap = (actionId: string) => ({ actionId, rooms: s.rooms, tasks: s.tasks, picked: s.picked })

  switch (a.type) {
    case 'pick':
      return canStart ? { ...s, picked: a.roomId } : undefined
    case 'start':
      return canStart ? { ...s, rooms: setRoom('in_progress'), picked: undefined, before: snap(a.id) } : undefined
    case 'finish':
      return room?.state === 'in_progress' ? { ...s, rooms: setRoom('clean'), before: snap(a.id) } : undefined
    case 'report': {
      if (!room || s.tasks.some((t) => t.id === a.id)) return undefined
      const t: Task = { id: a.id, roomId: a.roomId, category: a.category, reportedBy: s.user, createdAt: a.at, status: 'open' }
      return { ...s, tasks: [...s.tasks, t], before: snap(a.id) }
    }
    case 'undo': {
      if (s.before?.actionId !== a.actionId) return undefined
      const { rooms, tasks, picked } = s.before
      return { ...s, rooms, tasks, picked }
    }
    case 'fix':
      return task?.status === 'open' ? { ...s, tasks: setTask({ status: 'fixed' }) } : undefined
    case 'dismiss':
      return task?.status === 'fixed' && !task.noticeDismissed ? { ...s, tasks: setTask({ noticeDismissed: true }) } : undefined
    case 'switchUser':
      return a.to !== s.user ? { ...s, user: a.to } : undefined
    default:
      return undefined // stretch actions (needsPart, stop, open) are rejected until built
  }
}

/** Saved state from localStorage, or `fallback` if it's missing, unreadable or the wrong shape. */
export function load(raw: string | null, fallback: State): State {
  try {
    const s = JSON.parse(raw ?? '')
    const ok = typeof s?.user === 'string' && [s.rooms, s.tasks, s.log].every(Array.isArray)
    // The undo copy is dropped: an Undo must never come back after a reload.
    return ok ? { ...s, before: undefined } : fallback
  } catch {
    return fallback
  }
}
