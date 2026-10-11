import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Store, Clock } from 'lucide-react'
import { elencoLocali, attivaLocale, descriviDisponibilita, SKIN, tipoDiPosto, type Locale } from '../lib/locali'
import { useToast } from '../components/Toast'

/* Elenco dei locali con lo stile personalizzato: acceso/spento con un
   tocco, e lo stato di adesso (aperto, fuori orario, spento). */
export default function Locali() {
  const navigate = useNavigate()
  const { error: toastError } = useToast()
  const [locali, setLocali] = useState<Locale[] | null>(null)

  const carica = () => elencoLocali().then(setLocali).catch(e => toastError(e.message))
  useEffect(() => { carica() }, [])

  async function interruttore(l: Locale) {
    try {
      await attivaLocale(l.id, !l.attivo)
      carica()
    } catch (e: any) { toastError(e.message) }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Locali</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Chi si avvicina vede la proposta di usare lo stile del locale, solo quando è attivo e aperto.</p>
        </div>
        <button onClick={() => navigate('/locali/new')} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm">
          <Plus className="w-4 h-4" />Nuovo locale
        </button>
      </div>

      {locali === null && <p className="text-sm text-gray-400">Caricamento…</p>}
      {locali?.length === 0 && <p className="text-sm text-gray-400">Nessun locale.</p>}

      <div className="grid gap-3">
        {locali?.map(l => {
          const stato = !l.attivo ? { t: 'Spento', c: 'bg-gray-100 dark:bg-gray-800 text-gray-500' }
            : l.aperto_ora ? { t: 'Visibile ora', c: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' }
            : { t: 'Fuori orario', c: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' }
          return (
            <div key={l.id} className="flex items-center gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <button onClick={() => navigate(`/locali/${l.id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <span className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-xl">
                  {l.tema?.emoji || <Store className="w-5 h-5 text-indigo-500" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-gray-900 dark:text-white truncate">{l.nome}{l.dove ? <span className="font-normal text-gray-500"> · {l.dove}</span> : null}</span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                    {(() => { const t = tipoDiPosto(l.tipo); return t ? `${t.categoria} · ${t.nome}` : SKIN.find(s => s.id === l.skin)?.nome ?? l.skin })()} · {l.raggio_m} m · <Clock className="w-3 h-3" /> {descriviDisponibilita(l)}
                  </span>
                </span>
              </button>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${stato.c}`}>{stato.t}</span>
              <button role="switch" aria-checked={l.attivo} onClick={() => interruttore(l)} title={l.attivo ? 'Spegni' : 'Accendi'}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${l.attivo ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${l.attivo ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
