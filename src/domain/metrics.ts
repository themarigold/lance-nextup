import type { Action, UserId } from './types'

type PerUser = Partial<Record<UserId, number[]>>
export interface Metrics { finishToStart: PerUser; openToStart: PerUser; undoRate: number }

/**
 * The spec's three metrics, in ms, from the append-only log. Undone actions are left out of the times.
 * Actions don't carry a user, so the user is replayed from `firstUser` and each switchUser; a switch
 * counts as opening the app as that user. Walking time is included: compare before vs after, not absolutes.
 */
export function metrics(log: Action[], firstUser: UserId): Metrics {
  const undone = new Set(log.flatMap((a) => (a.type === 'undo' ? [a.actionId] : [])))
  const finishToStart: PerUser = {}
  const openToStart: PerUser = {}
  const openedAt: Partial<Record<UserId, number>> = {}
  const finishedAt: Partial<Record<UserId, number>> = {}
  const push = (m: PerUser, u: UserId, ms: number) => (m[u] ??= []).push(ms)
  let user = firstUser
  let moves = 0 // Starts and Finishes
  let undoneMoves = 0

  for (const a of log) {
    if (a.type === 'switchUser') user = a.to
    if (a.type === 'switchUser' || a.type === 'open') openedAt[user] = a.at
    if (a.type !== 'start' && a.type !== 'finish') continue
    moves++
    if (undone.has(a.id)) {
      undoneMoves++
      continue
    }
    if (a.type === 'finish') {
      finishedAt[user] = a.at
      continue
    }
    const opened = openedAt[user]
    const finished = finishedAt[user]
    if (opened !== undefined) push(openToStart, user, a.at - opened)
    if (finished !== undefined) push(finishToStart, user, a.at - finished)
    openedAt[user] = finishedAt[user] = undefined
  }

  return { finishToStart, openToStart, undoRate: moves ? undoneMoves / moves : 0 }
}
