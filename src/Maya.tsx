import { board, CATEGORY_LABEL, holdCategories, idle, notices } from './domain/rules'
import type { Action, Minutes, State } from './domain/types'
import { BigButton, HoldChip, Icon, OccupancyChip, PLATE, StateChip } from './ui'

export function Maya({ s, now, act }: { s: State; now: Minutes; act: (a: Action) => void }) {
  const b = board(s, now)
  const [next, ...rest] = b.active
  const working = next?.room.state === 'in_progress'
  const at = Date.now

  return (
    <>
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
            <button className="mt-4 w-full h-14 rounded-2xl border-2 border-black text-xl font-semibold touch-manipulation active:bg-wash">
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
          onTap={() => act({ type: working ? 'finish' : 'start', id: crypto.randomUUID(), roomId: next.room.id, at: at() })}
        />
      )}
    </>
  )
}
