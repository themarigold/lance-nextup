import { useEffect, useReducer, useState } from 'react'
import { load, reduce } from './domain/reduce'
import { board, CATEGORY_LABEL, fmt, roomsLeft } from './domain/rules'
import { NOW, seed } from './domain/seed'
import type { Action, State } from './domain/types'
import { Maya } from './Maya'
import { Sam } from './Sam'
import { Toast } from './ui'

const KEY = 'lance-nextup:v1'

function initial(): State {
  try {
    return load(localStorage.getItem(KEY), seed)
  } catch {
    return seed // storage blocked (private mode, etc.)
  }
}

function toastText(a: Action, next: State): string | undefined {
  if (a.type === 'start') return `Started ${a.roomId}`
  if (a.type === 'report') return `${CATEGORY_LABEL[a.category]} reported on ${a.roomId}`
  if (a.type === 'finish') {
    const n = roomsLeft(board(next, NOW))
    return `${a.roomId} clean · ${n} left` // one line beside Undo
  }
}

export default function App() {
  const [s, dispatch] = useReducer((st: State, a: Action) => reduce(st, a, NOW), undefined, initial)
  const [toast, setToast] = useState<{ id: string; text: string }>()

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      // storage full or blocked: the app keeps working, it just won't survive a reload
    }
  }, [s])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(undefined), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const act = (a: Action) => {
    const next = reduce(s, a, NOW)
    if (next === s) return
    dispatch(a)
    // Next Up just changed: bring its plate back into view, below the toast.
    if (a.type === 'finish' || a.type === 'pick') window.scrollTo(0, 0)
    const text = 'id' in a ? toastText(a, next) : undefined
    if (text && 'id' in a) setToast({ id: a.id, text })
  }

  // One toast at a time; it vanishes as soon as its action is no longer the one Undo would reverse.
  const live = toast && s.before?.actionId === toast.id ? toast : undefined

  return (
    <main className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-white border-b-2 border-black px-3 h-14">
        <div className="flex rounded-full border-2 border-black p-0.5">
          {(['maya', 'sam'] as const).map((u) => (
            <button
              key={u}
              onClick={() => act({ type: 'switchUser', to: u, at: Date.now() })}
              className={`h-12 px-4 rounded-full text-lg font-semibold capitalize touch-manipulation ${s.user === u ? 'bg-black text-white' : ''}`}
            >
              {u}
            </button>
          ))}
        </div>
        <span className="ml-auto text-lg font-semibold tabular-nums">{fmt(NOW)}</span>
      </header>
      {live && <Toast text={live.text} onUndo={() => act({ type: 'undo', actionId: live.id, at: Date.now() })} />}
      {s.user === 'maya' ? (
        <Maya s={s} now={NOW} act={act} />
      ) : (
        <Sam s={s} now={NOW} act={act} />
      )}
    </main>
  )
}
