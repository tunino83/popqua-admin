import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { mieiLocali, descriviDisponibilita, type Locale } from '../lib/locali'
import { useToast } from '../components/Toast'

/* I locali di cui si e' gestori: si apre il proprio e si cambiano saluto,
   testi, logo, orari e vetrina. */
export default function MieiLocali({ userId }: { userId: string }) {
  const { error: toastError } = useToast()
  const [locali, setLocali] = useState<Locale[] | null>(null)
  useEffect(() => { mieiLocali(userId).then(setLocali).catch(e => { toastError(e.message); setLocali([]) }) }, [userId])

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">I miei locali</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Come si presenta il tuo locale a chi è lì con POPQua.</p>
      </div>
      {!locali && <p className="text-sm text-gray-400">Caricamento…</p>}
      {locali?.length === 0 && <p className="text-sm text-gray-500">Non gestisci ancora nessun locale.</p>}
      <div className="grid gap-3">
        {locali?.map(l => (
          <Link key={l.id} to={`/miei-locali/${l.id}`}
            className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-700">
            {l.tema?.logo_url
              ? <img src={l.tema.logo_url} alt="" className="w-10 h-10 object-contain rounded-lg" />
              : <span className="text-2xl w-10 text-center" aria-hidden>{l.tema?.emoji || '★'}</span>}
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">{l.nome}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{l.attivo ? 'Attivo' : 'Spento'} · {descriviDisponibilita(l)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
