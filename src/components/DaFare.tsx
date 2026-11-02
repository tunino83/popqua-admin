import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flag, AlertTriangle, Lock, Store, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cls } from './ui'

/* La prima cosa della prima pagina: cosa c'e' da fare, poi i numeri
   della settimana confrontati con quella prima. Tutto da una chiamata
   (admin_riepilogo, migrazione 20261102090000). Se la funzione non c'e'
   ancora sul database si contano almeno le segnalazioni. */

interface Riepilogo {
  segnalazioni_aperte: number
  errori_24h: number
  capsule_in_scadenza: number
  locali_senza_gestore: number
  messaggi_oggi: number
  messaggi_7: number
  messaggi_7_prima: number
  utenti_nuovi_7: number
  utenti_nuovi_7_prima: number
}

export function useRiepilogo() {
  const [r, setR] = useState<Partial<Riepilogo> | null>(null)
  useEffect(() => {
    supabase.rpc('admin_riepilogo').then(async ({ data, error }) => {
      if (!error && data) { setR(data as Riepilogo); return }
      const { data: s } = await supabase.rpc('admin_segnalazioni', { p_tutte: false })
      setR({ segnalazioni_aperte: Array.isArray(s) ? s.length : 0 })
    })
  }, [])
  return r
}

export function DaFare({ r }: { r: Partial<Riepilogo> | null }) {
  const cose = [
    { n: r?.segnalazioni_aperte, testo: (n: number) => `${n === 1 ? 'segnalazione' : 'segnalazioni'} da decidere`, a: '/segnalazioni', icona: Flag, urgente: true },
    { n: r?.errori_24h, testo: (n: number) => `${n === 1 ? 'errore' : 'errori'} dell'app nelle ultime 24 ore`, a: '/diagnostica', icona: AlertTriangle, urgente: true },
    { n: r?.capsule_in_scadenza, testo: (n: number) => `${n === 1 ? 'capsula scade' : 'capsule scadono'} entro 7 giorni`, a: '/capsule', icona: Lock },
    { n: r?.locali_senza_gestore, testo: (n: number) => `${n === 1 ? 'locale attivo' : 'locali attivi'} senza gestore`, a: '/locali', icona: Store },
  ].filter(c => (c.n ?? 0) > 0)

  if (!r) return <div className={`${cls.riquadro} p-5 h-24 animate-pulse`} />
  if (!cose.length) return (
    <div className={`${cls.riquadro} p-5 flex items-center gap-3`}>
      <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
      <p className="text-sm text-gray-700 dark:text-gray-200"><span className="font-semibold">Niente da fare.</span> Nessuna segnalazione aperta, nessun errore recente.</p>
    </div>
  )
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cose.map(({ n, testo, a, icona: Icona, urgente }) => (
        <Link key={a} to={a} className={`${cls.riquadro} p-4 flex items-center gap-4 hover:border-gray-300 dark:hover:border-gray-700 transition-colors`}>
          <span className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${urgente ? 'bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
            <Icona className="w-5 h-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-2xl font-bold tabular-nums text-gray-900 dark:text-white leading-none">{n}</span>
            <span className="block text-sm text-gray-500 dark:text-gray-400 mt-1">{testo(n!)}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

function Variazione({ ora, prima }: { ora: number; prima: number }) {
  if (!prima && !ora) return <span className="text-xs text-gray-400">—</span>
  const d = prima ? Math.round(((ora - prima) / prima) * 100) : 100
  const Icona = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus
  const colore = d > 0 ? 'text-emerald-600 dark:text-emerald-400' : d < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${colore}`}>
      <Icona className="w-3.5 h-3.5" />{d > 0 ? '+' : ''}{d}% <span className="font-normal text-gray-400">sulla settimana prima</span>
    </span>
  )
}

export function Settimana({ r }: { r: Partial<Riepilogo> | null }) {
  if (r?.messaggi_7 == null) return null
  const voci = [
    { nome: 'Messaggi oggi', n: r.messaggi_oggi ?? 0 },
    { nome: 'Messaggi in 7 giorni', n: r.messaggi_7, prima: r.messaggi_7_prima ?? 0 },
    { nome: 'Nuovi utenti in 7 giorni', n: r.utenti_nuovi_7 ?? 0, prima: r.utenti_nuovi_7_prima ?? 0 },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {voci.map(v => (
        <div key={v.nome} className={`${cls.riquadro} p-4`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">{v.nome}</p>
          <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white mt-1">{v.n.toLocaleString('it-IT')}</p>
          {v.prima != null && <div className="mt-1"><Variazione ora={v.n} prima={v.prima} /></div>}
        </div>
      ))}
    </div>
  )
}
