import { useEffect, useState } from 'react'
import type { Category, CleanState, Occupancy } from './domain/types'

// Class names written out in full so Tailwind v4's scanner sees them.
export const PLATE: Record<CleanState, string> = {
  dirty: 'bg-white text-black border-black',
  in_progress: 'bg-progress text-black border-progress',
  clean: 'bg-clean text-white border-clean',
  inspected: 'bg-inspected text-white border-inspected',
}
const SWATCH: Record<CleanState, string> = {
  dirty: 'bg-white border-2 border-black',
  in_progress: 'bg-progress',
  clean: 'bg-clean',
  inspected: 'bg-inspected',
}
export const STATE_WORD: Record<CleanState, string> = { dirty: 'Dirty', in_progress: 'In progress', clean: 'Clean', inspected: 'Inspected' }
// Plain line icons in currentColor: colour only ever means cleaning state, and emoji differ across phones.
const PATHS = {
  door: <><path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18" /><circle cx="14.5" cy="12" r="1" /></>,
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  ac: <path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M9 4l3 2 3-2M9 20l3-2 3 2" />,
  plumbing: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  light: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />,
  broken: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z" />,
}
export type IconName = keyof typeof PATHS

export const Icon = ({ name, label, big }: { name: IconName; label?: string; big?: boolean }) => (
  <svg
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    className={`shrink-0 ${big ? 'size-10' : 'size-5'}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
  >
    {PATHS[name]}
  </svg>
)

const OCCUPANCY: Record<Occupancy, [IconName, string]> = { vacant: ['door', 'Vacant'], occupied: ['person', 'Occupied'] }

const chip = "inline-flex items-center gap-1.5 h-10 px-2.5 rounded-full border-2 border-black text-base font-semibold"

export const Swatch = ({ state }: { state: CleanState }) => <span className={`size-4 shrink-0 rounded-full ${SWATCH[state]}`} />

export const StateChip = ({ state }: { state: CleanState }) => (
  <span className={chip}><Swatch state={state} />{STATE_WORD[state]}</span>
)

export const OccupancyChip = ({ occupancy }: { occupancy: Occupancy }) => (
  <span className={chip}><Icon name={OCCUPANCY[occupancy][0]} />{OCCUPANCY[occupancy][1]}</span>
)

export const HoldChip = ({ category, text }: { category: Category; text: string }) => (
  <span className="inline-flex items-center gap-1.5 h-10 px-2.5 rounded-full bg-black text-white text-base font-semibold"><Icon name={category} />{text}</span>
)

/**
 * True once `key` has stayed the same for 500 ms. Buttons stay disabled until then, so the second tap of a
 * double tap can't land on whatever just appeared under the finger. Pass a key that changes on every
 * accepted action (e.g. the log length), not just the label: after an Undo, or a second task on the same
 * room, the label comes back unchanged but the guard must still re-arm.
 */
export function useArmed(key: string, { armedAtStart = false } = {}) {
  // armedAtStart: usable as soon as it appears; only a later change of `key` disarms it.
  const [armedFor, setArmedFor] = useState<string | undefined>(armedAtStart ? key : undefined)
  useEffect(() => {
    const t = setTimeout(() => setArmedFor(key), 500)
    return () => clearTimeout(t)
  }, [key])
  return armedFor === key
}

/** Full-width action that always names its room. Re-arms (disabled 500 ms) whenever `version` or the label changes. */
export function BigButton({ label, version, onTap }: { label: string; version: number; onTap: () => void }) {
  const armed = useArmed(`${version}|${label}`)
  return (
    <div className="sticky bottom-0 mt-auto bg-white border-t-2 border-black px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <button
        disabled={!armed}
        onClick={onTap}
        className="w-full h-[72px] rounded-2xl bg-black text-white text-2xl font-bold touch-manipulation active:bg-neutral-700 disabled:bg-neutral-400"
      >
        {label}
      </button>
    </div>
  )
}

export function Toast({ text, onUndo }: { text: string; onUndo: () => void }) {
  return (
    // Covers the demo bar, never the Next Up panel or the big button.
    <div role="status" className="fixed top-0 inset-x-0 z-30 h-14 flex items-center gap-3 bg-black text-white pl-4 pr-1 text-lg font-semibold leading-tight">
      <span className="flex-1 truncate">{text}</span>
      <button onClick={onUndo} className="h-12 px-5 rounded-xl border-2 border-white font-bold touch-manipulation active:bg-neutral-800">
        Undo
      </button>
    </div>
  )
}
