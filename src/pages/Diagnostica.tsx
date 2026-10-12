import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { createColumnHelper } from '@tanstack/react-table'
import { TabellaDati, useTabella } from '../components/TabellaDati'

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

const quando = (r: Riga) => new Date(r.creato).toLocaleString('it-IT')
const app = (r: Riga) => [r.piattaforma, r.versione].filter(Boolean).join(' ')

const colonna = createColumnHelper<Riga>()
const COLONNE = [
  colonna.accessor('creato', {
    header: 'Quando',
    meta: { testo: quando },
    cell: ({ row }) => <span className="whitespace-nowrap text-gray-600 dark:text-gray-300">{quando(row.original)}</span>,
  }),
  colonna.accessor(r => r.username ?? '—', {
    id: 'username',
    header: 'Utente',
    cell: info => <span className="text-gray-900 dark:text-white">{info.getValue()}</span>,
  }),
  colonna.accessor('evento', {
    header: 'Evento',
    meta: { filtro: 'scelta' },
    cell: info => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${OK.has(info.getValue())
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
        {info.getValue()}
      </span>
    ),
  }),
  colonna.accessor(r => r.dettaglio ?? '', {
    id: 'dettaglio',
    header: 'Dettaglio',
    cell: info => <span className="text-gray-600 dark:text-gray-300 break-all">{info.getValue()}</span>,
  }),
  colonna.accessor(app, {
    id: 'app',
    header: 'App',
    meta: { filtro: 'scelta' },
    cell: info => <span className="whitespace-nowrap text-gray-500 dark:text-gray-400">{info.getValue()}</span>,
  }),
]

export default function Diagnostica() {
  const [righe, setRighe] = useState<Riga[]>([])
  const [caricando, setCaricando] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const tabella = useTabella({ dati: righe, colonne: COLONNE, ordine: [{ id: 'creato', desc: true }] })

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
        <TabellaDati table={tabella} compatta
          vuoto={caricando ? 'Caricamento…' : 'Nessun evento registrato.'} />
      </div>
    </div>
  )
}
