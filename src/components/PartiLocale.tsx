import { useEffect, useState } from 'react'
import { Upload, X, UserPlus, Printer, Download } from 'lucide-react'
import QRCode from 'qrcode'
import {
  caricaFileLocale, gestori, aggiungiGestore, togliGestore, statistiche,
  type Gestore, type GiornoStatistiche, type Locale,
} from '../lib/locali'
import { useToast } from './Toast'
import { useConferma } from './ui'

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
      <label className={`flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 cursor-pointer ${invio ? 'opacity-50' : ''}`}>
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
  const conferma = useConferma()
  const ricarica = () => gestori(localeId).then(setElenco).catch(e => toastError(e.message))
  useEffect(() => { ricarica() }, [localeId])
  async function aggiungi() {
    if (!email.trim()) return
    try { await aggiungiGestore(localeId, email); setEmail(''); toastSuccess('Gestore aggiunto'); ricarica() }
    catch (e: any) { toastError(e.message) }
  }
  async function togli(g: Gestore) {
    if (!(await conferma({ titolo: `Togliere ${g.email} dai gestori?`, testo: 'Non potrà più modificare il locale dal pannello.', conferma: 'Togli', pericolo: true }))) return
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
        <button onClick={aggiungi} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950 rounded-lg whitespace-nowrap">
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
  const somma = (k: 'proposte' | 'accesi' | 'qr' | 'messaggi', n: number) => giorni.slice(0, n).reduce((a, g) => a + g[k], 0)
  const massimo = Math.max(1, ...giorni.map(g => Math.max(g.proposte, g.messaggi)))
  const recenti = [...giorni].slice(0, 14).reverse()
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([['proposte', 'Passaggi', 'stile proposto'], ['accesi', 'Stile acceso', 'hanno detto sì'], ['qr', 'QR', 'scansioni'], ['messaggi', 'Messaggi', 'scritti lì']] as const).map(([k, nome, nota]) => (
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
              <div className="flex-1 bg-brand-500 rounded-t-sm" style={{ height: `${(g.accesi / massimo) * 100}%` }} />
              <div className="flex-1 bg-emerald-500 rounded-t-sm" style={{ height: `${(g.messaggi / massimo) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-gray-400">Solo numeri: l'app non dice chi è passato. I passaggi contano una proposta per apertura dell'app.</p>
    </div>
  )
}

/* Il QR del locale: popqua.it/l/<id>. Chi lo inquadra al tavolo o alla
   cassa si ritrova nell'app con lo stile del locale gia' acceso (se e'
   davvero li': lo conferma la posizione). */
export const linkQr = (id: string) => `https://popqua.it/l/${id}`

const esc = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function CartelloQR({ locale }: { locale: Partial<Locale> & { id: string } }) {
  const [qr, setQr] = useState<string | null>(null)
  const url = linkQr(locale.id)
  useEffect(() => {
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 1024, color: { dark: '#17150F', light: '#FFFFFF' } }).then(setQr)
  }, [url])
  const saluto = locale.tema?.saluto || `Sei da ${locale.nome ?? ''}`

  function stampa() {
    if (!qr) return
    const w = window.open('', '_blank')
    if (!w) return
    const simbolo = locale.tema?.logo_url
      ? `<img src="${esc(locale.tema.logo_url)}" style="width:22mm;height:22mm;object-fit:contain">`
      : `<div style="font-size:18mm;line-height:1">${esc(locale.tema?.emoji || '★')}</div>`
    // Quattro cartelli A6 su un A4, da ritagliare.
    const cartello = `<div class="c">${simbolo}<h1>${esc(locale.nome ?? '')}</h1><p class="s">Lascia un messaggio qui</p>
      <img class="q" src="${qr}"><p class="i">Inquadra con la fotocamera.<br>Chi passa di qui lo leggerà.</p><p class="m">POPQua · popqua.it</p></div>`
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR ${esc(locale.nome ?? '')}</title><style>
      @page { size: A4; margin: 0 }
      body { margin: 0; font-family: system-ui, sans-serif; color: #17150F }
      .f { display: grid; grid-template-columns: 105mm 105mm; grid-template-rows: 148mm 148mm }
      .c { box-sizing: border-box; border: 0.2mm dashed #bbb; padding: 9mm 8mm; display: flex; flex-direction: column; align-items: center; text-align: center }
      h1 { margin: 3mm 0 0; font-size: 7mm } .s { margin: 1mm 0 4mm; font-size: 5mm; font-weight: 700; color: #DD5E45 }
      .q { width: 62mm; height: 62mm } .i { margin: 4mm 0 0; font-size: 3.6mm; line-height: 1.35 } .m { margin: auto 0 0; font-size: 3.2mm; color: #666 }
    </style></head><body><div class="f">${cartello.repeat(4)}</div><script>window.onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`)
    w.document.close()
  }

  return (
    <div className="flex gap-4 items-start flex-wrap">
      {qr ? <img src={qr} alt={`QR di ${locale.nome}`} className="w-32 h-32 rounded-lg border border-gray-200 dark:border-gray-700 bg-white" />
        : <div className="w-32 h-32 rounded-lg bg-gray-100 dark:bg-gray-800" />}
      <div className="flex-1 min-w-[180px] space-y-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">Da mettere sui tavoli o alla cassa. Chi lo inquadra ed è nel raggio del locale si ritrova nell'app con «{saluto}» già acceso. Le scansioni compaiono nelle statistiche.</p>
        <p className="text-[11px] text-gray-400 break-all">{url}</p>
        <div className="flex gap-3">
          <button onClick={stampa} disabled={!qr} className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"><Printer className="w-4 h-4" />Stampa 4 cartelli (A4)</button>
          {qr && <a href={qr} download={`qr-${(locale.nome ?? 'locale').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`} className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"><Download className="w-4 h-4" />PNG</a>}
        </div>
      </div>
    </div>
  )
}
