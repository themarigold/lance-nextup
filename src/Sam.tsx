import { CATEGORY_LABEL, samQueue, taskReason } from './domain/rules'
import type { Action, Minutes, State } from './domain/types'
import { BigButton, Icon, PLATE } from './ui'

/** Maintenance: the problem to fix next, closed with one tap on Fixed. */
export function Sam({ s, now, act }: { s: State; now: Minutes; act: (a: Action) => void }) {
  const [next, ...rest] = samQueue(s)
  const room = next && s.rooms.find((r) => r.id === next.roomId)

  return (
    <>
      <section aria-label="Next up" className="px-4 pt-4 pb-5 border-b-2 border-black">
        <h2 className="text-lg font-semibold">Next up</h2>
        {next && room ? (
          <div className="mt-2 flex items-center gap-4">
            <div className={`shrink-0 grid place-items-center w-40 h-28 rounded-xl border-4 font-extrabold tabular-nums text-[64px] ${PLATE[room.state]}`}>
              {room.id}
            </div>
            <div>
              <p className="flex items-center gap-2 text-2xl font-bold"><Icon name={next.category} />{CATEGORY_LABEL[next.category]}</p>
              <p className="mt-1 text-lg leading-snug">{taskReason(s, next, now)}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-2xl font-semibold">No open problems</p>
        )}
      </section>

      <ul>
        {rest.map((t) => (
          <li key={t.id} className="min-h-16 flex items-center gap-4 px-4 border-b border-black/20">
            <span className="w-14 text-[22px] font-bold tabular-nums">{t.roomId}</span>
            <span className="flex items-center gap-2 text-lg font-semibold"><Icon name={t.category} />{CATEGORY_LABEL[t.category]}</span>
            <span className="flex-1 text-base text-muted text-right text-balance">{taskReason(s, t, now)}</span>
          </li>
        ))}
      </ul>

      {next && (
        <BigButton
          label={`Fixed ${next.roomId} · ${CATEGORY_LABEL[next.category]}`}
          onTap={() => act({ type: 'fix', taskId: next.id, at: Date.now() })}
        />
      )}
    </>
  )
}
