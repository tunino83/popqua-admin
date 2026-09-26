import { useEffect, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

/* Un messaggio, in dieci secondi, nel punto che hai toccato sulla mappa.
 *
 * La pagina "Nuovo messaggio" chiede tipo, titolo, luogo, ritardo,
 * scadenza, foto e posizione: giusto per preparare un contenuto, troppo
 * per il caso piu' frequente, che e' "metti due righe qui". Qui si scrive
 * e si manda; tutto il resto ha un valore di partenza gia' buono.
 */

const DURATE = [
  { value: 180,   label: '3h' },
  { value: 360,   label: '6h' },
  { value: 1440,  label: '1 giorno' },
  { value: 10080, label: '1 settimana' },
  { value: 43200, label: '1 mese' },
]

const RAGGI = [100, 300, 500] as const

export interface PuntoMappa { lat: number; lon: number }

export function MessaggioRapido({ punto, onChiudi, onFatto }: {
  punto: PuntoMappa
  onChiudi: () => void
  onFatto?: () => void
}) {
  const [testo, setTesto] = useState('')
  const [titolo, setTitolo] = useState('')
  // Una settimana e anonimo: i valori chiesti per la via rapida.
  const [durata, setDurata] = useState(10080)
  const [anonimo, setAnonimo] = useState(true)
  const [raggio, setRaggio] = useState<(typeof RAGGI)[number]>(300)
  /* Acceso: chi manda un messaggio da qui vuole che qualcuno lo legga.
     Spento, il messaggio viene marcato dimostrativo, che e' l'unico modo
     che il trigger conosce per non avvisare nessuno. */
  const [notifica, setNotifica] = useState(true)
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  // Il cursore e' gia' nel testo: un clic sulla mappa, e si scrive.
  useEffect(() => { areaRef.current?.focus() }, [punto.lat, punto.lon])

  async function manda(e: React.FormEvent) {
    e.preventDefault()
    if (!testo.trim() || invio) return
    setInvio(true); setErrore(null)

    const { data: { user } } = await supabase.auth.getUser()
    let nome = 'POPQua'
    if (user && !anonimo) {
      const { data } = await supabase.from('user_profiles').select('username').eq('id', user.id).single()
      nome = data?.username ?? 'POPQua'
    }

    const ora = new Date()
    const { error } = await supabase.from('messages').insert({
      text: testo.trim(),
      title: titolo.trim() || null,
      location: `POINT(${punto.lon} ${punto.lat})`,
      visible_at: ora.toISOString(),
      expires_at: new Date(ora.getTime() + durata * 60000).toISOString(),
      username: anonimo ? 'Anonimo' : nome,
      display_nickname: anonimo ? 'Anonimo' : nome,
      /* L'autore resta vuoto anche quando non e' anonimo: chi sceglie i
         destinatari della notifica esclude l'autore, e con un autore vero
         chi scrive non riceverebbe la propria. */
      author_id: null,
      is_anonymous: anonimo,
      is_global: false,
      message_type: 'message',
      location_precision: 'exact',
      visibility_radius: raggio,
      is_demo: !notifica,
    })

    setInvio(false)
    if (error) { setErrore(error.message); return }
    setTesto(''); setTitolo('')
    onFatto?.()
    onChiudi()
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const pill = (attivo: boolean) =>
    `px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${attivo ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`

  return (
    <form onSubmit={manda}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Messaggio qui</h2>
          <p className="text-xs text-gray-400">{punto.lat.toFixed(5)}, {punto.lon.toFixed(5)}</p>
        </div>
        <button type="button" onClick={onChiudi} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <textarea ref={areaRef} value={testo} onChange={e => setTesto(e.target.value)} rows={3} maxLength={500}
        placeholder="Scrivi il messaggio…" className={`${inputCls} resize-none`} />

      <input type="text" value={titolo} onChange={e => setTitolo(e.target.value.slice(0, 100))}
        placeholder="Titolo (opzionale)" className={inputCls} />

      <div className="flex flex-wrap gap-1.5">
        {DURATE.map(d => (
          <button key={d.value} type="button" onClick={() => setDurata(d.value)} className={pill(durata === d.value)}>
            {d.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {RAGGI.map(r => (
          <button key={r} type="button" onClick={() => setRaggio(r)} className={pill(raggio === r)}>
            {r} m
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
          <input type="checkbox" checked={anonimo} onChange={e => setAnonimo(e.target.checked)} />
          Anonimo
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
          <input type="checkbox" checked={notifica} onChange={e => setNotifica(e.target.checked)} />
          Avvisa chi è entro 1 km
        </label>
      </div>

      {errore && (
        <p className="text-sm text-red-600 dark:text-red-400">{errore}</p>
      )}

      <button type="submit" disabled={invio || !testo.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl text-sm font-semibold transition">
        <Send className="w-4 h-4" /> {invio ? 'Invio…' : 'Manda'}
      </button>
    </form>
  )
}
