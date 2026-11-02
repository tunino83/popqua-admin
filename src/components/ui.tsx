import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

/* I pezzi comuni del pannello. Prima ogni pagina ricostruiva riquadri,
   pulsanti e campi con lunghe stringhe di classi, e ognuna a modo suo
   (sei colori di pulsante, cinque arrotondamenti, sei titoli diversi).
   Qui c'e' una versione sola di ciascuno. */

export const cls = {
  riquadro: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl',
  campo: 'w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500',
  etichetta: 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1',
}

type Variante = 'primario' | 'secondario' | 'pericolo' | 'quieto'
const VARIANTI: Record<Variante, string> = {
  primario: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm',
  secondario: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
  pericolo: 'border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950',
  quieto: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
}
export const bottone = (v: Variante = 'primario', piccolo = false) =>
  `inline-flex items-center justify-center gap-1.5 ${piccolo ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'} font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none ${VARIANTI[v]}`

/* Titolo della pagina, con il ritorno all'elenco e le azioni a destra.
   E' l'unico titolo: l'intestazione in alto non ne ripete un altro. */
export function Intestazione({ titolo, sottotitolo, indietro, azioni }: {
  titolo: ReactNode; sottotitolo?: ReactNode; indietro?: string; azioni?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-2 min-w-0">
        {indietro && (
          <Link to={indietro} aria-label="Torna all'elenco" className="p-1.5 -ml-1.5 mt-0.5 rounded-lg text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{titolo}</h1>
          {sottotitolo && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{sottotitolo}</p>}
        </div>
      </div>
      {azioni && <div className="flex items-center gap-2 flex-wrap">{azioni}</div>}
    </div>
  )
}

export function Sezione({ titolo, nota, azioni, children, className = '' }: {
  titolo?: ReactNode; nota?: ReactNode; azioni?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`${cls.riquadro} p-5 space-y-4 ${className}`}>
      {(titolo || azioni) && (
        <div className="flex items-start justify-between gap-3">
          <div>
            {titolo && <h2 className="text-base font-semibold text-gray-900 dark:text-white">{titolo}</h2>}
            {nota && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{nota}</p>}
          </div>
          {azioni}
        </div>
      )}
      {children}
    </section>
  )
}

/* Interruttore vero (si usa da tastiera e dice il suo stato), al posto
   dei div cliccabili. */
export function Interruttore({ acceso, onCambia, etichetta, nota }: {
  acceso: boolean; onCambia: (v: boolean) => void; etichetta: ReactNode; nota?: ReactNode
}) {
  return (
    <button type="button" role="switch" aria-checked={acceso} onClick={() => onCambia(!acceso)}
      className="w-full flex items-center justify-between gap-3 text-left">
      <span>
        <span className="block text-sm text-gray-800 dark:text-gray-200">{etichetta}</span>
        {nota && <span className="block text-xs text-gray-500 dark:text-gray-400">{nota}</span>}
      </span>
      <span className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${acceso ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${acceso ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}

export function Vuoto({ icona: Icona, titolo, testo, azione }: {
  icona?: React.ComponentType<{ className?: string }>; titolo: string; testo?: string; azione?: ReactNode
}) {
  return (
    <div className="text-center py-12 px-4">
      {Icona && <Icona className="w-8 h-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />}
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{titolo}</p>
      {testo && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{testo}</p>}
      {azione && <div className="mt-4">{azione}</div>}
    </div>
  )
}

/* Schede: una barra di pulsanti con lo stato per i lettori di schermo. */
export function Schede<T extends string>({ schede, attiva, onScegli }: {
  schede: { id: T; nome: string; conta?: number }[]; attiva: T; onScegli: (id: T) => void
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800 -mx-1 px-1">
      {schede.map(s => (
        <button key={s.id} role="tab" aria-selected={s.id === attiva} type="button" onClick={() => onScegli(s.id)}
          className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${s.id === attiva
            ? 'border-brand-600 text-gray-900 dark:text-white'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
          {s.nome}{s.conta != null && <span className="ml-1.5 text-xs text-gray-400">{s.conta}</span>}
        </button>
      ))}
    </div>
  )
}

/* ── Conferme ──────────────────────────────────────────────────────
   Al posto di window.confirm: una finestra nello stile del pannello,
   con il pulsante giusto (rosso per eliminare). Si usa come prima:
   `if (!(await conferma({ ... }))) return`. */

interface Richiesta { titolo: string; testo?: string; conferma?: string; pericolo?: boolean }
const ContestoConferma = createContext<(r: Richiesta) => Promise<boolean>>(async () => false)

export function ConfermaProvider({ children }: { children: ReactNode }) {
  const [r, setR] = useState<Richiesta | null>(null)
  const risolvi = useRef<(v: boolean) => void>(() => {})
  const okRef = useRef<HTMLButtonElement>(null)

  const chiedi = useCallback((richiesta: Richiesta) => new Promise<boolean>(ok => {
    risolvi.current = ok
    setR(richiesta)
  }), [])
  const chiudi = (v: boolean) => { risolvi.current(v); setR(null) }

  useEffect(() => {
    if (!r) return
    okRef.current?.focus()
    const tasto = (e: KeyboardEvent) => { if (e.key === 'Escape') chiudi(false) }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  }, [r])

  return (
    <ContestoConferma.Provider value={chiedi}>
      {children}
      {r && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/50" onClick={() => chiudi(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="conferma-titolo" onClick={e => e.stopPropagation()}
            className={`${cls.riquadro} w-full max-w-sm p-5 shadow-2xl`}>
            <div className="flex gap-3">
              {r.pericolo && <span className="flex-shrink-0 w-9 h-9 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></span>}
              <div>
                <h2 id="conferma-titolo" className="text-base font-semibold text-gray-900 dark:text-white">{r.titolo}</h2>
                {r.testo && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{r.testo}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className={bottone('secondario')} onClick={() => chiudi(false)}>Annulla</button>
              <button ref={okRef} type="button" onClick={() => chiudi(true)}
                className={r.pericolo ? `${bottone('primario')} !bg-red-600 hover:!bg-red-700` : bottone('primario')}>
                {r.conferma ?? 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ContestoConferma.Provider>
  )
}

export const useConferma = () => useContext(ContestoConferma)

/* Il tema scuro si ricorda e, la prima volta, segue il sistema. */
export function useTemaScuro(): [boolean, () => void] {
  const [scuro, setScuro] = useState(() => {
    try {
      const s = localStorage.getItem('tema')
      if (s) return s === 'scuro'
    } catch { /* niente memoria: si segue il sistema */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', scuro)
    try { localStorage.setItem('tema', scuro ? 'scuro' : 'chiaro') } catch { /* pazienza */ }
  }, [scuro])
  return [scuro, () => setScuro(s => !s)]
}
