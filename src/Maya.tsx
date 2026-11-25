import { useState } from 'react'
import { board, CATEGORY_LABEL, holdCategories, idle, notices } from './domain/rules'
import type { Action, Category, Minutes, State } from './domain/types'
import { BigButton, HoldChip, Icon, OccupancyChip, PLATE, StateChip, useArmed } from './ui'

const CATEGORIES: Category[] = ['ac', 'plumbing', 'light', 'broken']

/** Tap 2 of the report: one tap files it. No typing, no send button; the toast's Undo is the safety net. */
function ReportSheet({ roomId, onPick, onClose }: { roomId: string; onPick: (c: Category) => void; onClose: () => void }) {
  // The sheet opens under the finger that tapped Report: a double tap must not file a report by itself.
  const armed = useArmed(roomId)
  return (
    // Sits over the Next Up panel, not the big button, so a double tap can't land on Start.
    <div role="dialog" aria-label={`Problem in ${roomId}`} className="fixed inset-x-0 top-14 bottom-0 z-40 bg-white px-4 pt-3">
      <div className="flex items-center">
        <h2 className="flex-1 text-2xl font-bold">Problem in {roomId}</h2>
        <button aria-label="Close" onClick={onClose} className="size-12 text-2xl touch-manipulation">✕</button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            disabled={!armed}
            onClick={() => onPick(c)}
            className="h-32 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-black text-xl font-semibold touch-manipulation active:bg-wash disabled:text-muted disabled:border-muted"
          >
            <Icon name={c} big />
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <p className="mt-4 text-lg text-muted">Tap one. Maintenance gets it right away.</p>
    </div>
  )
}

export function Maya({ s, now, act }: { s: State; now: Minutes; act: (a: Action) => void }) {
  const b = board(s, now)
  const [next, ...rest] = b.active
  const working = next?.room.state === 'in_progress'
  const at = Date.now
  const [sheet, setSheet] = useState(false)
  // After a report the sheet closes and Report is under the same finger: a double tap on a category
  // must not reopen the sheet (she'd think it didn't send). Disarms only when the task list changes,
  // not on load or a user switch.
  const reportArmed = useArmed(`${s.tasks.length}`, { armedAtStart: true })

  return (
    <>
      {sheet && next && (
        <ReportSheet
          roomId={next.room.id}
          onClose={() => setSheet(false)}
          onPick={(category) => {
            setSheet(false) // closes on the first tap, so a double tap can't file two reports
            act({ type: 'report', id: crypto.randomUUID(), roomId: next.room.id, category, at: at() })
          }}
        />
      )}
      {notices(s).map(({ task, text }) => (
        <div key={task.id} className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border-2 border-black p-1 pl-4 text-lg font-semibold">
          <span className="flex-1">✓ {text}</span>
          <button aria-label="Dismiss" onClick={() => act({ type: 'dismiss', taskId: task.id, at: at() })} className="size-12 text-2xl touch-manipulation">
            ✕
          </button>
        </div>
      ))}

      <section aria-label="Next up" className="px-4 pt-4 pb-5 border-b-2 border-black">
        <h2 className="text-lg font-semibold">Next up</h2>
        {next ? (
          <>
            <div className="mt-2 flex items-center gap-4">
              <div
                key={next.room.id}
                className={`shrink-0 grid place-items-center w-40 h-28 rounded-xl border-4 font-extrabold tabular-nums animate-[plate-in_150ms_ease-out] ${next.room.id.length > 3 ? "text-[52px]" : "text-[64px]"} ${PLATE[next.room.state]}`}
              >
                {next.room.id}
              </div>
              <div>
                <p className="text-2xl font-semibold leading-tight">{next.reason}</p>
                {next.room.vip && <p className="mt-1 text-lg font-bold">★ VIP</p>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <OccupancyChip occupancy={next.room.occupancy} />
              <StateChip state={next.room.state} />
              {holdCategories(s.tasks, next.room.id).map((c, i) => (
                <HoldChip key={i} category={c} text={`On hold · ${CATEGORY_LABEL[c]}`} />
              ))}
            </div>
            <button
              disabled={!reportArmed}
              onClick={() => setSheet(true)}
              className="mt-4 w-full h-14 rounded-2xl border-2 border-black text-xl font-semibold touch-manipulation active:bg-wash disabled:text-muted disabled:border-muted"
            >
              Report problem · {next.room.id}
            </button>
          </>
        ) : (
          <p className="mt-2 text-2xl font-semibold leading-tight">{idle(b)}</p>
        )}
      </section>

      <ul>
        {rest.map(({ room, reason }) => (
          <li key={room.id} className="border-b border-black/20">
            <button
              onClick={() => act({ type: 'pick', roomId: room.id, at: at() })}
              className="w-full min-h-16 flex items-center gap-4 px-4 text-left touch-manipulation active:bg-wash"
            >
              <span className="w-14 text-[22px] font-bold tabular-nums">{room.id}</span>
              <span className="flex-1 text-lg text-balance">{reason}</span>
              {holdCategories(s.tasks, room.id).map((c, i) => <Icon key={i} name={c} label={`On hold · ${CATEGORY_LABEL[c]}`} />)}
            </button>
          </li>
        ))}
        {b.greyed.map(({ room, reason }) => (
          <li key={room.id} className="min-h-16 flex items-center gap-4 px-4 bg-wash text-muted border-b border-black/10">
            <span className="w-14 text-[22px] font-bold tabular-nums">{room.id}</span>
            <span className="flex-1 text-lg text-balance">{reason}</span>
          </li>
        ))}
      </ul>

      <details className="px-4">
        <summary className="min-h-12 flex items-center text-lg font-semibold">Done ({b.done.length})</summary>
        <ul>
          {b.done.map(({ room, reason }) => (
            <li key={room.id} className="min-h-12 flex items-center gap-4">
              <span className="w-14 text-[22px] font-bold tabular-nums">{room.id}</span>
              <span className="flex-1 text-lg text-balance">{reason}</span>
            </li>
          ))}
        </ul>
      </details>

      {next && (
        <BigButton
          label={`${working ? 'Finish' : 'Start'} ${next.room.id}`}
          version={s.log.length}
          onTap={() => act({ type: working ? 'finish' : 'start', id: crypto.randomUUID(), roomId: next.room.id, at: at() })}
        />
      )}
    </>
  )
}
