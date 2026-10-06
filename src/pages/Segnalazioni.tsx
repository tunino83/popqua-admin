import { useEffect, useState } from 'react'
import { RefreshCw, EyeOff, Eye, Trash2, Flag, UserX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'

/* La coda delle segnalazioni.
 *
 * Alla terza segnalazione il messaggio sparisce da solo; qui si decide cosa
 * farne davvero. Ripristinarlo azzera il conteggio, e le segnalazioni
 * precedenti non contano piu' (restano visibili con "Mostra anche le
 * decise"). Nasconderlo vale anche sotto le tre segnalazioni. Eliminarlo e'
 * definitivo. */

interface Segnalato {
  id: string
  text: string
  title: string | null
  image_url: string | null
  username: string | null
  display_nickname: string | null
  is_anonymous: boolean
  author_id: string | null
  created_at: string
  expires_at: string
  report_count: number
  is_hidden_by_reports: boolean
  moderazione: 'ripristinato' | 'nascosto' | null
  moderato_il: string | null
  motivi: string[]
  ultima_segnalazione: string
}

type Azione = 'ripristina' | 'nascondi' | 'elimina'

function quando(d: string) {
  return new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Segnalazioni() {
  const [righe, setRighe] = useState<Segnalato[]>([])
  const [caricando, setCaricando] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [tutte, setTutte] = useState(false)
  const [inCorso, setInCorso] = useState<string | null>(null)
  const { success, error: erroreToast } = useToast()

  async function carica() {
    setCaricando(true); setErrore(null)
    const { data, error } = await supabase.rpc('admin_segnalazioni', { p_tutte: tutte })
    if (error) setErrore(error.message)
    else setRighe((data ?? []) as Segnalato[])
    setCaricando(false)
  }

  useEffect(() => { carica() }, [tutte])

  async function modera(m: Segnalato, azione: Azione) {
    if (azione === 'elimina' && !window.confirm('Eliminare il messaggio? Non si torna indietro.')) return
    setInCorso(m.id)
    const { error } = await supabase.rpc('admin_modera', { p_message_id: m.id, p_azione: azione })
    setInCorso(null)
    if (error) { erroreToast(error.message); return }
    success(azione === 'ripristina' ? 'Messaggio ripristinato' : azione === 'nascondi' ? 'Messaggio nascosto' : 'Messaggio eliminato')
    carica()
  }

  const daDecidere = righe.filter(r => !r.moderazione || new Date(r.ultima_segnalazione) > new Date(r.moderato_il ?? 0)).length

  return (
    <div className="space-y-4">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Segnalazioni</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {daDecidere === 0 ? 'Niente da decidere.' : `${daDecidere} da decidere.`} Alla terza segnalazione il messaggio sparisce da solo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={tutte} onChange={e => setTutte(e.target.checked)} />
            Mostra anche le decise
          </label>
          <button onClick={carica} disabled={caricando}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${caricando ? 'animate-spin' : ''}`} /> Aggiorna
          </button>
        </div>
      </div>

      {errore && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          {errore}
        </div>
      )}

      {!caricando && righe.length === 0 && !errore && (
        <div className="p-10 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-500 dark:text-gray-400">
          Nessuna segnalazione in coda.
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {righe.map(m => {
          const scaduto = new Date(m.expires_at) < new Date()
          const nome = m.is_anonymous ? 'Anonimo' : (m.display_nickname || m.username || 'senza nome')
          return (
            <div key={m.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-semibold">
                  <Flag className="w-3 h-3" /> {m.report_count}
                </span>
                {m.is_hidden_by_reports && <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium">Nascosto</span>}
                {m.moderazione === 'ripristinato' && <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium">Ripristinato il {quando(m.moderato_il!)}</span>}
                {scaduto && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 font-medium">Scaduto</span>}
                <span className="text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                  {m.is_anonymous && <UserX className="w-3 h-3" />} {nome} · {quando(m.created_at)}
                </span>
              </div>

              <div className="flex gap-3">
                {m.image_url && <img src={m.image_url} alt="" className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />}
                <div className="min-w-0">
                  {m.title && <p className="font-semibold text-gray-900 dark:text-white">{m.title}</p>}
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">{m.text}</p>
                </div>
              </div>

              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5 border-t border-gray-100 dark:border-gray-800 pt-2">
                {m.motivi.slice(0, 5).map((motivo, i) => <li key={i}>· {motivo}</li>)}
                {m.motivi.length > 5 && <li>e altri {m.motivi.length - 5}</li>}
              </ul>

              <div className="flex flex-wrap gap-2">
                {m.is_hidden_by_reports ? (
                  <button onClick={() => modera(m, 'ripristina')} disabled={inCorso === m.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                    <Eye className="w-4 h-4" /> Ripristina
                  </button>
                ) : (
                  <>
                    <button onClick={() => modera(m, 'ripristina')} disabled={inCorso === m.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">
                      <Eye className="w-4 h-4" /> Va bene così
                    </button>
                    <button onClick={() => modera(m, 'nascondi')} disabled={inCorso === m.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50">
                      <EyeOff className="w-4 h-4" /> Nascondi
                    </button>
                  </>
                )}
                <button onClick={() => modera(m, 'elimina')} disabled={inCorso === m.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">
                  <Trash2 className="w-4 h-4" /> Elimina
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
