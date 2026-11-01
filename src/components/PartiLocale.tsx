import { useEffect, useState } from 'react'
import { Upload, X, UserPlus } from 'lucide-react'
import {
  caricaFileLocale, gestori, aggiungiGestore, togliGestore, statistiche,
  type Gestore, type GiornoStatistiche,
} from '../lib/locali'
import { useToast } from './Toast'

/* I pezzi della pagina di un locale aggiunti per i gestori: il file
   (logo o carattere), l'elenco dei gestori, le statistiche. */

const campo = 'w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white'

/* Logo o carattere: si carica subito nel bucket, il collegamento nel
   tema si salva con il pulsante Salva. */
export function CaricaFile({ localeId, tipo, url, onUrl }: {
  localeId: string; tipo: 'logo' | 'font'; url?: string; onUrl: (u: string | undefined) => void
}) {
  const { error: toastError } = useToast()
  const [invio, setInvio] = useState(false)
  async function scegli(f: File | undefined) {
    if (!f) return
    setInvio(true)
    try { onUrl(await caricaFileLocale(localeId, tipo, f)) }
    catch (e: any) { toastError(e.message) }
    finally { setInvio(false) }
  }
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {url && tipo === 'logo' && <img src={url} alt="" className="w-14 h-14 object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-white" />}
      {url && tipo === 'font' && <span className="text-xs text-gray-500 break-all">{url.split('/').pop()}</span>}
      <label className={`flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer ${invio ? 'opacity-50' : ''}`}>
        <Upload className="w-4 h-4" />{invio ? 'Carico…' : url ? 'Cambia' : 'Carica'}
        <input type="file" className="hidden" disabled={invio}
          accept={tipo === 'font' ? '.woff2,font/woff2' : 'image/png,image/jpeg,image/webp'}
          onChange={e => { scegli(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      {url && <button onClick={() => onUrl(undefined)} className="text-xs text-gray-500 hover:text-rose-500">togli</button>}
    </div>
  )
}

export function Gestori({ localeId }: { localeId: string }) {
  const { success: toastSuccess, error: toastError } = useToast()
  const [elenco, setElenco] = useState<Gestore[]>([])
  const [email, setEmail] = useState('')
  const ricarica = () => gestori(localeId).then(setElenco).catch(e => toastError(e.message))
  useEffect(() => { ricarica() }, [localeId])
  async function aggiungi() {
    if (!email.trim()) return
    try { await aggiungiGestore(localeId, email); setEmail(''); toastSuccess('Gestore aggiunto'); ricarica() }
    catch (e: any) { toastError(e.message) }
  }
  async function togli(g: Gestore) {
    if (!confirm(`Togliere ${g.email} dai gestori?`)) return
    try { await togliGestore(localeId, g.user_id); ricarica() }
    catch (e: any) { toastError(e.message) }
  }
  return (
    <div className="space-y-2">
      {elenco.map(g => (
        <div key={g.user_id} className="flex items-center gap-2 text-sm">
          <span className="flex-1 min-w-0 truncate text-gray-800 dark:text-gray-200">{g.email}{g.username ? <span className="text-gray-400"> · {g.username}</span> : null}</span>
          <button onClick={() => togli(g)} className="p-1 text-gray-400 hover:text-rose-500" title="Togli"><X className="w-4 h-4" /></button>
        </div>
      ))}
      {!elenco.length && <p className="text-xs text-gray-400">Nessun gestore.</p>}
      <div className="flex gap-2">
        <input className={campo} type="email" placeholder="Email di un utente già iscritto" value={email}
          onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') aggiungi() }} />
        <button onClick={aggiungi} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg whitespace-nowrap">
          <UserPlus className="w-4 h-4" />Aggiungi
        </button>
      </div>
    </div>
  )
}

export function Statistiche({ localeId }: { localeId: string }) {
  const { error: toastError } = useToast()
  const [giorni, setGiorni] = useState<GiornoStatistiche[] | null>(null)
  useEffect(() => { statistiche(localeId, 30).then(setGiorni).catch(e => toastError(e.message)) }, [localeId])
  if (!giorni) return <p className="text-xs text-gray-400">Caricamento…</p>
  const somma = (k: 'proposte' | 'accesi' | 'messaggi', n: number) => giorni.slice(0, n).reduce((a, g) => a + g[k], 0)
  const massimo = Math.max(1, ...giorni.map(g => Math.max(g.proposte, g.messaggi)))
  const recenti = [...giorni].slice(0, 14).reverse()
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {([['proposte', 'Passaggi', 'stile proposto'], ['accesi', 'Stile acceso', 'hanno detto sì'], ['messaggi', 'Messaggi', 'scritti lì']] as const).map(([k, nome, nota]) => (
          <div key={k} className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{nome}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{somma(k, 7)}</p>
            <p className="text-[11px] text-gray-400">{nota} · 7 giorni · {somma(k, 30)} in 30</p>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Ultimi 14 giorni: passaggi (grigio), stile acceso (indaco), messaggi (verde)</p>
        <div className="flex items-end gap-1 h-24" role="img" aria-label="Andamento degli ultimi 14 giorni">
          {recenti.map(g => (
            <div key={g.giorno} className="flex-1 flex items-end gap-px h-full" title={`${new Date(g.giorno).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}: ${g.proposte} passaggi, ${g.accesi} accesi, ${g.messaggi} messaggi`}>
              <div className="flex-1 bg-gray-300 dark:bg-gray-600 rounded-t-sm" style={{ height: `${(g.proposte / massimo) * 100}%` }} />
              <div className="flex-1 bg-indigo-500 rounded-t-sm" style={{ height: `${(g.accesi / massimo) * 100}%` }} />
              <div className="flex-1 bg-emerald-500 rounded-t-sm" style={{ height: `${(g.messaggi / massimo) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-gray-400">Solo numeri: l'app non dice chi è passato. I passaggi contano una proposta per apertura dell'app.</p>
    </div>
  )
}
