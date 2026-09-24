import { useEffect, useRef, useState } from 'react'
import { Send, X, RefreshCw, Users as UsersIcon } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { OSM_TILES, OSM_OPTIONS } from '../lib/mapTiles'

/* Dove sono le persone con l'app, e un modo per lasciare messaggi li'.
 *
 * La mappa non mostra MAI un utente: mostra zone da 500 m con quante
 * persone ci sono. E' tutto quello che serve per decidere dove mettere un
 * contenuto, e il server non restituisce altro (admin_zone_utenti). */


/* Meta' lato della cella del server: il riquadro disegnato copre la zona
   intera, non un punto che farebbe credere a una posizione precisa. */
const MEZZA_CELLA_M = 250

const RAGGI = [100, 300, 500] as const
type Raggio = (typeof RAGGI)[number]

const SCADENZE = [
  { value: 60,    label: '1h' },
  { value: 180,   label: '3h' },
  { value: 1440,  label: '1 giorno' },
  { value: 10080, label: '1 settimana' },
  { value: 43200, label: '1 mese' },
]

interface Zona { lat: number; lon: number; utenti: number; aggiornato: string }

function tempoFa(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 60) return `${min} min fa`
  const ore = Math.round(min / 60)
  if (ore < 48) return `${ore} h fa`
  return `${Math.round(ore / 24)} giorni fa`
}

/* Cerchio di misura fissa con il numero di persone: si vede a ogni zoom,
   mentre il riquadro da 500 m a zoom basso diventa piu' piccolo di un pixel. */
function iconaNumero(n: number, massimo: number) {
  const lato = Math.round(30 + 14 * Math.min(1, n / Math.max(1, massimo)))
  return L.divIcon({
    className: '',
    html: `<div style="width:${lato}px;height:${lato}px;border-radius:50%;background:#0079AC;color:#fff;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font:700 ${lato > 36 ? 15 : 13}px system-ui,sans-serif">${n}</div>`,
    iconSize: [lato, lato],
    iconAnchor: [lato / 2, lato / 2],
  })
}

function suggerimentoZona(utenti: number, aggiornato: string) {
  return `<b>${utenti} ${utenti === 1 ? 'persona' : 'persone'}</b><br>ultimo aggiornamento ${tempoFa(aggiornato)}`
}

/* soloMappa: dalla dashboard questa e' una mappa e basta, senza il modulo
   per pubblicare. Scrivere un messaggio resta cosa della pagina Utenti,
   dove si va apposta. */
export default function UsersMap({ soloMappa = false }: { soloMappa?: boolean } = {}) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mappa       = useRef<L.Map | null>(null)
  const livelloZone = useRef<L.LayerGroup | null>(null)
  const segnaposto  = useRef<L.Marker | null>(null)
  const cerchio     = useRef<L.Circle | null>(null)

  const [zone, setZone]       = useState<Zona[]>([])
  const [caricando, setCaricando] = useState(true)
  const [errore, setErrore]   = useState<string | null>(null)

  // Modulo del messaggio, aperto dal clic sulla mappa
  const [punto, setPunto]     = useState<{ lat: number; lon: number } | null>(null)
  const [titolo, setTitolo]   = useState('')
  const [testo, setTesto]     = useState('')
  const [raggio, setRaggio]   = useState<Raggio>(300)
  const [scadenza, setScadenza] = useState(1440)
  /* Spento per difetto: un messaggio messo dall'amministrazione vicino a
     qualcuno non deve suonargli in tasca, a meno di volerlo davvero. */
  const [notifica, setNotifica] = useState(false)
  const [invio, setInvio]     = useState(false)
  const [esito, setEsito]     = useState<string | null>(null)

  const [profilo, setProfilo] = useState<{ id: string; username: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('user_profiles').select('id, username').eq('id', user.id).single()
        .then(({ data }) => { if (data) setProfilo(data) })
    })
  }, [])

  async function caricaZone() {
    setCaricando(true); setErrore(null)
    const { data, error } = await supabase.rpc('admin_zone_utenti')
    if (error) setErrore(error.message)
    else setZone((data ?? []) as Zona[])
    setCaricando(false)
  }

  // Mappa
  useEffect(() => {
    if (!mapRef.current || mappa.current) return
    const m = L.map(mapRef.current).setView([40.85, 14.27], 9)
    mappa.current = m
    L.tileLayer(OSM_TILES, OSM_OPTIONS).addTo(m)
    livelloZone.current = L.layerGroup().addTo(m)

    if (!soloMappa) {
      m.on('click', (e: L.LeafletMouseEvent) => {
        setPunto({ lat: e.latlng.lat, lon: e.latlng.lng })
        setEsito(null)
      })
    }

    setTimeout(() => m.invalidateSize(), 100)
    caricaZone()
    return () => { m.remove(); mappa.current = null }
  }, [])

  // Zone: riquadro da 500 m per l'area vera, segnaposto con il numero per
  // trovarle a ogni zoom
  useEffect(() => {
    const m = mappa.current, livello = livelloZone.current
    if (!m || !livello) return
    livello.clearLayers()
    if (zone.length === 0) return
    let annullato = false

    const massimo = Math.max(...zone.map(z => z.utenti))
    const limiti: L.LatLngTuple[] = []

    for (const z of zone) {
      const dLat = MEZZA_CELLA_M / 111320
      const dLon = MEZZA_CELLA_M / (111320 * Math.cos(z.lat * Math.PI / 180))
      /* Appena accennati. I quadrati pieni di azzurro coprivano strade e
         nomi dei luoghi, cioe' proprio quello che serve per capire DOVE
         sono le persone: a dire quante sono ci pensa gia' il numero nel
         cerchio. Restano un contorno tratteggiato e un velo di colore che
         cresce appena con la quantita'. */
      const intensita = 0.05 + 0.10 * (z.utenti / massimo)
      const riquadro = L.rectangle(
        [[z.lat - dLat, z.lon - dLon], [z.lat + dLat, z.lon + dLon]],
        { color: '#0079AC', weight: 1, opacity: 0.45, dashArray: '4 4', fillColor: '#0FB8FC', fillOpacity: intensita },
      )
      riquadro.bindTooltip(suggerimentoZona(z.utenti, z.aggiornato), { direction: 'top' })
      riquadro.on('click', (e: L.LeafletMouseEvent) => apriZona(e, z))
      riquadro.addTo(livello)
      limiti.push([z.lat, z.lon])
    }

    if (limiti.length > 0) m.fitBounds(L.latLngBounds(limiti).pad(0.3), { maxZoom: 15 })

    /* Segnaposti raggruppati. Due zone vicine, a zoom basso, finivano una
       sopra l'altra: "4 in 4 zone" e tre cerchi visibili. Il gruppo le
       unisce in un solo cerchio con la SOMMA delle persone, e si divide
       ingrandendo. Stesso caricamento di leaflet.markercluster usato nella
       Dashboard: il plugin si aggancia al L globale. */
    ;(async () => {
      ;(window as any).L = L
      await import('leaflet.markercluster')
      if (annullato) return

      const gruppo = (L as any).markerClusterGroup({
        maxClusterRadius: 45,
        showCoverageOnHover: false,
        // Zone con lo stesso centro non si separano ingrandendo: a zoom
        // massimo si aprono a raggiera.
        spiderfyOnMaxZoom: true,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster: any) => {
          const figli = cluster.getAllChildMarkers() as L.Marker[]
          const somma = figli.reduce((t, mk) => t + ((mk.options as any).utenti ?? 0), 0)
          return iconaNumero(somma, massimo * 2)
        },
      })
      gruppo.on('clustermouseover', (e: any) => {
        const figli = e.layer.getAllChildMarkers() as L.Marker[]
        const somma = figli.reduce((t, mk) => t + ((mk.options as any).utenti ?? 0), 0)
        e.layer.bindTooltip(`<b>${somma} ${somma === 1 ? 'persona' : 'persone'}</b> in ${figli.length} zone<br>clicca per ingrandire`, { direction: 'top' }).openTooltip()
      })

      for (const z of zone) {
        const mk = L.marker([z.lat, z.lon], { icon: iconaNumero(z.utenti, massimo), riseOnHover: true, utenti: z.utenti } as any)
        mk.bindTooltip(suggerimentoZona(z.utenti, z.aggiornato), { direction: 'top' })
        mk.on('click', (e: L.LeafletMouseEvent) => apriZona(e, z))
        gruppo.addLayer(mk)
      }
      livello.addLayer(gruppo)
    })()

    return () => { annullato = true }
  }, [zone])

  /* Il clic sulla zona apre il modulo al suo centro: e' il caso d'uso
     principale, mettere un messaggio dove c'e' gente. */
  function apriZona(e: L.LeafletMouseEvent, z: Zona) {
    L.DomEvent.stopPropagation(e)
    if (soloMappa) return
    setPunto({ lat: z.lat, lon: z.lon })
    setEsito(null)
  }

  // Segnaposto e cerchio del raggio del messaggio in preparazione
  useEffect(() => {
    const m = mappa.current
    if (!m) return
    segnaposto.current?.remove(); segnaposto.current = null
    cerchio.current?.remove(); cerchio.current = null
    if (!punto) return
    segnaposto.current = L.marker([punto.lat, punto.lon]).addTo(m)
    cerchio.current = L.circle([punto.lat, punto.lon], {
      radius: raggio, color: '#4838C9', weight: 2, fillColor: '#4838C9', fillOpacity: 0.08, dashArray: '6 4',
    }).addTo(m)
  }, [punto, raggio])

  async function pubblica(e: React.FormEvent) {
    e.preventDefault()
    if (!punto || !testo.trim()) return
    setInvio(true); setErrore(null)

    const ora = new Date()
    const username = profilo?.username ?? 'admin'
    const { error } = await supabase.from('messages').insert({
      text: testo.trim(),
      title: titolo.trim() || null,
      location: `POINT(${punto.lon} ${punto.lat})`,
      visible_at: ora.toISOString(),
      expires_at: new Date(ora.getTime() + scadenza * 60000).toISOString(),
      username,
      display_nickname: username,
      author_id: profilo?.id ?? null,
      is_anonymous: false,
      is_global: false,
      message_type: 'message',
      location_precision: 'exact',
      visibility_radius: raggio,
      /* Senza notifica il messaggio e' marcato dimostrativo: e' l'unico modo
         che il trigger conosce per non avvisare nessuno. Conseguenza da
         sapere: si cancella insieme agli altri messaggi dimostrativi. */
      is_demo: !notifica,
    })

    setInvio(false)
    if (error) { setErrore(error.message); return }
    setEsito(`Pubblicato, si vede entro ${raggio} m.`)
    setTesto(''); setTitolo('')
  }

  const totale = zone.reduce((s, z) => s + z.utenti, 0)
  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Zone da 500 m con le persone che hanno aperto l'app negli ultimi 14 giorni.{soloMappa ? '' : ' Clicca una zona o un punto per lasciare un messaggio.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
            <UsersIcon className="w-4 h-4" /> {totale} in {zone.length} zone
          </span>
          <button onClick={caricaZone} disabled={caricando}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${caricando ? 'animate-spin' : ''}`} /> Aggiorna
          </button>
        </div>
      </div>

      {errore && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          {errore}
        </div>
      )}

      <div className={`grid gap-4 items-start ${soloMappa ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-3'}`}>
        <div className={`${soloMappa ? '' : 'xl:col-span-2'} bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden`}>
          <div ref={mapRef} className={soloMappa ? '' : 'cursor-crosshair'} style={{ height: 'calc(100vh - 260px)', minHeight: 420 }} />
        </div>

        {!soloMappa && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5 space-y-4">
          {!punto ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {zone.length === 0 && !caricando
                ? 'Nessuna posizione registrata negli ultimi 14 giorni. Le zone compaiono quando qualcuno apre l\'app con le notifiche attive.'
                : 'Scegli un punto sulla mappa per scrivere un messaggio.'}
            </p>
          ) : (
            <form onSubmit={pubblica} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Nuovo messaggio qui</h2>
                <button type="button" onClick={() => setPunto(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 -mt-2">{punto.lat.toFixed(5)}, {punto.lon.toFixed(5)}</p>

              <input type="text" value={titolo} onChange={e => setTitolo(e.target.value.slice(0, 100))}
                placeholder="Titolo (opzionale)" className={inputCls} />
              <textarea value={testo} onChange={e => setTesto(e.target.value)} rows={5} maxLength={500}
                placeholder="Scrivi il messaggio…" className={`${inputCls} resize-none`} />

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Si vede entro</p>
                <div className="flex gap-2">
                  {RAGGI.map(r => (
                    <button key={r} type="button" onClick={() => setRaggio(r)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${raggio === r ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                      {r} m
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Scade dopo</p>
                <div className="flex flex-wrap gap-2">
                  {SCADENZE.map(s => (
                    <button key={s.value} type="button" onClick={() => setScadenza(s.value)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${scadenza === s.value ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                <input type="checkbox" checked={notifica} onChange={e => setNotifica(e.target.checked)} className="mt-0.5" />
                <span>
                  Avvisa chi è entro 1 km
                  <span className="block text-xs text-gray-400">
                    Se spento, il messaggio conta come dimostrativo: nessuna notifica, e si cancella con gli altri messaggi dimostrativi.
                  </span>
                </span>
              </label>

              {esito && <p className="text-sm text-emerald-600 dark:text-emerald-400">{esito}</p>}

              <button type="submit" disabled={invio || !testo.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl text-sm font-semibold transition">
                <Send className="w-4 h-4" /> {invio ? 'Pubblicazione…' : 'Pubblica'}
              </button>
            </form>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
