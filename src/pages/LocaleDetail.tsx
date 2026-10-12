import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Plus, X, ChevronUp, ChevronDown } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { OSM_TILES, OSM_OPTIONS } from '../lib/mapTiles'
import {
  getLocale, salvaLocale, eliminaLocale, vociVetrina, salvaVetrina, descriviDisponibilita,
  SKIN_GRUPPI, CATEGORIE, tipoDiPosto, GIORNI, type Locale, type Fascia, type VoceVetrina,
} from '../lib/locali'
import { useToast } from '../components/Toast'
import { EditorSuMisura, AnteprimaSuMisura, PARTENZE } from '../components/EditorSuMisura'
import { StilePosto } from '../components/StilePosto'

const VUOTO: Partial<Locale> = {
  nome: '', dove: '', skin: 'locali', tipo: null, macro: false, raggio_m: 150, attivo: false, tema: {}, orari: [], dal: null, al: null,
  lat: 41.0753, lon: 14.2903,
}

const riquadro = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4'
const campo = 'w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white'
const etichetta = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

/* datetime-local vuole l'ora locale senza fuso. */
const aLocale = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const daLocale = (v: string) => (v ? new Date(v).toISOString() : null)

export default function LocaleDetail() {
  const { id } = useParams<{ id: string }>()
  const nuovo = id === 'new'
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useToast()
  const [l, setL] = useState<Partial<Locale>>(VUOTO)
  const [voci, setVoci] = useState<VoceVetrina[]>([])
  const [caricamento, setCaricamento] = useState(!nuovo)
  const [salvo, setSalvo] = useState(false)
  const mappaRef = useRef<HTMLDivElement>(null)
  const mappa = useRef<L.Map | null>(null)
  const segno = useRef<L.Marker | null>(null)
  const cerchio = useRef<L.Circle | null>(null)

  useEffect(() => {
    if (nuovo) return
    Promise.all([getLocale(id!), vociVetrina(id!)])
      .then(([loc, v]) => { if (!loc) { navigate('/locali'); return } setL(loc); setVoci(v) })
      .catch(e => toastError(e.message))
      .finally(() => setCaricamento(false))
  }, [id])

  const aggiorna = (p: Partial<Locale>) => setL(x => ({ ...x, ...p }))
  const tema = l.tema ?? {}
  const aggiornaTema = (p: Partial<NonNullable<Locale['tema']>>) => aggiorna({ tema: { ...tema, ...p } })

  // La mappa: clic o trascinamento per il punto, il cerchio e' il raggio.
  useEffect(() => {
    if (caricamento || !mappaRef.current || mappa.current) return
    const m = L.map(mappaRef.current).setView([l.lat!, l.lon!], 16)
    L.tileLayer(OSM_TILES, OSM_OPTIONS).addTo(m)
    segno.current = L.marker([l.lat!, l.lon!], { draggable: true }).addTo(m)
    cerchio.current = L.circle([l.lat!, l.lon!], { radius: l.raggio_m!, color: '#4f46e5', weight: 1.5, fillOpacity: 0.08 }).addTo(m)
    const sposta = (la: number, lo: number) => aggiorna({ lat: +la.toFixed(6), lon: +lo.toFixed(6) })
    segno.current.on('dragend', (e: any) => { const p = e.target.getLatLng(); sposta(p.lat, p.lng) })
    m.on('click', (e: L.LeafletMouseEvent) => sposta(e.latlng.lat, e.latlng.lng))
    mappa.current = m
    return () => { m.remove(); mappa.current = null }
  }, [caricamento])

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
      const nuovoId = await salvaLocale(l)
      await salvaVetrina(nuovoId, voci)
      toastSuccess('Locale salvato')
      if (nuovo) navigate(`/locali/${nuovoId}`, { replace: true })
      else { const [loc, v] = await Promise.all([getLocale(nuovoId), vociVetrina(nuovoId)]); if (loc) setL(loc); setVoci(v) }
    } catch (e: any) {
      toastError(e.message)
    } finally { setSalvo(false) }
  }

  async function elimina() {
    if (!confirm(`Eliminare ${l.nome} e la sua vetrina?`)) return
    try { await eliminaLocale(id!); toastSuccess('Locale eliminato'); navigate('/locali') }
    catch (e: any) { toastError(e.message) }
  }

  if (caricamento) return <div className="text-sm text-gray-400 py-8 text-center">Caricamento…</div>

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/locali')} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{nuovo ? 'Nuovo locale' : l.nome}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {l.attivo ? (l.aperto_ora === false ? 'Attivo · fuori orario adesso' : 'Attivo') : 'Spento'} · {descriviDisponibilita({ dal: l.dal ?? null, al: l.al ?? null, orari })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!nuovo && (
            <button onClick={elimina} className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 border border-rose-200 dark:border-rose-900 rounded-xl text-sm font-medium">
              <Trash2 className="w-4 h-4" />Elimina
            </button>
          )}
          <button onClick={salva} disabled={salvo} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm">
            <Save className="w-4 h-4" />{salvo ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Informazioni */}
          <section className={riquadro}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Informazioni</h2>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">Attivo <span className="text-gray-400">(lo stile si può proporre)</span></span>
              <input type="checkbox" checked={!!l.attivo} onChange={e => aggiorna({ attivo: e.target.checked })} className="w-5 h-5 accent-indigo-600" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">Macro locale <span className="text-gray-400">(quartiere, paese, centro commerciale: contiene altri locali; raggio fino a 20 km)</span></span>
              <input type="checkbox" checked={!!l.macro} onChange={e => aggiorna({ macro: e.target.checked, ...(!e.target.checked && (l.raggio_m ?? 0) > 2000 ? { raggio_m: 2000 } : {}) })} className="w-5 h-5 accent-indigo-600" />
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
          </section>

          {/* Disponibilita' */}
          <section className={riquadro}>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Quando è disponibile</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Senza periodo e senza fasce: sempre. Le fasce che finiscono prima di iniziare passano la mezzanotte (es. 19:00–02:00).</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={etichetta}>Dal (facoltativo)</label><input type="datetime-local" className={campo} value={aLocale(l.dal)} onChange={e => aggiorna({ dal: daLocale(e.target.value) })} /></div>
              <div><label className={etichetta}>Al (facoltativo)</label><input type="datetime-local" className={campo} value={aLocale(l.al)} onChange={e => aggiorna({ al: daLocale(e.target.value) })} /></div>
            </div>
            <div className="space-y-3">
              {orari.map((f, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex gap-1">
                    {GIORNI.map((g, k) => (
                      <button key={g} type="button" onClick={() => giornoFascia(i, k + 1)}
                        className={`w-9 py-1 text-xs font-semibold rounded-md ${f.giorni.includes(k + 1) ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-500 border border-gray-200 dark:border-gray-700'}`}>{g}</button>
                    ))}
                  </div>
                  <input type="time" className={`${campo} w-28`} value={f.dalle} onChange={e => cambiaFascia(i, { dalle: e.target.value })} />
                  <span className="text-gray-400">–</span>
                  <input type="time" className={`${campo} w-28`} value={f.alle} onChange={e => cambiaFascia(i, { alle: e.target.value })} />
                  <button onClick={() => aggiorna({ orari: orari.filter((_, j) => j !== i) })} className="p-1.5 text-gray-400 hover:text-rose-500" title="Togli fascia"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => aggiorna({ orari: [...orari, { giorni: [1, 2, 3, 4, 5, 6, 7], dalle: '19:00', alle: '23:59' }] })}
                className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"><Plus className="w-4 h-4" />Aggiungi fascia oraria</button>
            </div>
          </section>

          {/* Aspetto su misura */}
          {l.skin === 'custom' && tema.aspetto && (
            <section className={riquadro}>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Aspetto su misura</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tutto lo stile del locale: colori, sfondo, caratteri, come sono fatti i messaggi e il pulsante. Anteprima a destra.</p>
              </div>
              <EditorSuMisura a={tema.aspetto} onChange={a => aggiornaTema({ aspetto: a })} />
            </section>
          )}

          {/* Stile */}
          <section className={riquadro}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Stile del locale</h2>
            <StilePosto tema={tema} onTema={aggiornaTema}
              salutoPredefinito={`Sei da ${l.nome || 'nome'}`} esempioSaluto={`Sei al ${l.nome || 'Diesis'}`} />
          </section>
        </div>

        <div className="space-y-6">
          {l.skin === 'custom' && tema.aspetto && (
            <section className={`${riquadro} lg:sticky lg:top-0`}>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Anteprima</h2>
              <div className="max-w-xs mx-auto"><AnteprimaSuMisura a={tema.aspetto} nome={l.nome ?? ''} lascia={tema.testi?.lascia ?? ''} /></div>
            </section>
          )}

          {/* Posizione */}
          <section className={riquadro}>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Posizione e raggio</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Clic sulla mappa o trascina il segnaposto. {l.lat}, {l.lon}</p>
            </div>
            <div ref={mappaRef} className="h-72 rounded-lg overflow-hidden z-0" />
          </section>

          {/* Vetrina */}
          <section className={riquadro}>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Vetrina (menù, corsi, orari…)</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Le sezioni diventano le schede, le etichette i filtri. Si salva con il pulsante in alto.</p>
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
                    <input type="checkbox" checked={v.disponibile} onChange={e => cambiaVoce(i, { disponibile: e.target.checked })} className="accent-indigo-600" />disponibile
                  </label>
                  <button onClick={() => spostaVoce(i, -1)} className="p-1 text-gray-400 hover:text-gray-700" title="Su"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => spostaVoce(i, 1)} className="p-1 text-gray-400 hover:text-gray-700" title="Giù"><ChevronDown className="w-4 h-4" /></button>
                  <button onClick={() => setVoci(x => x.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-rose-500" title="Togli"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            <button onClick={() => setVoci(x => [...x, { sezione: x[x.length - 1]?.sezione ?? '', ordine: x.length + 1, nome: '', descrizione: null, prezzo: null, etichette: [], disponibile: true }])}
              className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"><Plus className="w-4 h-4" />Aggiungi voce</button>
          </section>
        </div>
      </div>
    </div>
  )
}
