import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Clock, User, CalendarDays, MessageSquare, Image as ImageIcon } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { OSM_TILES, OSM_OPTIONS } from '../lib/mapTiles'

interface MsgDetail {
  id: string
  title: string | null
  text: string
  username: string
  author_id: string | null
  message_type: string | null
  visible_at: string
  expires_at: string
  created_at: string
  image_url: string | null
  location: any
  is_anonymous: boolean
  display_nickname: string | null
  place_id: string | null
}


function parseWKB(loc: any): { lat: number; lng: number } | null {
  if (!loc) return null
  try {
    if (typeof loc === 'object' && loc.type === 'Point') return { lat: loc.coordinates[1], lng: loc.coordinates[0] }
    if (typeof loc === 'string' && loc.startsWith('{')) {
      const g = JSON.parse(loc); if (g.type === 'Point') return { lat: g.coordinates[1], lng: g.coordinates[0] }
    }
    if (typeof loc === 'string' && /^[0-9a-fA-F]+$/.test(loc) && loc.length >= 42) {
      const hasSRID = loc.slice(2, 10).toLowerCase() === '01000020'
      const off = hasSRID ? 18 : 10
      const buf = (h: string) => { const b = new Uint8Array(8); for (let i=0;i<8;i++) b[i]=parseInt(h.slice(i*2,i*2+2),16); return new DataView(b.buffer).getFloat64(0,true) }
      const lng = buf(loc.slice(off, off+16)); const lat = buf(loc.slice(off+16, off+32))
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat)<=90 && Math.abs(lng)<=180) return { lat, lng }
    }
  } catch {}
  return null
}

const typeLabel: Record<string, string> = { message: 'Messaggio', event: 'Evento', offer: 'Offerta' }
const typeBadge: Record<string, string> = {
  message: 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300',
  event: 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300',
  offer: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
}

function Field({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: any }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && <div className="mt-0.5 flex-shrink-0"><Icon className="w-4 h-4 text-gray-400" /></div>}
      <div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
        <div className="text-sm text-gray-800 dark:text-gray-200 mt-0.5">{value}</div>
      </div>
    </div>
  )
}

export default function MessageDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [msg, setMsg] = useState<MsgDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!id) return
    supabase.from('messages')
      .select('id, title, text, username, author_id, message_type, visible_at, expires_at, created_at, image_url, location, is_anonymous, display_nickname, place_id')
      .eq('id', id).single()
      .then(({ data }) => { setMsg(data as MsgDetail); setLoading(false) })
  }, [id])

  useEffect(() => {
    if (!msg || !mapRef.current || mapInstanceRef.current) return
    const coords = parseWKB(msg.location)
    if (!coords) return

    const map = L.map(mapRef.current).setView([coords.lat, coords.lng], 14)
    mapInstanceRef.current = map
    L.tileLayer(OSM_TILES, OSM_OPTIONS).addTo(map)
    L.circleMarker([coords.lat, coords.lng], { radius: 10, color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.6, weight: 2 }).addTo(map)
    setTimeout(() => map.invalidateSize(), 50)

    return () => { map.remove(); mapInstanceRef.current = null }
  }, [msg])

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">Caricamento…</div>
  if (!msg) return <div className="flex items-center justify-center py-20 text-gray-400">Messaggio non trovato</div>

  const now = new Date()
  const visibleAt = new Date(msg.visible_at)
  const expiresAt = new Date(msg.expires_at)
  const status = now < visibleAt ? 'scheduled' : now > expiresAt ? 'expired' : 'active'
  const statusLabel = { active: 'Attivo', expired: 'Scaduto', scheduled: 'Programmato' }
  const statusBadge = {
    active: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300',
    expired: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
    scheduled: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
  }
  const t = msg.message_type ?? 'message'
  const coords = parseWKB(msg.location)

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/messages')} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Torna ai messaggi
      </button>

      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '3fr 2fr' }}>
        {/* Left column: header + details */}
        <div className="min-w-0 space-y-4">
          {/* Header */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeBadge[t]}`}>{typeLabel[t]}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge[status]}`}>{statusLabel[status]}</span>
                {msg.image_url && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Foto
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400 font-mono shrink-0">{msg.id.slice(0, 8)}…</span>
            </div>
            {msg.title && <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{msg.title}</h1>}
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{msg.text}</p>
          </div>

          {/* Details */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-5">Dettagli</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field icon={User} label="Autore" value={msg.display_nickname ?? msg.username} />
              <Field icon={User} label="Anonimo" value={msg.is_anonymous ? 'Sì' : 'No'} />
              <Field icon={MessageSquare} label="Tipo" value={typeLabel[t]} />
              <Field icon={MapPin} label="Posizione" value={coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : '—'} />
              <Field icon={CalendarDays} label="Creato il" value={new Date(msg.created_at).toLocaleString('it-IT')} />
              <Field icon={Clock} label="Visibile dal" value={visibleAt.toLocaleString('it-IT')} />
              <Field icon={Clock} label="Scade il" value={expiresAt.toLocaleString('it-IT')} />
              {msg.place_id && <Field icon={MapPin} label="Place ID" value={<span className="font-mono text-xs">{msg.place_id}</span>} />}
              {msg.author_id && <Field icon={User} label="Author ID" value={
                <button onClick={() => navigate(`/users/${msg.author_id}`)} className="font-mono text-xs text-indigo-600 dark:text-indigo-400 hover:underline">{msg.author_id}</button>
              } />}
            </div>
          </div>
        </div>

        {/* Right column: photo + map */}
        {(msg.image_url || coords) && (
          <div className="min-w-0 space-y-4">
            {msg.image_url && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
                <img src={msg.image_url} alt="Immagine messaggio" className="w-full object-cover" />
              </div>
            )}
            {coords && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 pt-3 pb-1">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Posizione</h2>
                </div>
                <div ref={mapRef} style={{ height: 240 }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
