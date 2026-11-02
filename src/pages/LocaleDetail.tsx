import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, Trash2, Plus, X, ChevronUp, ChevronDown } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { OSM_TILES, OSM_OPTIONS } from '../lib/mapTiles'
import {
  getLocale, salvaLocale, salvaComeGestore, eliminaLocale, vociVetrina, salvaVetrina, descriviDisponibilita,
  SKIN_GRUPPI, CATEGORIE, tipoDiPosto, GIORNI, type Locale, type Fascia, type VoceVetrina,
} from '../lib/locali'
import { useToast } from '../components/Toast'
import { EditorSuMisura, AnteprimaSuMisura, PARTENZE } from '../components/EditorSuMisura'
import { StilePosto } from '../components/StilePosto'
import { suClicSingolo } from '../lib/clicSingolo'
import { CaricaFile, CartelloQR, Gestori, Statistiche } from '../components/PartiLocale'
import { useConferma, cls, bottone, Intestazione, Schede } from '../components/ui'

type Scheda = 'riepilogo' | 'info' | 'aspetto' | 'vetrina' | 'gestori'

const VUOTO: Partial<Locale> = {
  nome: '', dove: '', skin: 'locali', tipo: null, macro: false, raggio_m: 150, attivo: false, tema: {}, orari: [], dal: null, al: null,
  lat: 41.0753, lon: 14.2903,
}

const riquadro = `${cls.riquadro} p-5 space-y-4`
const campo = cls.campo
const etichetta = cls.etichetta

/* datetime-local vuole l'ora locale senza fuso. */
const aLocale = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const daLocale = (v: string) => (v ? new Date(v).toISOString() : null)

/* `gestore`: chi gestisce il locale (non admin) cambia solo saluto, testi,
   logo, orari e vetrina; il resto lo vede ma non lo tocca. */
export default function LocaleDetail({ gestore = false }: { gestore?: boolean }) {
  const conferma = useConferma()
  const { id } = useParams<{ id: string }>()
  const nuovo = !gestore && id === 'new'
  const elenco = gestore ? '/miei-locali' : '/locali'
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useToast()
  const [l, setL] = useState<Partial<Locale>>(VUOTO)
  const [voci, setVoci] = useState<VoceVetrina[]>([])
  const [caricamento, setCaricamento] = useState(!nuovo)
  const [salvo, setSalvo] = useState(false)
  /* Com'era all'ultimo caricamento o salvataggio: se e' diverso ci sono
     modifiche da salvare. */
  const [base, setBase] = useState('')
  const [scheda, setScheda] = useState<Scheda>(nuovo ? 'info' : 'riepilogo')
  const mappaRef = useRef<HTMLDivElement>(null)
  const mappa = useRef<L.Map | null>(null)
  const segno = useRef<L.Marker | null>(null)
  const cerchio = useRef<L.Circle | null>(null)

  useEffect(() => {
    if (nuovo) return
    Promise.all([getLocale(id!), vociVetrina(id!)])
      .then(([loc, v]) => { if (!loc) { navigate(elenco); return } setL(loc); setVoci(v); setBase(JSON.stringify([loc, v])) })
      .catch(e => toastError(e.message))
      .finally(() => setCaricamento(false))
  }, [id])

  const sporco = !caricamento && (nuovo ? !!l.nome?.trim() : base !== '' && JSON.stringify([l, voci]) !== base)
  // Chiudendo o ricaricando la scheda del browser con modifiche in sospeso.
  useEffect(() => {
    if (!sporco) return
    const avvisa = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', avvisa)
    return () => window.removeEventListener('beforeunload', avvisa)
  }, [sporco])
  function annulla() {
    if (!base) return
    const [loc, v] = JSON.parse(base); setL(loc); setVoci(v)
  }

  /* Le schede: prima undici riquadri in fila su due colonne. Il gestore
     vede per prima cosa i numeri e il QR. */
  const schede: { id: Scheda; nome: string; conta?: number }[] = [
    ...(!nuovo ? [{ id: 'riepilogo' as const, nome: gestore ? 'Riepilogo' : 'QR e statistiche' }] : []),
    { id: 'info', nome: gestore ? 'Orari' : 'Informazioni' },
    { id: 'aspetto', nome: 'Aspetto' },
    { id: 'vetrina', nome: 'Vetrina', conta: voci.length },
    ...(!nuovo && !gestore ? [{ id: 'gestori' as const, nome: 'Gestori' }] : []),
  ]

  const aggiorna = (p: Partial<Locale>) => setL(x => ({ ...x, ...p }))
  const tema = l.tema ?? {}
  const aggiornaTema = (p: Partial<NonNullable<Locale['tema']>>) => aggiorna({ tema: { ...tema, ...p } })

  // La mappa: clic o trascinamento per il punto, il cerchio e' il raggio.
  useEffect(() => {
    if (caricamento || scheda !== 'info' || !mappaRef.current || mappa.current) return
    const m = L.map(mappaRef.current).setView([l.lat!, l.lon!], 16)
    L.tileLayer(OSM_TILES, OSM_OPTIONS).addTo(m)
    segno.current = L.marker([l.lat!, l.lon!], { draggable: true }).addTo(m)
    cerchio.current = L.circle([l.lat!, l.lon!], { radius: l.raggio_m!, color: '#C4503A', weight: 1.5, fillOpacity: 0.08 }).addTo(m)
    const sposta = (la: number, lo: number) => aggiorna({ lat: +la.toFixed(6), lon: +lo.toFixed(6) })
    segno.current.on('dragend', (e: any) => { const p = e.target.getLatLng(); sposta(p.lat, p.lng) })
    suClicSingolo(m, (e: L.LeafletMouseEvent) => sposta(e.latlng.lat, e.latlng.lng))
    mappa.current = m
    return () => { m.remove(); mappa.current = null; segno.current = null; cerchio.current = null }
  }, [caricamento, scheda])

  useEffect(() => {
    if (!segno.current || !cerchio.current) return
    segno.current.setLatLng([l.lat!, l.lon!])
    cerchio.current.setLatLng([l.lat!, l.lon!]).setRadius(l.raggio_m || 0)
  }, [l.lat, l.lon, l.raggio_m])

  // ── Fasce orarie ──
  const orari = l.orari ?? []
  const cambiaFascia = (i: number, p: Partial<Fascia>) => aggiorna({ orari: orari.map((f, j) => (j === i ? { ...f, ...p } : f)) })
  const giornoFascia = (i: number, g: number) => {
    const f = orari[i]
    cambiaFascia(i, { giorni: f.giorni.includes(g) ? f.giorni.filter(x => x !== g) : [...f.giorni, g].sort() })
  }

  // ── Vetrina ──
  const cambiaVoce = (i: number, p: Partial<VoceVetrina>) => setVoci(v => v.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const spostaVoce = (i: number, d: number) => setVoci(v => {
    const j = i + d
    if (j < 0 || j >= v.length) return v
    const c = [...v]; [c[i], c[j]] = [c[j], c[i]]; return c
  })

  async function salva() {
    if (!l.nome?.trim()) { toastError('Il nome è obbligatorio'); return }
    if (orari.some(f => !f.giorni.length)) { toastError('Ogni fascia oraria deve avere almeno un giorno'); return }
    if (l.dal && l.al && l.al <= l.dal) { toastError('La fine del periodo è prima dell’inizio'); return }
    setSalvo(true)
    try {
      const nuovoId = gestore ? (await salvaComeGestore(l), id!) : await salvaLocale(l)
      await salvaVetrina(nuovoId, voci)
      toastSuccess('Locale salvato')
      if (nuovo) navigate(`${elenco}/${nuovoId}`, { replace: true })
      else { const [loc, v] = await Promise.all([getLocale(nuovoId), vociVetrina(nuovoId)]); if (loc) setL(loc); setVoci(v); setBase(JSON.stringify([loc, v])) }
    } catch (e: any) {
      toastError(e.message)
    } finally { setSalvo(false) }
  }

  async function elimina() {
    if (!(await conferma({ titolo: `Eliminare ${l.nome}?`, testo: 'Con la vetrina, i gestori e le statistiche. Non si può annullare.', conferma: 'Elimina', pericolo: true }))) return
    try { await eliminaLocale(id!); toastSuccess('Locale eliminato'); navigate('/locali') }
    catch (e: any) { toastError(e.message) }
  }

  if (caricamento) return <div className="text-sm text-gray-400 py-8 text-center">Caricamento…</div>

  const stato = `${l.attivo ? (l.aperto_ora === false ? 'Attivo · fuori orario adesso' : 'Attivo') : 'Spento'} · ${descriviDisponibilita({ dal: l.dal ?? null, al: l.al ?? null, orari })}`

  return (
    <div className="space-y-5 max-w-5xl pb-24">
      <Intestazione indietro={elenco} titolo={nuovo ? 'Nuovo locale' : l.nome} sottotitolo={stato}
        azioni={!nuovo && !gestore && <button onClick={elimina} className={bottone('pericolo')}><Trash2 className="w-4 h-4" />Elimina</button>} />

      <Schede schede={schede} attiva={scheda} onScegli={setScheda} />

      {scheda === 'riepilogo' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <section className={riquadro}>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Statistiche</h2>
            <Statistiche localeId={id!} />
          </section>
          <section className={riquadro}>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">QR per i tavoli</h2>
            <CartelloQR locale={{ ...l, id: id! }} />
          </section>
          {gestore && (
            <section className={`${riquadro} lg:col-span-2`}>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Il tuo locale</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">{l.dove || 'Senza indirizzo'} · raggio {l.raggio_m} m · {l.attivo ? 'attivo' : 'spento'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Dalle schede qui sopra cambi orari, vetrina, saluto, testi e logo. Posizione, raggio e stile li cura POPQua: scrivici se vanno cambiati.</p>
            </section>
          )}
        </div>
      )}

      {scheda === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <div className="space-y-5">
          {!gestore && <section className={riquadro}>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Informazioni</h2>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">Attivo <span className="text-gray-400">(lo stile si può proporre)</span></span>
              <input type="checkbox" checked={!!l.attivo} onChange={e => aggiorna({ attivo: e.target.checked })} className="w-5 h-5 accent-brand-600" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">Macro locale <span className="text-gray-400">(quartiere, paese, centro commerciale: contiene altri locali; raggio fino a 20 km)</span></span>
              <input type="checkbox" checked={!!l.macro} onChange={e => aggiorna({ macro: e.target.checked, ...(!e.target.checked && (l.raggio_m ?? 0) > 2000 ? { raggio_m: 2000 } : {}) })} className="w-5 h-5 accent-brand-600" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={etichetta}>Nome</label><input className={campo} value={l.nome ?? ''} onChange={e => aggiorna({ nome: e.target.value })} /></div>
              <div><label className={etichetta}>Dove (sottotitolo)</label><input className={campo} value={l.dove ?? ''} onChange={e => aggiorna({ dove: e.target.value })} /></div>
              <div>
                <label className={etichetta}>Tipo di posto</label>
                <select className={campo} value={l.tipo ?? ''} onChange={e => {
                  const t = tipoDiPosto(e.target.value)
                  if (!t) { aggiorna({ tipo: null }); return }
                  // Il tipo porta la sua skin (e l'emoji, se non c'e' gia').
                  const nuovoTema = { ...tema, emoji: tema.emoji || t.emoji }
                  if (t.skin === 'custom' && !tema.aspetto) nuovoTema.aspetto = structuredClone(PARTENZE.pub.aspetto)
                  // Quartiere, paese e centro commerciale sono macro locali.
                  const macro = ['quartiere', 'paese', 'centro'].includes(t.id)
                  aggiorna({ tipo: t.id, skin: t.skin, tema: nuovoTema, ...(macro ? { macro: true, raggio_m: Math.max(l.raggio_m ?? 150, 1500) } : {}) })
                }}>
                  <option value="">— scegli —</option>
                  {CATEGORIE.map(c => (
                    <optgroup key={c.nome} label={c.nome}>
                      {c.tipi.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.nome}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className={etichetta}>Skin (predefinita dal tipo, si può cambiare)</label>
                <select className={campo} value={l.skin} onChange={e => {
                  const skin = e.target.value
                  // Passando a su misura si parte da un aspetto pronto da modificare.
                  aggiorna(skin === 'custom' && !tema.aspetto ? { skin, tema: { ...tema, aspetto: structuredClone(PARTENZE.pub.aspetto) } } : { skin })
                }}>
                  {SKIN_GRUPPI.map(g => (
                    <optgroup key={g.gruppo} label={g.gruppo}>
                      {g.skin.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div><label className={etichetta}>Raggio (m)</label><input type="number" min={30} max={l.macro ? 20000 : 2000} className={campo} value={l.raggio_m ?? 150} onChange={e => aggiorna({ raggio_m: Number(e.target.value) })} /></div>
            </div>
          </section>}
          {/* Disponibilita' */}
          <section className={riquadro}>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Quando è disponibile</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Senza periodo e senza fasce: sempre. Le fasce che finiscono prima di iniziare passano la mezzanotte (es. 19:00–02:00).</p>
            </div>
            {!gestore && <div className="grid grid-cols-2 gap-3">
              <div><label className={etichetta}>Dal (facoltativo)</label><input type="datetime-local" className={campo} value={aLocale(l.dal)} onChange={e => aggiorna({ dal: daLocale(e.target.value) })} /></div>
              <div><label className={etichetta}>Al (facoltativo)</label><input type="datetime-local" className={campo} value={aLocale(l.al)} onChange={e => aggiorna({ al: daLocale(e.target.value) })} /></div>
            </div>}
            <div className="space-y-3">
              {orari.map((f, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex gap-1">
                    {GIORNI.map((g, k) => (
                      <button key={g} type="button" onClick={() => giornoFascia(i, k + 1)}
                        className={`w-9 py-1 text-xs font-semibold rounded-md ${f.giorni.includes(k + 1) ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-500 border border-gray-200 dark:border-gray-700'}`}>{g}</button>
                    ))}
                  </div>
                  <input type="time" className={`${campo} w-28`} value={f.dalle} onChange={e => cambiaFascia(i, { dalle: e.target.value })} />
                  <span className="text-gray-400">–</span>
                  <input type="time" className={`${campo} w-28`} value={f.alle} onChange={e => cambiaFascia(i, { alle: e.target.value })} />
                  <button onClick={() => aggiorna({ orari: orari.filter((_, j) => j !== i) })} className="p-1.5 text-gray-400 hover:text-rose-500" title="Togli fascia"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => aggiorna({ orari: [...orari, { giorni: [1, 2, 3, 4, 5, 6, 7], dalle: '19:00', alle: '23:59' }] })}
                className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"><Plus className="w-4 h-4" />Aggiungi fascia oraria</button>
            </div>
          </section>
          </div>
          {!gestore && <div className="space-y-5">
          {/* Posizione */}
          {!gestore && <section className={riquadro}>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Posizione e raggio</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Clic sulla mappa o trascina il segnaposto. {l.lat}, {l.lon}</p>
            </div>
            <div ref={mappaRef} className="h-72 rounded-lg overflow-hidden z-0" />
          </section>}
          </div>}
        </div>
      )}

      {scheda === 'aspetto' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <div className="space-y-5">
          {/* Stile */}
          <section className={riquadro}>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Stile del locale</h2>
            <StilePosto tema={tema} onTema={aggiornaTema} senzaColore={gestore}
              salutoPredefinito={`Sei da ${l.nome || 'nome'}`} esempioSaluto={`Sei al ${l.nome || 'Diesis'}`} />
            <div>
              <label className={etichetta}>Logo (PNG, JPG o WebP quadrato, massimo 512 KB): nell'app prende il posto dell'emoji, e lo vede solo chi è sul posto</label>
              {nuovo ? <p className="text-xs text-gray-400">Salva il locale prima di caricare il logo.</p>
                : <CaricaFile localeId={id!} tipo="logo" url={tema.logo_url} onUrl={u => aggiornaTema({ logo_url: u })} />}
            </div>
          </section>
          {/* Aspetto su misura */}
          {!gestore && l.skin === 'custom' && tema.aspetto && (
            <section className={riquadro}>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Aspetto su misura</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tutto lo stile del locale: colori, sfondo, caratteri, come sono fatti i messaggi e il pulsante. Anteprima a destra.</p>
              </div>
              <EditorSuMisura a={tema.aspetto} onChange={a => aggiornaTema({ aspetto: a })} />
              <div>
                <label className={etichetta}>Carattere dei titoli da file (.woff2, facoltativo: vince su quello scelto sopra; si scarica solo sul posto)</label>
                {nuovo ? <p className="text-xs text-gray-400">Salva il locale prima di caricare file.</p>
                  : <CaricaFile localeId={id!} tipo="font" url={tema.font_url} onUrl={u => aggiornaTema({ font_url: u })} />}
              </div>
            </section>
          )}
          </div>
          <div className="space-y-5 lg:sticky lg:top-0">
          {!gestore && l.skin === 'custom' && tema.aspetto && (
            <section className={`${riquadro}`}>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Anteprima</h2>
              <div className="max-w-xs mx-auto"><AnteprimaSuMisura a={tema.aspetto} nome={l.nome ?? ''} lascia={tema.testi?.lascia ?? ''} /></div>
            </section>
          )}
          </div>
        </div>
      )}

      {scheda === 'vetrina' && (
        <div className="max-w-3xl">
          {/* Vetrina */}
          <section className={riquadro}>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Vetrina (menù, corsi, orari…)</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Le sezioni diventano le schede, le etichette i filtri. Si salva con il pulsante Salva in basso.</p>
            </div>
            {voci.map((v, i) => (
              <div key={v.id ?? `n${i}`} className={`p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2 ${v.disponibile ? '' : 'opacity-60'}`}>
                <div className="flex gap-2">
                  <input className={`${campo} w-1/3`} placeholder="Sezione" value={v.sezione} onChange={e => cambiaVoce(i, { sezione: e.target.value })} />
                  <input className={campo} placeholder="Nome" value={v.nome} onChange={e => cambiaVoce(i, { nome: e.target.value })} />
                  <input className={`${campo} w-24`} type="number" step="0.5" placeholder="€" value={v.prezzo ?? ''} onChange={e => cambiaVoce(i, { prezzo: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
                <input className={campo} placeholder="Descrizione" value={v.descrizione ?? ''} onChange={e => cambiaVoce(i, { descrizione: e.target.value })} />
                <div className="flex items-center gap-2">
                  <input className={campo} placeholder="Etichette separate da virgola (vegano, della casa…)" value={v.etichette.join(', ')}
                    onChange={e => cambiaVoce(i, { etichette: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                  <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                    <input type="checkbox" checked={v.disponibile} onChange={e => cambiaVoce(i, { disponibile: e.target.checked })} className="accent-brand-600" />disponibile
                  </label>
                  <button onClick={() => spostaVoce(i, -1)} className="p-1 text-gray-400 hover:text-gray-700" title="Su"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => spostaVoce(i, 1)} className="p-1 text-gray-400 hover:text-gray-700" title="Giù"><ChevronDown className="w-4 h-4" /></button>
                  <button onClick={() => setVoci(x => x.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-rose-500" title="Togli"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            <button onClick={() => setVoci(x => [...x, { sezione: x[x.length - 1]?.sezione ?? '', ordine: x.length + 1, nome: '', descrizione: null, prezzo: null, etichette: [], disponibile: true }])}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"><Plus className="w-4 h-4" />Aggiungi voce</button>
          </section>
        </div>
      )}

      {scheda === 'gestori' && (
        <section className={`${riquadro} max-w-2xl`}>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Gestori</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Chi gestisce il locale entra in questo pannello con il suo account e vede solo «I miei locali».</p>
          </div>
          <Gestori localeId={id!} />
        </section>
      )}

      {/* La barra del salvataggio: sempre in vista, dice se ci sono
          modifiche da salvare. Prima "Salva" stava solo in cima e chi
          lavorava sulla vetrina, in fondo, doveva risalire. */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-60 z-20 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <span className={`text-sm flex-1 ${sporco ? 'text-brand-700 dark:text-brand-300 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
            {sporco ? 'Modifiche non salvate' : nuovo ? 'Locale nuovo, non ancora salvato' : 'Tutto salvato'}
          </span>
          {sporco && !nuovo && <button onClick={annulla} className={bottone('quieto')}>Annulla modifiche</button>}
          <button onClick={salva} disabled={salvo || (!sporco && !nuovo)} className={bottone()}>
            <Save className="w-4 h-4" />{salvo ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}
