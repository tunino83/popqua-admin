import { useEffect, useRef, useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { Trash2, ChevronLeft, ChevronRight, List, Map as MapIcon, Image, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { OSM_TILES, OSM_OPTIONS } from '../lib/mapTiles'
import { supabase } from '../lib/supabase'
import { MessaggioRapido, type PuntoMappa } from '../components/MessaggioRapido'
import { esc, safeUrl } from '../lib/escapeHtml'

interface AdminMessage {
  id: string
  title: string | null
  text: string
  username: string
  author_id: string | null
  message_type: 'message' | 'event' | 'offer' | null
  visible_at: string
  expires_at: string
  created_at: string
  location: any
  image_url: string | null
}

interface ParsedMessage extends AdminMessage {
  lat: number | null
  lng: number | null
}

type StatusFilter = 'all' | 'active' | 'expired' | 'scheduled'
type TypeFilter = 'all' | 'message' | 'event' | 'offer'
type ViewMode = 'list' | 'map'

const columnHelper = createColumnHelper<ParsedMessage>()

function parseLocation(loc: any): { lat: number; lng: number } | null {
  if (!loc) return null
  try {
    // GeoJSON object
    if (typeof loc === 'object' && loc.type === 'Point') {
      return { lat: loc.coordinates[1], lng: loc.coordinates[0] }
    }
    // GeoJSON string
    if (typeof loc === 'string' && loc.startsWith('{')) {
      const geo = JSON.parse(loc)
      if (geo.type === 'Point') return { lat: geo.coordinates[1], lng: geo.coordinates[0] }
    }
    // Hex WKB / EWKB (PostGIS default)
    if (typeof loc === 'string' && /^[0-9a-fA-F]+$/.test(loc) && loc.length >= 42) {
      const hasSRID = loc.slice(2, 10).toLowerCase() === '01000020' || loc.slice(2, 4).toLowerCase() === '60'
      const offset = hasSRID ? 18 : 10
      const lng = hexToDouble(loc.slice(offset, offset + 16))
      const lat = hexToDouble(loc.slice(offset + 16, offset + 32))
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
  } catch {}
  return null
}

function getStatus(msg: AdminMessage): 'active' | 'expired' | 'scheduled' {
  const now = new Date()
  if (now < new Date(msg.visible_at)) return 'scheduled'
  if (now > new Date(msg.expires_at)) return 'expired'
  return 'active'
}

const statusBadge = {
  active: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300',
  expired: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  scheduled: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
}
const statusLabel = { active: 'Attivo', expired: 'Scaduto', scheduled: 'Programmato' }

const typeBadge: Record<string, string> = {
  message: 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300',
  event: 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300',
  offer: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
}
const typeLabel: Record<string, string> = { message: 'Messaggio', event: 'Evento', offer: 'Offerta' }


function hexToDouble(hex: string): number {
  const buf = new Uint8Array(8)
  for (let i = 0; i < 8; i++) buf[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return new DataView(buf.buffer).getFloat64(0, true)
}

export default function Messages({ isAdmin, userId }: { isAdmin: boolean; userId: string }) {
  const navigate = useNavigate()
  const [data, setData] = useState<ParsedMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [view, setView] = useState<ViewMode>('list')
  /* Il punto toccato sulla mappa: apre il pannello di invio rapido. */
  const [puntoNuovo, setPuntoNuovo] = useState<PuntoMappa | null>(null)
  const segnaposto = useRef<L.Marker | null>(null)
  const cerchio = useRef<L.Circle | null>(null)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const clusterRef = useRef<any>(null)
  const avatarMapRef = useRef<Map<string, string | null>>(new Map())

  /* Rilettura dopo un invio rapido: load() vive dentro l'effetto, e
     dall'esterno non si puo' chiamare. Un contatore che cambia lo fa
     ripartire. */
  const [ricarica, setRicarica] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        let all: AdminMessage[] = []
        let from = 0
        const PAGE = 1000
        while (true) {
          let q = supabase
            .from('messages')
            .select('id, title, text, username, author_id, message_type, visible_at, expires_at, created_at, location, image_url')
            .order('created_at', { ascending: false })
            .range(from, from + PAGE - 1)
          if (!isAdmin && userId) q = q.eq('author_id', userId)
          const { data: rows, error } = await q
          if (error || !rows || rows.length === 0) break
          all = all.concat(rows as AdminMessage[])
          if (rows.length < PAGE) break
          from += PAGE
        }
        const parsed = all.map(m => {
          const coords = parseLocation(m.location)
          return { ...m, lat: coords?.lat ?? null, lng: coords?.lng ?? null }
        })

        // fetch avatars for all unique authors
        const authorIds = [...new Set(all.map(m => m.author_id).filter(Boolean) as string[])]
        if (authorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, avatar_url')
            .in('id', authorIds)
          if (profiles) {
            avatarMapRef.current = new Map(profiles.map(p => [p.id, p.avatar_url]))
          }
        }

        setData(parsed)
      } catch {
        // leave empty
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [ricarica])

  const filtered = useMemo(() => data.filter(msg => {
    if (statusFilter !== 'all' && getStatus(msg) !== statusFilter) return false
    if (typeFilter !== 'all' && (msg.message_type ?? 'message') !== typeFilter) return false
    return true
  }), [data, statusFilter, typeFilter])

  const tileLayerRef = useRef<L.TileLayer | null>(null)

  useEffect(() => {
    ;(window as any).__navigateTo = (path: string) => navigate(path)
    return () => { delete (window as any).__navigateTo }
  }, [navigate])


  function createAvatarIcon(avatarUrl: string | null, username: string): L.DivIcon {
    const initial = esc((username?.[0] ?? '?').toUpperCase())
    const s = 34
    const inner = avatarUrl
      ? `<img src="${safeUrl(avatarUrl)}" width="${s}" height="${s}" style="object-fit:cover;width:${s}px;height:${s}px;border-radius:50%;display:block"/>`
      : `<div style="width:${s}px;height:${s}px;border-radius:50%;background:#4f46e5;color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center">${initial}</div>`
    const html = `<div style="width:${s}px;height:${s}px;border-radius:50%;border:2.5px solid #4f46e5;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.35)">${inner}</div>`
    return L.divIcon({ html, className: '', iconSize: [s, s], iconAnchor: [s / 2, s / 2], popupAnchor: [0, -s / 2] })
  }

  function addMarkers(mcg: any, msgs: ParsedMessage[]) {
    msgs.filter(m => m.lat != null && m.lng != null).forEach(m => {
      const t = m.message_type ?? 'message'
      const imgHtml = m.image_url
        ? `<img src="${safeUrl(m.image_url)}" style="width:100%;height:160px;object-fit:cover;border-radius:6px;margin-top:8px"/>`
        : ''
      const msgId = encodeURIComponent(m.id)
      const popup = `
        <div style="min-width:180px;font-family:system-ui,sans-serif">
          <div style="font-size:11px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${esc(typeLabel[t])} · ${esc(m.username)}</div>
          <div style="font-size:13px;font-weight:600;color:#111;line-height:1.3">${esc(m.title ?? m.text)}</div>
          ${m.title ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${esc(m.text)}</div>` : ''}
          ${imgHtml}
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">
            <span style="font-size:11px;color:#9ca3af">${esc(new Date(m.created_at).toLocaleDateString('it-IT'))}</span>
            <a href="/messages/${msgId}" style="font-size:11px;font-weight:600;color:#4f46e5;text-decoration:none" onclick="event.preventDefault();window.__navigateTo('/messages/${msgId}')">Apri dettaglio →</a>
          </div>
        </div>`
      const avatarUrl = m.author_id ? (avatarMapRef.current.get(m.author_id) ?? null) : null
      const icon = createAvatarIcon(avatarUrl, m.username)
      L.marker([m.lat!, m.lng!], { icon }).bindPopup(popup, { maxWidth: m.image_url ? 300 : 240 }).addTo(mcg)
    })
  }

  useEffect(() => {
    if (view !== 'map') return
    const el = mapRef.current
    if (!el) return

    if (!mapInstanceRef.current) {
      const map = L.map(el).setView([41.9, 12.5], 6)
      mapInstanceRef.current = map

      /* Un clic sul vuoto scrive li'. Sui segnaposti esistenti no: quelli
         aprono il messaggio che c'e' gia', e aprire il modulo di scrittura
         sopra il fumetto di un altro sarebbe un inganno. */
      map.on('click', (e: L.LeafletMouseEvent) => {
        setPuntoNuovo({ lat: e.latlng.lat, lon: e.latlng.lng })
      })
      const tile = L.tileLayer(OSM_TILES, OSM_OPTIONS)
      tile.addTo(map)
      tileLayerRef.current = tile

      ;(async () => {
        ;(window as any).L = L
        await import('leaflet.markercluster')
        await import('leaflet.markercluster/dist/MarkerCluster.css')
        await import('leaflet.markercluster/dist/MarkerCluster.Default.css')
      /* Il clic su un gruppo inquadra i suoi punti, non salta di N livelli
         verso il centro: con lo zoom a passo fisso si finiva in mezzo al
         gruppo senza vedere niente, perche' i punti stanno intorno, non
         dove si e' cliccato. E a zoom massimo i punti sovrapposti si
         aprono a raggiera, altrimenti il clic non ha piu' nessun effetto
         e sembra rotto. */
        const mcg = (L as any).markerClusterGroup({
          maxClusterRadius: 60,
          zoomToBoundsOnClick: true,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
        })
        clusterRef.current = mcg
        addMarkers(mcg, filtered)
        map.addLayer(mcg)
      })()

    } else {
      if (clusterRef.current) {
        clusterRef.current.clearLayers()
        addMarkers(clusterRef.current, filtered)
      }
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 50)
    }
  }, [view, filtered])

  /* Dove finira' il messaggio, e fin dove si vedra'. Senza, il punto
     toccato resta un'idea: sulla mappa non si vede niente. */
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    segnaposto.current?.remove(); segnaposto.current = null
    cerchio.current?.remove(); cerchio.current = null
    if (!puntoNuovo) return
    segnaposto.current = L.marker([puntoNuovo.lat, puntoNuovo.lon]).addTo(map)
    cerchio.current = L.circle([puntoNuovo.lat, puntoNuovo.lon], {
      radius: 300, color: '#4f46e5', weight: 2, fillColor: '#4f46e5', fillOpacity: 0.08, dashArray: '6 4',
    }).addTo(map)
  }, [puntoNuovo, view])

  useEffect(() => {
    return () => {
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
      clusterRef.current = null
    }
  }, [])

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'photo',
      header: '',
      cell: ({ row }) => row.original.image_url
        ? <Image className="w-4 h-4 text-indigo-400" />
        : <span className="w-4 h-4 block" />,
    }),
    columnHelper.accessor('title', {
      header: 'Titolo',
      cell: info => <span className="font-medium text-gray-900 dark:text-white">{info.getValue() ?? '—'}</span>,
    }),
    columnHelper.accessor('text', {
      header: 'Testo',
      cell: info => <span className="text-gray-600 dark:text-gray-400 max-w-xs truncate block">{info.getValue()}</span>,
    }),
    columnHelper.accessor('username', { header: 'Autore' }),
    columnHelper.accessor('message_type', {
      header: 'Tipo',
      cell: info => {
        const t = info.getValue() ?? 'message'
        return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeBadge[t]}`}>{typeLabel[t]}</span>
      },
    }),
    columnHelper.display({
      id: 'status',
      header: 'Stato',
      cell: ({ row }) => {
        const s = getStatus(row.original)
        return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge[s]}`}>{statusLabel[s]}</span>
      },
    }),
    columnHelper.accessor('created_at', {
      header: 'Creato il',
      cell: info => new Date(info.getValue()).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Azioni',
      cell: ({ row }) => (
        <button
          onClick={e => { e.stopPropagation(); setData(prev => prev.filter(m => m.id !== row.original.id)) }}
          className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 transition-colors"
        >
          <Trash2 className="w-4 h-4" /> Elimina
        </button>
      ),
    }),
  ], [])

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Tutti' },
    { key: 'active', label: 'Attivi' },
    { key: 'expired', label: 'Scaduti' },
    { key: 'scheduled', label: 'Programmati' },
  ]
  const typeTabs: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: 'Tutti' },
    { key: 'message', label: 'Messaggi' },
    { key: 'event', label: 'Eventi' },
    { key: 'offer', label: 'Offerte' },
  ]

  return (
    <div className="space-y-4">
      {/* Filters + view toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {statusTabs.map(({ key, label }) => (
            <button key={key} onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === key ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              {label}
            </button>
          ))}
          <div className="w-px bg-gray-200 dark:bg-gray-700 mx-1" />
          {typeTabs.map(({ key, label }) => (
            <button key={key} onClick={() => setTypeFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === key ? 'bg-sky-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} messaggi</span>
          <button onClick={() => navigate('/messages/new')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Nuovo
          </button>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              <List className="w-4 h-4" /> Lista
            </button>
            <button onClick={() => setView('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 dark:border-gray-700 ${view === 'map' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              <MapIcon className="w-4 h-4" /> Mappa
            </button>
          </div>
        </div>
      </div>

      {/* List view */}
      {view === 'list' && (
        <>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400">Caricamento…</div>
            ) : (
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  {table.getHeaderGroups().map(hg => (
                    <tr key={hg.id}>
                      {hg.headers.map(h => (
                        <th key={h.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {table.getRowModel().rows.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Nessun messaggio trovato</td></tr>
                  ) : (
                    table.getRowModel().rows.map(row => (
                      <tr key={row.id} onClick={() => navigate(`/messages/${row.original.id}`)} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Pagina {table.getState().pagination.pageIndex + 1} di {Math.max(1, table.getPageCount())}</span>
            <div className="flex gap-2">
              <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Map view */}
      {view === 'map' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tocca un punto vuoto della mappa per scrivere un messaggio li'.
          </p>

          <div className="relative">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div ref={mapRef} className="cursor-crosshair" style={{ height: 600 }} />
            </div>

            {/* Sovrapposto sul largo, sotto la mappa sullo stretto: su un
                telefono un pannello che copre la mappa nasconde proprio il
                punto che hai appena scelto. */}
            {puntoNuovo && (
              <div className="mt-3 lg:mt-0 lg:absolute lg:top-4 lg:right-4 lg:w-80 lg:z-[500]">
                <MessaggioRapido
                  punto={puntoNuovo}
                  onChiudi={() => setPuntoNuovo(null)}
                  onFatto={() => setRicarica(n => n + 1)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
