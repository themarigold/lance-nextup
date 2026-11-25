import { isGreyed } from './rules'
import type { Action, CleanState, Minutes, State, Task } from './types'

/** The only way state changes. A rejected action returns `s` itself and is not logged. */
export function reduce(s: State, a: Action, now: Minutes): State {
  const next = apply(s, a, now)
  return next ? { ...next, log: [...s.log, a] } : s
}

function apply(s: State, a: Action, now: Minutes): State | undefined {
  const room = 'roomId' in a ? s.rooms.find((r) => r.id === a.roomId && r.assignee === s.user) : undefined
  const task = 'taskId' in a ? s.tasks.find((t) => t.id === a.taskId) : undefined
  const busy = s.rooms.some((r) => r.assignee === s.user && r.state === 'in_progress')
  const canStart = room?.state === 'dirty' && !busy && !isGreyed(room, now)

  const setRoom = (state: CleanState) => s.rooms.map((r) => (r === room ? { ...r, state } : r))
  const setTask = (patch: Partial<Task>) => s.tasks.map((t) => (t === task ? { ...t, ...patch } : t))
  // Start, Finish and Report can be undone; every other accepted action clears the copy.
  const snap = (actionId: string) => ({ actionId, rooms: s.rooms, tasks: s.tasks, picked: s.picked })
  const cleared: State = { ...s, before: undefined }

  switch (a.type) {
    case 'pick':
      return canStart ? { ...cleared, picked: a.roomId } : undefined
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
      return { ...s, rooms, tasks, picked, before: undefined }
    }
    case 'fix':
      return task?.status === 'open' ? { ...cleared, tasks: setTask({ status: 'fixed' }) } : undefined
    case 'dismiss':
      return task?.status === 'fixed' && !task.noticeDismissed ? { ...cleared, tasks: setTask({ noticeDismissed: true }) } : undefined
    case 'switchUser':
      return a.to !== s.user ? { ...cleared, user: a.to } : undefined
    default:
      return undefined // stretch actions (needsPart, stop, open) are rejected until built
  }
}
