import { useEffect, useRef, useState } from 'react'
import { Lock, KeyRound, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { OSM_TILES, OSM_OPTIONS } from '../lib/mapTiles'
import { esc } from '../lib/escapeHtml'

/* Capsule: messaggi che si vedono da lontano e si aprono sul posto.
 *
 * Due distanze, sempre scelte qui: entro la VISIBILITA' il telefono mostra
 * il lucchetto con titolo e indizio, entro l'APERTURA si puo' aprire. Il
 * contenuto non lascia mai il server prima dell'apertura (apri_capsula). */

interface Capsula {
  id: string
  titolo: string
  indizio: string | null
  contenuto: string
  immagine_url: string | null
  lat: number
  lon: number
  raggio_visibilita: number
  raggio_apertura: number
  modo_posizione: 'esatta' | 'zona' | 'caldo_freddo'
  apre_dal: string | null
  scade_il: string | null
  max_aperture: number | null
  sparisci_se_esaurita: boolean
  ha_parola: boolean
  parola_indizio: string | null
  subdomain: string | null
  stato: 'bozza' | 'attiva' | 'archiviata'
  creato: string
  aperture: number
}

interface Bozza {
  id: string | null
  titolo: string
  indizio: string
  contenuto: string
  immagine_url: string
  lat: number | null
  lon: number | null
  raggio_visibilita: number
  raggio_apertura: number
  modo_posizione: Capsula['modo_posizione']
  apre_dal: string
  scade_il: string
  max_aperture: string
  sparisci_se_esaurita: boolean
  ha_parola: boolean
  parola: string
  rimuovi_parola: boolean
  parola_indizio: string
  subdomain: string
  stato: Capsula['stato']
}

const VUOTA: Bozza = {
  id: null, titolo: '', indizio: '', contenuto: '', immagine_url: '', lat: null, lon: null,
  raggio_visibilita: 1000, raggio_apertura: 30, modo_posizione: 'esatta',
  apre_dal: '', scade_il: '', max_aperture: '', sparisci_se_esaurita: false,
  ha_parola: false, parola: '', rimuovi_parola: false, parola_indizio: '', subdomain: '', stato: 'attiva',
}

// Scale non lineari: tra 15 m e 50 km un cursore lineare renderebbe
// impossibile scegliere 30 m.
const PASSI = [15, 20, 30, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000, 20000, 50000]

const MODI = [
  { id: 'esatta',       label: 'Punto esatto',  aiuto: 'Il lucchetto sta dove sta la capsula.' },
  { id: 'zona',         label: 'Zona',          aiuto: 'Si vede solo una zona di 200 m: bisogna cercare.' },
  { id: 'caldo_freddo', label: 'Caldo/freddo',  aiuto: 'Nessun punto sulla mappa, solo la distanza.' },
] as const

const SOTTODOMINI = [
  { id: '', label: 'Tutte le app' }, { id: 'default', label: 'POPQua' }, { id: 'food', label: 'FoodQua' },
  { id: 'fitness', label: 'FitQua' }, { id: 'teora', label: 'TeoraQua' }, { id: 'basket', label: 'BasketQua' },
]

function metri(m: number) { return m >= 1000 ? `${(m / 1000).toLocaleString('it-IT')} km` : `${m} m` }

// datetime-local vuole "AAAA-MM-GGTHH:MM" nell'ora locale.
function perInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function daCapsula(c: Capsula): Bozza {
  return {
    id: c.id, titolo: c.titolo, indizio: c.indizio ?? '', contenuto: c.contenuto, immagine_url: c.immagine_url ?? '',
    lat: c.lat, lon: c.lon, raggio_visibilita: c.raggio_visibilita, raggio_apertura: c.raggio_apertura,
    modo_posizione: c.modo_posizione, apre_dal: perInput(c.apre_dal), scade_il: perInput(c.scade_il),
    max_aperture: c.max_aperture ? String(c.max_aperture) : '', sparisci_se_esaurita: c.sparisci_se_esaurita,
    ha_parola: c.ha_parola, parola: '', rimuovi_parola: false, parola_indizio: c.parola_indizio ?? '',
    subdomain: c.subdomain ?? '', stato: c.stato,
  }
}

function iconaLucchetto(colore: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${colore};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:14px">🔒</div>`,
    iconSize: [30, 30], iconAnchor: [15, 15],
  })
}

const COLORE_STATO: Record<Capsula['stato'], string> = { attiva: '#d97706', bozza: '#6b7280', archiviata: '#9ca3af' }

export default function Capsule() {
  const mapRef     = useRef<HTMLDivElement>(null)
  const mappa      = useRef<L.Map | null>(null)
  const livello    = useRef<L.LayerGroup | null>(null)
  const cerchi     = useRef<L.LayerGroup | null>(null)

  const [capsule, setCapsule] = useState<Capsula[]>([])
  const [caricando, setCaricando] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [esito, setEsito] = useState<string | null>(null)
  const [bozza, setBozza] = useState<Bozza | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Il clic sulla mappa aggiorna la bozza aperta, se ce n'e' una: il
  // gestore e' registrato una volta sola, quindi legge da un riferimento.
  const bozzaRef = useRef<Bozza | null>(null)
  bozzaRef.current = bozza

  async function carica() {
    setCaricando(true); setErrore(null)
    const { data, error } = await supabase.rpc('admin_capsule')
    if (error) setErrore(error.message)
    else setCapsule((data ?? []) as Capsula[])
    setCaricando(false)
  }

  useEffect(() => {
    if (!mapRef.current || mappa.current) return
    const m = L.map(mapRef.current).setView([40.85, 14.27], 9)
    mappa.current = m
    L.tileLayer(OSM_TILES, OSM_OPTIONS).addTo(m)
    livello.current = L.layerGroup().addTo(m)
    cerchi.current = L.layerGroup().addTo(m)

    m.on('click', (e: L.LeafletMouseEvent) => {
      const b = bozzaRef.current ?? { ...VUOTA }
      setBozza({ ...b, lat: e.latlng.lat, lon: e.latlng.lng })
      setEsito(null)
    })

    setTimeout(() => m.invalidateSize(), 100)
    carica()
    return () => { m.remove(); mappa.current = null }
  }, [])

  // Lucchetti delle capsule esistenti
  useEffect(() => {
    const m = mappa.current, g = livello.current
    if (!m || !g) return
    g.clearLayers()
    for (const c of capsule) {
      const marker = L.marker([c.lat, c.lon], { icon: iconaLucchetto(COLORE_STATO[c.stato]) })
      marker.bindTooltip(
        `<b>${esc(c.titolo)}</b><br>${c.aperture}${c.max_aperture ? ` / ${c.max_aperture}` : ''} aperture · ${esc(c.stato)}`,
        { direction: 'top' },
      )
      marker.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
        setBozza(daCapsula(c)); setEsito(null)
      })
      marker.addTo(g)
    }
    if (capsule.length > 0 && !bozzaRef.current) {
      m.fitBounds(L.latLngBounds(capsule.map(c => [c.lat, c.lon] as L.LatLngTuple)).pad(0.3), { maxZoom: 15 })
    }
  }, [capsule])

  // I due cerchi della bozza: visibilita' tratteggiata, apertura piena
  useEffect(() => {
    const g = cerchi.current
    if (!g) return
    g.clearLayers()
    if (!bozza || bozza.lat == null || bozza.lon == null) return
    const centro: L.LatLngTuple = [bozza.lat, bozza.lon]
    L.circle(centro, { radius: bozza.raggio_visibilita, color: '#d97706', weight: 2, dashArray: '6 5', fillOpacity: 0.04 }).addTo(g)
    L.circle(centro, { radius: bozza.raggio_apertura, color: '#b45309', weight: 2, fillColor: '#f59e0b', fillOpacity: 0.3 }).addTo(g)
    L.marker(centro, { icon: iconaLucchetto('#b45309') }).addTo(g)
  }, [bozza?.lat, bozza?.lon, bozza?.raggio_visibilita, bozza?.raggio_apertura])

  function aggiorna<K extends keyof Bozza>(campo: K, valore: Bozza[K]) {
    setBozza(b => {
      if (!b) return b
      const nuova = { ...b, [campo]: valore }
      // L'apertura non supera mai la visibilita': chi allarga l'una
      // trascina l'altra, invece di vedersi rifiutare il salvataggio.
      if (campo === 'raggio_apertura' && nuova.raggio_apertura > nuova.raggio_visibilita) nuova.raggio_visibilita = nuova.raggio_apertura
      if (campo === 'raggio_visibilita' && nuova.raggio_visibilita < nuova.raggio_apertura) nuova.raggio_apertura = nuova.raggio_visibilita
      return nuova
    })
  }

  async function salva(e: React.FormEvent) {
    e.preventDefault()
    if (!bozza || bozza.lat == null || bozza.lon == null) return
    setSalvando(true); setErrore(null); setEsito(null)

    const { data, error } = await supabase.rpc('admin_salva_capsula', {
      p: {
        id: bozza.id,
        titolo: bozza.titolo.trim(),
        indizio: bozza.indizio.trim(),
        contenuto: bozza.contenuto.trim(),
        immagine_url: bozza.immagine_url.trim(),
        lat: bozza.lat, lon: bozza.lon,
        raggio_visibilita: bozza.raggio_visibilita,
        raggio_apertura: bozza.raggio_apertura,
        modo_posizione: bozza.modo_posizione,
        apre_dal: bozza.apre_dal ? new Date(bozza.apre_dal).toISOString() : '',
        scade_il: bozza.scade_il ? new Date(bozza.scade_il).toISOString() : '',
        max_aperture: bozza.max_aperture,
        sparisci_se_esaurita: bozza.sparisci_se_esaurita,
        parola: bozza.rimuovi_parola ? '' : bozza.parola,
        rimuovi_parola: bozza.rimuovi_parola,
        parola_indizio: bozza.parola_indizio.trim(),
        subdomain: bozza.subdomain,
        stato: bozza.stato,
      },
    })

    setSalvando(false)
    if (error) { setErrore(error.message); return }
    setEsito(bozza.id ? 'Capsula aggiornata.' : 'Capsula creata.')
    await carica()
    const salvata = (await supabase.rpc('admin_capsule')).data?.find((c: Capsula) => c.id === data)
    setBozza(salvata ? daCapsula(salvata) : null)
  }

  async function elimina() {
    if (!bozza?.id) return
    if (!window.confirm(`Eliminare "${bozza.titolo}"? Si perdono anche le aperture registrate.`)) return
    const { error } = await supabase.rpc('admin_elimina_capsula', { p_id: bozza.id })
    if (error) { setErrore(error.message); return }
    setBozza(null); setEsito('Capsula eliminata.')
    carica()
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500'
  const etichetta = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'
  const chip = (attivo: boolean) => `px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${attivo ? 'bg-amber-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Capsule</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Si vedono da lontano, si aprono sul posto. Clicca la mappa per piazzarne una, o un lucchetto per modificarlo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setBozza({ ...VUOTA }); setEsito(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-amber-600 hover:bg-amber-700 text-white">
            <Plus className="w-4 h-4" /> Nuova capsula
          </button>
          <button onClick={carica} disabled={caricando}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${caricando ? 'animate-spin' : ''}`} /> Aggiorna
          </button>
        </div>
      </div>

      {errore && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">{errore}</div>
      )}
      {esito && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm text-emerald-700 dark:text-emerald-300">{esito}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div ref={mapRef} className="cursor-crosshair" style={{ height: '58vh', minHeight: 380 }} />
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-2 font-medium">Titolo</th>
                  <th className="px-4 py-2 font-medium">Distanze</th>
                  <th className="px-4 py-2 font-medium">Aperture</th>
                  <th className="px-4 py-2 font-medium">Condizioni</th>
                  <th className="px-4 py-2 font-medium">Stato</th>
                </tr>
              </thead>
              <tbody>
                {capsule.length === 0 && !caricando && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Nessuna capsula. Clicca sulla mappa per crearne una.</td></tr>
                )}
                {capsule.map(c => (
                  <tr key={c.id} onClick={() => { setBozza(daCapsula(c)); setEsito(null); mappa.current?.setView([c.lat, c.lon], 15) }}
                    className={`border-b border-gray-100 dark:border-gray-800 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${bozza?.id === c.id ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}>
                    <td className="px-4 py-2 text-gray-900 dark:text-white font-medium">{c.titolo}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">👁 {metri(c.raggio_visibilita)} · 🔓 {metri(c.raggio_apertura)}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{c.aperture}{c.max_aperture ? ` / ${c.max_aperture}` : ''}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {[c.ha_parola && '🔑 parola', c.apre_dal && new Date(c.apre_dal) > new Date() && '⏳ a tempo',
                        c.modo_posizione !== 'esatta' && (c.modo_posizione === 'zona' ? '🗺 zona' : '🌡 caldo/freddo')]
                        .filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: COLORE_STATO[c.stato] }}>{c.stato}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5">
          {!bozza ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
              <p className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-200"><Lock className="w-4 h-4" /> Nessuna capsula selezionata</p>
              <p>Clicca un punto sulla mappa per crearne una nuova, oppure scegline una dall'elenco.</p>
            </div>
          ) : (
            <form onSubmit={salva} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{bozza.id ? 'Modifica capsula' : 'Nuova capsula'}</h2>
                <button type="button" onClick={() => setBozza(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="w-4 h-4" /></button>
              </div>

              {bozza.lat == null
                ? <p className="text-sm text-amber-700 dark:text-amber-400">Clicca sulla mappa per scegliere dove metterla.</p>
                : <p className="text-xs text-gray-400 -mt-2">{bozza.lat.toFixed(5)}, {bozza.lon!.toFixed(5)} · clicca la mappa per spostarla</p>}

              <div>
                <label className={etichetta}>Titolo (visibile da lontano)</label>
                <input required maxLength={100} value={bozza.titolo} onChange={e => aggiorna('titolo', e.target.value)} className={inputCls} placeholder="Un ricordo per chi arriva al faro" />
              </div>
              <div>
                <label className={etichetta}>Indizio (visibile da lontano, facoltativo)</label>
                <input maxLength={300} value={bozza.indizio} onChange={e => aggiorna('indizio', e.target.value)} className={inputCls} placeholder="Dove l'acqua incontra la pietra" />
              </div>
              <div>
                <label className={etichetta}>Contenuto (solo dopo l'apertura)</label>
                <textarea required maxLength={2000} rows={5} value={bozza.contenuto} onChange={e => aggiorna('contenuto', e.target.value)} className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className={etichetta}>Immagine (URL, facoltativa)</label>
                <input type="url" value={bozza.immagine_url} onChange={e => aggiorna('immagine_url', e.target.value)} className={inputCls} placeholder="https://…" />
              </div>

              <div className="space-y-3 p-3 rounded-lg bg-amber-50/60 dark:bg-amber-900/10">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  Visibile entro <b>{metri(bozza.raggio_visibilita)}</b>, si apre a <b>{metri(bozza.raggio_apertura)}</b>
                </p>
                <div>
                  <label className={etichetta}>Si vede entro</label>
                  <input type="range" min={0} max={PASSI.length - 1} className="w-full accent-amber-600"
                    value={Math.max(0, PASSI.indexOf(bozza.raggio_visibilita))}
                    onChange={e => aggiorna('raggio_visibilita', PASSI[Number(e.target.value)])} />
                </div>
                <div>
                  <label className={etichetta}>Si apre entro</label>
                  <input type="range" min={0} max={PASSI.length - 1} className="w-full accent-amber-600"
                    value={Math.max(0, PASSI.indexOf(bozza.raggio_apertura))}
                    onChange={e => aggiorna('raggio_apertura', PASSI[Number(e.target.value)])} />
                </div>
              </div>

              <div>
                <label className={etichetta}>Cosa vede chi e' lontano</label>
                <div className="flex flex-wrap gap-2">
                  {MODI.map(m => (
                    <button key={m.id} type="button" onClick={() => aggiorna('modo_posizione', m.id)} className={chip(bozza.modo_posizione === m.id)}>{m.label}</button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">{MODI.find(m => m.id === bozza.modo_posizione)?.aiuto}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={etichetta}>Si apre dal</label>
                  <input type="datetime-local" value={bozza.apre_dal} onChange={e => aggiorna('apre_dal', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={etichetta}>Scade il</label>
                  <input type="datetime-local" value={bozza.scade_il} onChange={e => aggiorna('scade_il', e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={etichetta}>Numero massimo di aperture (vuoto = senza limite)</label>
                <input type="number" min={1} value={bozza.max_aperture} onChange={e => aggiorna('max_aperture', e.target.value)} className={inputCls} placeholder="Senza limite" />
                {bozza.max_aperture && (
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={bozza.sparisci_se_esaurita} onChange={e => aggiorna('sparisci_se_esaurita', e.target.checked)} />
                    Sparisce dalla mappa quando è esaurita
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <label className={`${etichetta} flex items-center gap-1`}><KeyRound className="w-3.5 h-3.5" /> Parola chiave (facoltativa)</label>
                {bozza.ha_parola && !bozza.rimuovi_parola && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Ha già una parola chiave, non leggibile. Scrivine una nuova per sostituirla, oppure{' '}
                    <button type="button" className="underline" onClick={() => aggiorna('rimuovi_parola', true)}>toglila</button>.
                  </p>
                )}
                {bozza.rimuovi_parola ? (
                  <p className="text-xs text-red-600">
                    La parola chiave verrà tolta al salvataggio.{' '}
                    <button type="button" className="underline" onClick={() => aggiorna('rimuovi_parola', false)}>Annulla</button>
                  </p>
                ) : (
                  <input value={bozza.parola} onChange={e => aggiorna('parola', e.target.value)} className={inputCls} autoComplete="off"
                    placeholder={bozza.ha_parola ? 'Nuova parola chiave' : 'Nessuna'} />
                )}
                {(bozza.parola || (bozza.ha_parola && !bozza.rimuovi_parola)) && (
                  <input maxLength={200} value={bozza.parola_indizio} onChange={e => aggiorna('parola_indizio', e.target.value)} className={inputCls}
                    placeholder="Indizio per la parola (facoltativo)" />
                )}
                <p className="text-xs text-gray-400">Maiuscole, accenti e spazi in più non contano.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={etichetta}>App</label>
                  <select value={bozza.subdomain} onChange={e => aggiorna('subdomain', e.target.value)} className={inputCls}>
                    {SOTTODOMINI.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={etichetta}>Stato</label>
                  <select value={bozza.stato} onChange={e => aggiorna('stato', e.target.value as Capsula['stato'])} className={inputCls}>
                    <option value="attiva">Attiva</option>
                    <option value="bozza">Bozza</option>
                    <option value="archiviata">Archiviata</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={salvando || bozza.lat == null || !bozza.titolo.trim() || !bozza.contenuto.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl text-sm font-semibold transition">
                  <Save className="w-4 h-4" /> {salvando ? 'Salvataggio…' : 'Salva'}
                </button>
                {bozza.id && (
                  <button type="button" onClick={elimina} title="Elimina"
                    className="px-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
