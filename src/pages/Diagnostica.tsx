import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

/* Cosa succede su notifiche e posizione nei telefoni, senza collegarli con
 * un cavo. L'app scrive gli esiti (admin_diagnostica_app): niente
 * coordinate, solo l'evento e l'eventuale messaggio d'errore. */

interface Riga {
  creato: string
  username: string | null
  evento: string
  dettaglio: string | null
  piattaforma: string | null
  versione: string | null
}

const OK = new Set(['token_registrato', 'posizione_aggiornata'])

export default function Diagnostica() {
  const [righe, setRighe] = useState<Riga[]>([])
  const [caricando, setCaricando] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)

  async function carica() {
    setCaricando(true); setErrore(null)
    const { data, error } = await supabase.rpc('admin_diagnostica_app', { p_limite: 300 })
    if (error) setErrore(error.message)
    else setRighe((data ?? []) as Riga[])
    setCaricando(false)
  }

  useEffect(() => { carica() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Diagnostica app</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Esiti di notifiche e posizione inviati dai telefoni negli ultimi 30 giorni.
          </p>
        </div>
        <button onClick={carica} disabled={caricando}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${caricando ? 'animate-spin' : ''}`} /> Aggiorna
        </button>
      </div>

      {errore && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          {errore}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-4 py-2 font-medium">Quando</th>
              <th className="px-4 py-2 font-medium">Utente</th>
              <th className="px-4 py-2 font-medium">Evento</th>
              <th className="px-4 py-2 font-medium">Dettaglio</th>
              <th className="px-4 py-2 font-medium">App</th>
            </tr>
          </thead>
          <tbody>
            {righe.length === 0 && !caricando && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Nessun evento registrato.</td></tr>
            )}
            {righe.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                <td className="px-4 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                  {new Date(r.creato).toLocaleString('it-IT')}
                </td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{r.username ?? '—'}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${OK.has(r.evento)
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                    {r.evento}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300 break-all">{r.dettaglio ?? ''}</td>
                <td className="px-4 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400">
                  {[r.piattaforma, r.versione].filter(Boolean).join(' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
