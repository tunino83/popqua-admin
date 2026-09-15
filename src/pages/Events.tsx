import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CalendarDays, MapPin, CheckCircle, Clock, XCircle, Search, X } from 'lucide-react'
import { getAllEvents, type AdminEvent } from '../lib/events'
import { esc } from '../lib/escapeHtml'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { OSM_TILES, OSM_OPTIONS } from '../lib/mapTiles'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Bozza',      cls: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' },
  published: { label: 'Pubblicato', cls: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' },
  cancelled: { label: 'Annullato',  cls: 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300' },
}
const STATUS_ICON: Record<string, React.ElementType> = {
  draft: Clock, published: CheckCircle, cancelled: XCircle,
}
const CATEGORY_ICONS: Record<string, string> = {
  Musica: '🎵', Cultura: '🏛️', Teatro: '🎭', Cinema: '🎬',
  Food: '🍽️', Festival: '🎉', Arte: '🎨', Sport: '⚽',
  Natura: '🌿', Religioso: '⛪', Tradizione: '🏮', Mercato: '🛍️',
}

// Colore cluster per stato evento
function eventStatusColor(ev: AdminEvent): { color: string; key: 'active' | 'upcoming' | 'other' } {
  const now = new Date()
  const start = ev.start_at ? new Date(ev.start_at) : null
  const end   = ev.end_at   ? new Date(ev.end_at)   : null
  if (start && start <= now && (!end || end >= now)) return { color: '#22c55e', key: 'active' }
  if (start && start > now && start.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000)
    return { color: '#f59e0b', key: 'upcoming' }
  return { color: '#3b82f6', key: 'other' }
}

function eventMarkerIcon(emoji: string, bgColor: string, selected = false) {
  const s = selected ? 36 : 28
  const fontSize = selected ? 17 : 13
  const shadow = selected
    ? `box-shadow:0 0 0 3px ${bgColor},0 2px 10px rgba(0,0,0,.45)`
    : 'box-shadow:0 1px 5px rgba(0,0,0,.3)'
  return L.divIcon({
    className: '',
    html: `<div style="width:${s}px;height:${s}px;border-radius:50%;background:${bgColor};display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;border:2px solid white;${shadow};line-height:1">${emoji}</div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  })
}

function clusterIcon(color: string) {
  return (cluster: any) => {
    const n = cluster.getChildCount()
    return L.divIcon({
      className: '',
      html: `<div style="width:38px;height:38px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">${n}</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    })
  }
}

export default function Events() {
  const navigate = useNavigate()
  const [events, setEvents]             = useState<AdminEvent[]>([])
  const [loading, setLoading]           = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'cancelled'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [mapReady, setMapReady]         = useState(false)

  const mapRef      = useRef<L.Map | null>(null)
  const mapDivRef   = useRef<HTMLDivElement>(null)
  const clustersRef = useRef<Record<'active'|'upcoming'|'other', any> | null>(null)
  const markersRef  = useRef<Map<string, { marker: L.Marker; key: 'active'|'upcoming'|'other' }>>(new Map())

  // Load events
  useEffect(() => {
    getAllEvents().then(setEvents).finally(() => setLoading(false))
  }, [])

  // Init map once
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return
    const map = L.map(mapDivRef.current, { center: [40.85, 14.27], zoom: 8 })
    L.tileLayer(OSM_TILES, OSM_OPTIONS).addTo(map)
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 100)
    ;(async () => {
      ;(window as any).L = L
      await import('leaflet.markercluster')
      await import('leaflet.markercluster/dist/MarkerCluster.css')
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css')
      const mkGroup = (color: string) => (L as any).markerClusterGroup({
        maxClusterRadius: 50, disableClusteringAtZoom: 14, iconCreateFunction: clusterIcon(color),
        zoomToBoundsOnClick: true, spiderfyOnMaxZoom: false,
      })
      const clusters = {
        active:   mkGroup('#22c55e'),
        upcoming: mkGroup('#f59e0b'),
        other:    mkGroup('#3b82f6'),
      }
      Object.values(clusters).forEach(g => map.addLayer(g))
      clustersRef.current = clusters
      setMapReady(true)
    })()
    return () => { map.remove(); mapRef.current = null; clustersRef.current = null }
  }, [])

  // Filtered list (for both list + map)
  const filtered = useMemo(() => events.filter(ev => {
    if (statusFilter !== 'all' && ev.status !== statusFilter) return false
    if (categoryFilter && ev.category !== categoryFilter) return false
    if (search && !ev.title.toLowerCase().includes(search.toLowerCase())) return false
    if (dateFrom && ev.start_at && ev.start_at < dateFrom) return false
    if (dateTo   && ev.start_at && ev.start_at > dateTo + 'T23:59:59') return false
    return true
  }), [events, statusFilter, categoryFilter, search, dateFrom, dateTo])

  // Sync markers whenever map is ready OR filtered list changes
  useEffect(() => {
    const clusters = clustersRef.current
    if (!clusters || !mapReady) return

    Object.values(clusters).forEach((g: any) => g.clearLayers())
    markersRef.current.clear()

    filtered.forEach(ev => {
      if (!ev.lat || !ev.lon) return
      const isSelected = ev.id === selectedId
      const { color, key } = eventStatusColor(ev)
      const emoji = CATEGORY_ICONS[ev.category ?? ''] ?? '📌'
      const marker = L.marker([ev.lat, ev.lon], {
        icon: eventMarkerIcon(emoji, color, isSelected),
        zIndexOffset: isSelected ? 1000 : 0,
      })
      marker.bindPopup(
        `<div style="min-width:160px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="font-size:18px">${emoji}</span>
            <span style="font-weight:700;font-size:13px">${esc(ev.title)}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:2px">${esc(ev.category ?? '')} · ${esc(ev.location_text ?? '')}</div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:6px">${esc(ev.start_at ? new Date(ev.start_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '')}</div>
          <a onclick="window.__openEvent &amp;&amp; window.__openEvent('${encodeURIComponent(ev.id)}')" style="color:#6366f1;font-size:11px;cursor:pointer;font-weight:600">Apri dettaglio →</a>
        </div>`,
        { maxWidth: 240 }
      )
      marker.on('click', () => setSelectedId(id => id === ev.id ? null : ev.id))
      clusters[key].addLayer(marker)
      markersRef.current.set(ev.id, { marker, key })
    })
  }, [filtered, mapReady, selectedId])

  // Register global handler for popup link
  useEffect(() => {
    (window as any).__openEvent = (id: string) => navigate(`/events/${id}`)
    return () => { delete (window as any).__openEvent }
  }, [navigate])

  // Pan to selected
  useEffect(() => {
    if (!selectedId || !mapRef.current) return
    const ev = events.find(e => e.id === selectedId)
    if (ev?.lat && ev?.lon) {
      mapRef.current.flyTo([ev.lat, ev.lon], 14, { duration: 0.7 })
      setTimeout(() => markersRef.current.get(selectedId)?.marker.openPopup(), 800)
    }
  }, [selectedId])

  const allCategories = useMemo(() =>
    [...new Set(events.map(e => e.category).filter(Boolean))] as string[],
    [events]
  )

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  const hasFilters = statusFilter !== 'all' || categoryFilter || search || dateFrom || dateTo
  const resetFilters = () => {
    setStatusFilter('all'); setCategoryFilter(null)
    setSearch(''); setDateFrom(''); setDateTo('')
  }

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {filtered.length} di {events.length} eventi
        </p>
        <button
          onClick={() => navigate('/events/new')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />Nuovo
        </button>
      </div>

      {/* ── Filtri ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 flex-shrink-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-sm">

        {/* Riga 1: ricerca + date + status + reset */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative w-44">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="Cerca nome…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">Dal</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">Al</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
          {(['all', 'published', 'draft', 'cancelled'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${statusFilter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {f === 'all' ? 'Tutti' : STATUS_BADGE[f].label}
            </button>
          ))}
          {hasFilters && (
            <button onClick={resetFilters} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:text-red-500 border border-gray-200 dark:border-gray-700 transition-colors ml-auto">
              <X className="w-3 h-3" />Reset
            </button>
          )}
        </div>

        {/* Riga 2: categorie */}
        <div className="flex gap-1.5 flex-wrap items-center">
          {allCategories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              title={cat}
              className={`px-2 py-1 rounded-lg text-sm transition-colors ${categoryFilter === cat ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {CATEGORY_ICONS[cat] ?? '📌'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Split lista + mappa ─────────────────────────────────────── */}
      <div className="flex gap-3" style={{ height: 'calc(100vh - 260px)' }}>

        {/* Lista */}
        <div className="w-[480px] flex-shrink-0 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm divide-y divide-gray-100 dark:divide-gray-800 h-full">
          {loading ? (
            <div className="text-sm text-gray-400 py-8 text-center">Caricamento…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Nessun evento</p>
            </div>
          ) : filtered.map(ev => {
            const badge = STATUS_BADGE[ev.status] ?? STATUS_BADGE.draft
            const Icon  = STATUS_ICON[ev.status]  ?? Clock
            const isSelected = ev.id === selectedId
            const catColor = eventStatusColor(ev).color
            return (
              <div
                key={ev.id}
                onClick={() => setSelectedId(ev.id === selectedId ? null : ev.id)}
                onDoubleClick={() => navigate(`/events/${ev.id}`)}
                className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/40 border-l-2 border-indigo-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-l-2 border-transparent'}`}
              >
                {/* Dot colore categoria */}
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: catColor, flexShrink: 0, border: '2px solid white', boxShadow: `0 0 0 1px ${catColor}` }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{ev.title}</p>
                    <span className={`text-xs font-semibold px-1 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {ev.location_text && (
                      <span className="flex items-center gap-0.5 truncate">
                        <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">{ev.location_text}</span>
                      </span>
                    )}
                    <span className="flex-shrink-0">{fmt(ev.start_at)}</span>
                  </div>
                </div>
                <Icon className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              </div>
            )
          })}
        </div>

        {/* Mappa */}
        <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm relative">
          <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />

          {/* Legenda */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 dark:bg-gray-900/95 rounded-lg px-2.5 py-2 shadow-md border border-gray-200 dark:border-gray-700 flex flex-col gap-1.5 max-h-72 overflow-y-auto">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Stato</p>
            {[
              { color: '#22c55e', label: 'In corso' },
              { color: '#f59e0b', label: 'Prossimi 7gg' },
              { color: '#3b82f6', label: 'Futuri' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: '1.5px solid white', boxShadow: `0 0 0 1px ${color}`, flexShrink: 0 }} />
                {label}
              </div>
            ))}
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-1">Categorie</p>
            {allCategories.map(cat => (
              <div key={cat} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                <span className="text-sm leading-none">{CATEGORY_ICONS[cat] ?? '📌'}</span> {cat}
              </div>
            ))}
          </div>

          {/* Hint */}
          <div className="absolute top-3 left-3 z-[1000] bg-white/90 dark:bg-gray-900/90 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 shadow-sm border border-gray-200 dark:border-gray-700">
            Click → centra · Doppio click → dettaglio
          </div>

          {/* Bottone apri dettaglio */}
          {selectedId && (
            <button
              onClick={() => navigate(`/events/${selectedId}`)}
              className="absolute bottom-3 right-3 z-[1000] px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-lg transition-colors"
            >
              Apri dettaglio →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
