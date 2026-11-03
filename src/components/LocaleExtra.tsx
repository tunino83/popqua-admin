import { useEffect, useRef, useState } from 'react'
import { Plus, X, ChevronUp, ChevronDown, Camera, Star, Printer, Copy, RefreshCw, ExternalLink, Check, EyeOff, Send } from 'lucide-react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { ALLERGENI, caricaFileLocale, type Locale, type RegoleLocale, type VoceVetrina } from '../lib/locali'
import { useToast } from './Toast'
import { cls, bottone, Interruttore, Vuoto, useConferma } from './ui'
import { linkQr } from './PartiLocale'

/* I pezzi della pagina del locale per le fasi 1 e 2: menu e vetrina,
   regole della bacheca, tavoli, schermo TV, richieste dei clienti. */

const esc = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/* ── Foto del piatto: ridotta nel browser (i telefoni fanno foto da
   diversi MB, il bucket ne accetta 512 KB) e caricata come piatto-*. */
async function riduci(f: File): Promise<File> {
  const img = await createImageBitmap(f)
  const lato = 900, k = Math.min(1, lato / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  const blob = await new Promise<Blob>((ok, ko) => c.toBlob(b => (b ? ok(b) : ko(new Error('foto'))), 'image/webp', 0.82))
  return new File([blob], 'piatto.webp', { type: 'image/webp' })
}

const fineGiornata = () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d.toISOString() }

/* ── Menu e vetrina ────────────────────────────────────────────
   Stessa lista di voci, due editor: il menu e' quello di tutti i
   giorni (esaurito, piatto del giorno, allergeni, foto), la vetrina
   presenta il locale. */
export function EditorVoci({ area, voci, setVoci, localeId }: {
  area: 'menu' | 'vetrina'; voci: VoceVetrina[]; setVoci: React.Dispatch<React.SetStateAction<VoceVetrina[]>>; localeId: string | null
}) {
  const { error: toastError } = useToast()
  const [aperta, setAperta] = useState<number | null>(null)
  const [carico, setCarico] = useState<number | null>(null)
  const indici = voci.map((v, i) => (v.area === area ? i : -1)).filter(i => i >= 0)
  const cambia = (i: number, p: Partial<VoceVetrina>) => setVoci(v => v.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const sposta = (i: number, d: number) => {
    const pos = indici.indexOf(i), j = indici[pos + d]
    if (j == null) return
    setVoci(v => { const c = [...v]; [c[i], c[j]] = [c[j], c[i]]; return c })
  }
  const aggiungi = () => {
    const ultima = indici.length ? voci[indici[indici.length - 1]].sezione : ''
    setVoci(x => [...x, { sezione: ultima, ordine: x.length + 1, nome: '', descrizione: null, prezzo: null, etichette: [], disponibile: true, area, allergeni: [], foto_url: null, evidenza_fino: null }])
    setAperta(voci.length)
  }
  async function foto(i: number, f: File | undefined) {
    if (!f || !localeId) return
    setCarico(i)
    try { cambia(i, { foto_url: await caricaFileLocale(localeId, 'piatto', await riduci(f)) }) }
    catch (e: any) { toastError(e.message) }
    finally { setCarico(null) }
  }
  const oggi = (v: VoceVetrina) => !!v.evidenza_fino && new Date(v.evidenza_fino) > new Date()

  // Raggruppate per sezione, nell'ordine della lista.
  const sezioni: [string, number[]][] = []
  for (const i of indici) {
    const s = voci[i].sezione || '—'
    const g = sezioni.find(x => x[0] === s)
    if (g) g[1].push(i); else sezioni.push([s, [i]])
  }

  return (
    <div className="space-y-4">
      {!indici.length && <Vuoto titolo={area === 'menu' ? 'Il menu è vuoto' : 'La vetrina è vuota'}
        testo={area === 'menu' ? 'Aggiungi piatti e bevande: sezione, nome, prezzo.' : 'Racconta il locale: serate, servizi, orari speciali.'} />}
      {sezioni.map(([nome, elenco]) => (
        <div key={nome} className={`${cls.riquadro} overflow-hidden`}>
          <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">{nome}</p>
          {elenco.map(i => {
            const v = voci[i]
            return (
              <div key={v.id ?? `n${i}`} className="border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3 px-4 py-2.5">
                  {v.foto_url ? <img src={v.foto_url} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                    : <span className="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-800 flex-shrink-0" />}
                  <button type="button" onClick={() => setAperta(aperta === i ? null : i)} className="flex-1 min-w-0 text-left">
                    <span className={`block text-sm font-semibold truncate ${v.disponibile ? 'text-gray-900 dark:text-white' : 'text-gray-400 line-through'}`}>
                      {oggi(v) && <Star className="inline w-3.5 h-3.5 mr-1 text-brand-600 fill-brand-600 -mt-0.5" />}{v.nome || 'Senza nome'}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{[v.prezzo != null ? `${v.prezzo.toFixed(2)} €` : null, v.descrizione].filter(Boolean).join(' · ') || 'Tocca per modificare'}</span>
                  </button>
                  {area === 'menu' && (
                    <>
                      <button type="button" onClick={() => cambia(i, { evidenza_fino: oggi(v) ? null : fineGiornata() })} aria-pressed={oggi(v)}
                        title="Piatto del giorno (fino a mezzanotte)"
                        className={`hidden sm:inline-flex ${bottone(oggi(v) ? 'primario' : 'secondario', true)}`}>Oggi</button>
                      <button type="button" onClick={() => cambia(i, { disponibile: !v.disponibile })} aria-pressed={!v.disponibile}
                        className={bottone(v.disponibile ? 'secondario' : 'pericolo', true)}>{v.disponibile ? 'Disponibile' : 'Esaurito'}</button>
                    </>
                  )}
                </div>
                {aperta === i && (
                  <div className="px-4 pb-4 space-y-2 bg-gray-50/60 dark:bg-gray-800/30">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                      <input className={`${cls.campo} col-span-2`} placeholder="Nome" value={v.nome} onChange={e => cambia(i, { nome: e.target.value })} />
                      <input className={cls.campo} placeholder="Sezione" value={v.sezione} onChange={e => cambia(i, { sezione: e.target.value })} />
                      <input className={cls.campo} type="number" step="0.5" placeholder="Prezzo €" value={v.prezzo ?? ''} onChange={e => cambia(i, { prezzo: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                    <input className={cls.campo} placeholder="Descrizione" value={v.descrizione ?? ''} onChange={e => cambia(i, { descrizione: e.target.value })} />
                    <input className={cls.campo} placeholder="Etichette separate da virgola (vegano, della casa…)" value={v.etichette.join(', ')}
                      onChange={e => cambia(i, { etichette: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                    {area === 'menu' && (
                      <div>
                        <p className={cls.etichetta}>Allergeni</p>
                        <div className="flex flex-wrap gap-1.5">
                          {ALLERGENI.map(a => {
                            const on = v.allergeni.includes(a)
                            return (
                              <button key={a} type="button" aria-pressed={on}
                                onClick={() => cambia(i, { allergeni: on ? v.allergeni.filter(x => x !== a) : [...v.allergeni, a] })}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border ${on ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{a}</button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {localeId ? (
                        <label className={`${bottone('secondario', true)} cursor-pointer`}>
                          <Camera className="w-3.5 h-3.5" />{carico === i ? 'Carico…' : v.foto_url ? 'Cambia foto' : 'Foto'}
                          <input type="file" accept="image/*" className="hidden" onChange={e => { foto(i, e.target.files?.[0]); e.target.value = '' }} />
                        </label>
                      ) : <span className="text-xs text-gray-400">Salva il locale per aggiungere foto.</span>}
                      {v.foto_url && <button type="button" onClick={() => cambia(i, { foto_url: null })} className={bottone('quieto', true)}>Togli foto</button>}
                      <span className="flex-1" />
                      <button type="button" onClick={() => sposta(i, -1)} className={bottone('quieto', true)} aria-label="Su"><ChevronUp className="w-4 h-4" /></button>
                      <button type="button" onClick={() => sposta(i, 1)} className={bottone('quieto', true)} aria-label="Giù"><ChevronDown className="w-4 h-4" /></button>
                      <button type="button" onClick={() => { setVoci(x => x.filter((_, j) => j !== i)); setAperta(null) }} className={bottone('pericolo', true)}><X className="w-3.5 h-3.5" />Togli</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
      <button type="button" onClick={aggiungi} className={bottone('secondario')}><Plus className="w-4 h-4" />{area === 'menu' ? 'Aggiungi al menu' : 'Aggiungi alla vetrina'}</button>
    </div>
  )
}

/* ── Regole della bacheca ──────────────────────────────────── */
const DURATE = [
  { v: null, t: 'Nessun limite' }, { v: 60, t: '1 ora' }, { v: 180, t: '3 ore' }, { v: 360, t: '6 ore' }, { v: 720, t: '12 ore' }, { v: 1440, t: '1 giorno' },
]

export function RegoleBacheca({ regole = {}, onRegole }: { regole?: RegoleLocale; onRegole: (r: RegoleLocale) => void }) {
  const r = { anonimi: true, foto: true, solo_tavoli: false, firma_tavolo: 'no' as const, ...regole }
  const set = (p: Partial<RegoleLocale>) => onRegole({ ...regole, ...p })
  const [parole, setParole] = useState((regole.parole ?? []).join(', '))
  return (
    <div className="space-y-5">
      <Interruttore acceso={r.anonimi} onCambia={v => set({ anonimi: v })} etichetta="Messaggi anonimi"
        nota="Spento: chi scrive qui deve firmare con il suo nome." />
      <Interruttore acceso={r.foto} onCambia={v => set({ foto: v })} etichetta="Foto nei messaggi" />
      <div>
        <label className={cls.etichetta} htmlFor="durata-max">Durata massima dei messaggi</label>
        <select id="durata-max" className={cls.campo} value={r.durata_max ?? ''} onChange={e => set({ durata_max: e.target.value ? Number(e.target.value) : null })}>
          {DURATE.map(d => <option key={d.t} value={d.v ?? ''}>{d.t}</option>)}
        </select>
      </div>
      <div>
        <label className={cls.etichetta} htmlFor="limite-ora">Messaggi al massimo per persona in un'ora</label>
        <input id="limite-ora" type="number" min={1} max={50} className={cls.campo} placeholder="Nessun limite" value={r.limite_ora ?? ''}
          onChange={e => set({ limite_ora: e.target.value ? Number(e.target.value) : null })} />
      </div>
      <div>
        <label className={cls.etichetta} htmlFor="parole">Parole vietate (separate da virgola)</label>
        <input id="parole" className={cls.campo} value={parole} onChange={e => setParole(e.target.value)}
          onBlur={() => set({ parole: parole.split(',').map(s => s.trim()).filter(Boolean).slice(0, 50) })} />
        <p className="text-xs text-gray-400 mt-1">Un messaggio che ne contiene una non viene pubblicato.</p>
      </div>
      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-4">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Tavoli</p>
        <div>
          <label className={cls.etichetta} htmlFor="firma-tavolo">Firma dei messaggi scritti da un tavolo</label>
          <select id="firma-tavolo" className={cls.campo} value={r.firma_tavolo} onChange={e => set({ firma_tavolo: e.target.value as RegoleLocale['firma_tavolo'] })}>
            <option value="no">Come sempre (nome o Anonimo)</option>
            <option value="tavolo_nome">Tavolo e nome: «Tavolo 12 · Marco»</option>
            <option value="tavolo">Solo il tavolo: «Tavolo 12» (ottimo per i giochi)</option>
          </select>
        </div>
        <Interruttore acceso={r.solo_tavoli} onCambia={v => set({ solo_tavoli: v })} etichetta="Si scrive solo dai tavoli"
          nota="Serve aver inquadrato il QR di un tavolo. Utile con la bacheca sulla TV." />
      </div>
    </div>
  )
}

/* ── Tavoli: un codice per tavolo, nel QR ───────────────────── */
interface Tavolo { codice: string; nome: string; ordine: number }

export function TavoliLocale({ locale }: { locale: Pick<Locale, 'id' | 'nome' | 'tema'> }) {
  const { error: toastError, success } = useToast()
  const conferma = useConferma()
  const [tavoli, setTavoli] = useState<Tavolo[] | null>(null)
  const [quanti, setQuanti] = useState(10)
  const carica = () => supabase.from('locali_tavoli').select('codice, nome, ordine').eq('locale_id', locale.id).order('ordine')
    .then(({ data, error }) => { if (error) toastError(error.message); setTavoli(data ?? []) })
  useEffect(() => { carica() }, [locale.id])

  async function crea() {
    const da = (tavoli?.length ?? 0) + 1
    const righe = Array.from({ length: quanti }, (_, k) => ({ locale_id: locale.id, nome: `Tavolo ${da + k}`, ordine: da + k }))
    const { error } = await supabase.from('locali_tavoli').insert(righe)
    if (error) toastError(error.message); else { success(`${quanti} tavoli aggiunti`); carica() }
  }
  async function rinomina(t: Tavolo, nome: string) {
    if (!nome.trim() || nome === t.nome) return
    const { error } = await supabase.from('locali_tavoli').update({ nome: nome.trim().slice(0, 30) }).eq('codice', t.codice)
    if (error) toastError(error.message); else carica()
  }
  async function togli(t: Tavolo) {
    if (!(await conferma({ titolo: `Togliere ${t.nome}?`, testo: 'Il suo QR smette di funzionare.', conferma: 'Togli', pericolo: true }))) return
    const { error } = await supabase.from('locali_tavoli').delete().eq('codice', t.codice)
    if (error) toastError(error.message); else carica()
  }

  async function stampa(scelti: Tavolo[]) {
    const w = window.open('', '_blank')
    if (!w) return
    const qr = await Promise.all(scelti.map(t => QRCode.toDataURL(`${linkQr(locale.id)}?t=${t.codice}`, { margin: 1, width: 700, color: { dark: '#17150F', light: '#FFFFFF' } })))
    const simbolo = locale.tema?.logo_url
      ? `<img src="${esc(locale.tema.logo_url)}" style="width:16mm;height:16mm;object-fit:contain">`
      : `<div style="font-size:13mm;line-height:1">${esc(locale.tema?.emoji || '★')}</div>`
    const pezzi = scelti.map((t, i) => `<div class="c">${simbolo}<p class="l">${esc(locale.nome)}</p><h1>${esc(t.nome)}</h1>
      <img class="q" src="${qr[i]}"><p class="i">Inquadra per scrivere sulla bacheca del locale<br>e chiamare il cameriere.</p><p class="m">POPQua · popqua.it</p></div>`).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Tavoli ${esc(locale.nome)}</title><style>
      @page { size: A4; margin: 0 } body { margin: 0; font-family: system-ui, sans-serif; color: #17150F }
      .f { display: grid; grid-template-columns: 105mm 105mm; grid-auto-rows: 148mm }
      .c { box-sizing: border-box; border: 0.2mm dashed #bbb; padding: 9mm 8mm; display: flex; flex-direction: column; align-items: center; text-align: center; break-inside: avoid }
      .l { margin: 2mm 0 0; font-size: 4.2mm; color: #666 } h1 { margin: 1mm 0 4mm; font-size: 11mm; letter-spacing: -0.02em }
      .q { width: 62mm; height: 62mm } .i { margin: 4mm 0 0; font-size: 3.6mm; line-height: 1.35 } .m { margin: auto 0 0; font-size: 3.2mm; color: #666 }
    </style></head><body><div class="f">${pezzi}</div><script>window.onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`)
    w.document.close()
  }

  if (!tavoli) return <p className="text-sm text-gray-400">Caricamento…</p>
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">Ogni tavolo ha un QR suo: chi lo inquadra scrive «dal tavolo» (vale quattro ore) e lo staff vede da quale tavolo arrivano le richieste. Come si firmano i messaggi lo decidi in Regole.</p>
      {tavoli.length > 0 && (
        <div className={`${cls.riquadro} divide-y divide-gray-100 dark:divide-gray-800`}>
          {tavoli.map(t => (
            <div key={t.codice} className="flex items-center gap-2 px-3 py-2">
              <input className={`${cls.campo} flex-1`} defaultValue={t.nome} maxLength={30} onBlur={e => rinomina(t, e.target.value)} aria-label="Nome del tavolo" />
              <button type="button" onClick={() => stampa([t])} className={bottone('quieto', true)} title="Stampa questo"><Printer className="w-4 h-4" /></button>
              <button type="button" onClick={() => togli(t)} className={bottone('quieto', true)} aria-label={`Togli ${t.nome}`}><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <input type="number" min={1} max={60} value={quanti} onChange={e => setQuanti(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} className={`${cls.campo} w-20`} aria-label="Quanti tavoli" />
        <button type="button" onClick={crea} className={bottone('secondario')}><Plus className="w-4 h-4" />Aggiungi tavoli</button>
        {tavoli.length > 0 && <button type="button" onClick={() => stampa(tavoli)} className={bottone()}><Printer className="w-4 h-4" />Stampa tutti (4 per foglio)</button>}
      </div>
    </div>
  )
}

/* ── Bacheca sulla TV ───────────────────────────────────────── */
interface Tv { locale_id: string; token: string; pausa: boolean; annuncio: string | null; approvazione: boolean }
interface MsgTv { id: string; title: string | null; text: string; created_at: string; firma: string | null; tavolo: string | null; tv_stato: string | null }

export function SchermoTv({ localeId }: { localeId: string }) {
  const { error: toastError, success } = useToast()
  const conferma = useConferma()
  const [tv, setTv] = useState<Tv | null>(null)
  const [annuncio, setAnnuncio] = useState('')
  const [msg, setMsg] = useState<MsgTv[]>([])

  const caricaMsg = () => supabase.rpc('gestore_messaggi_locale', { p_locale: localeId }).then(({ data }) => setMsg((data ?? []) as MsgTv[]))
  useEffect(() => {
    (async () => {
      let { data, error } = await supabase.from('locali_tv').select('*').eq('locale_id', localeId).maybeSingle()
      if (!data && !error) ({ data, error } = await supabase.from('locali_tv').insert({ locale_id: localeId }).select().single())
      if (error) { toastError(error.message); return }
      setTv(data as Tv); setAnnuncio((data as Tv).annuncio ?? '')
    })()
    caricaMsg()
    const t = setInterval(caricaMsg, 15_000)
    return () => clearInterval(t)
  }, [localeId])

  async function aggiorna(p: Partial<Tv>) {
    const { data, error } = await supabase.from('locali_tv').update(p).eq('locale_id', localeId).select().single()
    if (error) toastError(error.message); else setTv(data as Tv)
  }
  async function rigenera() {
    if (!(await conferma({ titolo: 'Cambiare il link della TV?', testo: 'Lo schermo collegato con il link vecchio smette di funzionare: andrà aperto quello nuovo.', conferma: 'Cambia link' }))) return
    aggiorna({ token: crypto.randomUUID().replace(/-/g, '') })
  }
  async function stato(m: MsgTv, s: 'ok' | 'nascosto' | null) {
    const { error } = await supabase.rpc('gestore_tv_messaggio', { p_id: m.id, p_stato: s })
    if (error) toastError(error.message); else caricaMsg()
  }

  if (!tv) return <p className="text-sm text-gray-400">Caricamento…</p>
  const link = `https://popqua.it/tv/${tv.token}`
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <div className={`${cls.riquadro} p-5 space-y-4`}>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Lo schermo</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Apri questo link nel browser della TV (o di un PC collegato). Non serve accedere: chi ha il link vede la bacheca, quindi non pubblicarlo.</p>
        </div>
        <div className="flex gap-2">
          <input readOnly value={link} className={`${cls.campo} font-mono text-xs`} onFocus={e => e.target.select()} aria-label="Link della TV" />
          <button type="button" onClick={() => { navigator.clipboard?.writeText(link); success('Link copiato') }} className={bottone('secondario')} aria-label="Copia"><Copy className="w-4 h-4" /></button>
          <a href={link} target="_blank" rel="noreferrer" className={bottone('secondario')} aria-label="Apri"><ExternalLink className="w-4 h-4" /></a>
        </div>
        <Interruttore acceso={tv.pausa} onCambia={v => aggiorna({ pausa: v })} etichetta="In pausa" nota="Lo schermo mostra «Torniamo tra poco»." />
        <Interruttore acceso={tv.approvazione} onCambia={v => aggiorna({ approvazione: v })} etichetta="Sulla TV solo dopo la mia approvazione"
          nota="I messaggi restano nella bacheca dell'app; sulla TV compaiono quando li approvi qui accanto." />
        <div>
          <label className={cls.etichetta} htmlFor="annuncio">Annuncio fisso in alto</label>
          <div className="flex gap-2">
            <input id="annuncio" className={cls.campo} maxLength={140} value={annuncio} placeholder="Tra 10 minuti si parte!" onChange={e => setAnnuncio(e.target.value)} />
            <button type="button" onClick={() => aggiorna({ annuncio: annuncio.trim() || null })} className={bottone()}>Mostra</button>
            {tv.annuncio && <button type="button" onClick={() => { setAnnuncio(''); aggiorna({ annuncio: null }) }} className={bottone('quieto')}>Togli</button>}
          </div>
        </div>
        <button type="button" onClick={rigenera} className={bottone('quieto', true)}><RefreshCw className="w-3.5 h-3.5" />Cambia il link</button>
      </div>

      <div className={`${cls.riquadro} p-5 space-y-3`}>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Messaggi del locale</h2>
        {!msg.length && <p className="text-sm text-gray-400">Nessun messaggio in corso.</p>}
        {msg.map(m => (
          <div key={m.id} className={`flex items-start gap-3 py-2 border-t border-gray-100 dark:border-gray-800 first:border-0 ${m.tv_stato === 'nascosto' ? 'opacity-50' : ''}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-white">{m.title ? <strong>{m.title} — </strong> : null}{m.text}</p>
              <p className="text-xs text-gray-500">{m.firma ?? 'Anonimo'} · {new Date(m.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                {m.tv_stato === 'ok' && ' · approvato'}{m.tv_stato === 'nascosto' && ' · nascosto dalla TV'}</p>
            </div>
            {tv.approvazione && m.tv_stato !== 'ok' && <button type="button" onClick={() => stato(m, 'ok')} className={bottone('secondario', true)}><Check className="w-3.5 h-3.5" />Approva</button>}
            {m.tv_stato === 'nascosto'
              ? <button type="button" onClick={() => stato(m, null)} className={bottone('quieto', true)}>Rimetti</button>
              : <button type="button" onClick={() => stato(m, 'nascosto')} className={bottone('quieto', true)} title="Nascondi dalla TV"><EyeOff className="w-3.5 h-3.5" /></button>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Richieste dei clienti ("Scrivi al locale") ─────────────────
   Arrivano in tempo reale, con un suono; lo staff le segna come viste,
   risponde, chiude. */
interface Richiesta { id: string; tavolo: string | null; tipo: 'cameriere' | 'conto' | 'domanda'; testo: string | null; stato: string; risposta: string | null; creato: string }
const TIPO = { cameriere: '🙋 Cameriere', conto: '🧾 Conto', domanda: '💬 Domanda' }

function suona() {
  try {
    const a = new AudioContext(), o = a.createOscillator(), g = a.createGain()
    o.frequency.value = 880; g.gain.setValueAtTime(0.2, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.5)
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.5)
  } catch { /* niente audio */ }
}

export function useRichieste(localeId: string | null) {
  const [righe, setRighe] = useState<Richiesta[]>([])
  const viste = useRef<Set<string> | null>(null)
  const carica = () => {
    if (!localeId) return
    supabase.from('locale_richieste').select('id, tavolo, tipo, testo, stato, risposta, creato')
      .eq('locale_id', localeId).gt('creato', new Date(Date.now() - 12 * 3600_000).toISOString())
      .order('creato', { ascending: false }).limit(50)
      .then(({ data }) => {
        const r = (data ?? []) as Richiesta[]
        if (viste.current && r.some(x => x.stato === 'nuova' && !viste.current!.has(x.id))) suona()
        viste.current = new Set(r.map(x => x.id))
        setRighe(r)
      })
  }
  useEffect(() => {
    if (!localeId) return
    carica()
    const canale = supabase.channel(`richieste-${localeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locale_richieste', filter: `locale_id=eq.${localeId}` }, carica)
      .subscribe()
    const t = setInterval(carica, 20_000)
    return () => { clearInterval(t); supabase.removeChannel(canale) }
  }, [localeId])
  return { righe, carica, nuove: righe.filter(r => r.stato === 'nuova').length }
}

export function RichiesteLocale({ richieste }: { richieste: ReturnType<typeof useRichieste> }) {
  const { error: toastError } = useToast()
  const [risposte, setRisposte] = useState<Record<string, string>>({})
  async function aggiorna(r: Richiesta, stato: string | null, risposta?: string) {
    const { error } = await supabase.rpc('gestore_richiesta', { p_id: r.id, p_stato: stato, p_risposta: risposta ?? null })
    if (error) toastError(error.message); else { setRisposte(x => ({ ...x, [r.id]: '' })); richieste.carica() }
  }
  const { righe } = richieste
  if (!righe.length) return <Vuoto titolo="Nessuna richiesta" testo="Quando un cliente chiama il cameriere, chiede il conto o fa una domanda, compare qui con un suono. Tieni la pagina aperta su un telefono o un tablet." />
  return (
    <div className="space-y-2 max-w-3xl">
      {righe.map(r => (
        <div key={r.id} className={`${cls.riquadro} p-4 ${r.stato === 'nuova' ? 'border-brand-300 dark:border-brand-800 bg-brand-50/40 dark:bg-brand-950/30' : r.stato === 'chiusa' ? 'opacity-60' : ''}`}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-gray-900 dark:text-white">{TIPO[r.tipo]}{r.tavolo && <span className="text-gray-500 font-normal"> · {r.tavolo}</span>}</p>
              {r.testo && <p className="text-sm text-gray-700 dark:text-gray-200 mt-0.5">{r.testo}</p>}
              {r.risposta && <p className="text-sm text-gray-500 mt-1">Risposta: {r.risposta}</p>}
              <p className="text-xs text-gray-400 mt-1">{new Date(r.creato).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · {r.stato === 'nuova' ? 'nuova' : r.stato === 'vista' ? 'vista' : 'fatto'}</p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              {r.stato === 'nuova' && <button type="button" onClick={() => aggiorna(r, 'vista')} className={bottone('secondario', true)}>Vista</button>}
              {r.stato !== 'chiusa' && <button type="button" onClick={() => aggiorna(r, 'chiusa')} className={bottone('primario', true)}><Check className="w-3.5 h-3.5" />Fatto</button>}
            </div>
          </div>
          {r.stato !== 'chiusa' && (
            <div className="flex gap-2 mt-3">
              <input className={cls.campo} placeholder="Rispondi (arriva come notifica)…" maxLength={300} value={risposte[r.id] ?? ''}
                onChange={e => setRisposte(x => ({ ...x, [r.id]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && risposte[r.id]?.trim()) aggiorna(r, 'vista', risposte[r.id]) }} />
              <button type="button" disabled={!risposte[r.id]?.trim()} onClick={() => aggiorna(r, 'vista', risposte[r.id])} className={bottone('secondario')} aria-label="Invia risposta"><Send className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
