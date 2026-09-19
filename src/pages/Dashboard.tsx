import { useEffect, useRef, useState } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Users, MessageSquare, CheckCircle, Clock, Maximize2, X,
  CalendarDays, CalendarCheck, FileEdit, XCircle, LayoutDashboard, MapPinned,
} from 'lucide-react'
import UsersMap from './UsersMap'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { OSM_TILES, OSM_OPTIONS } from '../lib/mapTiles'
import { getAllEvents } from '../lib/events'
import { esc } from '../lib/escapeHtml'

// ── helpers ──────────────────────────────────────────────────────────
interface KPIs { totalUsers: number; totalMessages: number; activeMessages: number; expiredMessages: number }
interface EventKPIs { total: number; published: number; draft: number; cancelled: number }
interface DayCount { date: string; messages: number }
interface NameValue { name: string; value: number }

function buildDays(n: number): DayCount[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i))
    return { date: d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }), messages: 0 }
  })
}

function hexToDouble(hex: string): number {
  const buf = new Uint8Array(8)
  for (let i = 0; i < 8; i++) buf[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return new DataView(buf.buffer).getFloat64(0, true)
}

function parseMessageCoords(loc: any): { lat: number; lng: number } | null {
  if (!loc) return null
  try {
    if (typeof loc === 'object' && loc.type === 'Point')
      return { lat: loc.coordinates[1], lng: loc.coordinates[0] }
    if (typeof loc === 'string' && loc.startsWith('{')) {
      const geo = JSON.parse(loc)
      if (geo.type === 'Point') return { lat: geo.coordinates[1], lng: geo.coordinates[0] }
    }
    if (typeof loc === 'string' && /^[0-9a-fA-F]+$/.test(loc) && loc.length >= 34) {
      const hasSRID = loc.slice(2, 10).toLowerCase() === '01000020' || loc.slice(2, 4).toLowerCase() === '60'
      const offset = hasSRID ? 18 : 10
      const lng = hexToDouble(loc.slice(offset, offset + 16))
      const lat = hexToDouble(loc.slice(offset + 16, offset + 32))
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
  } catch {}
  return null
}

const MSG_TYPES = ['message', 'event', 'offer'] as const
const MSG_TYPE_LABELS: Record<typeof MSG_TYPES[number], string> = {
  message: 'Messaggi', event: 'Eventi', offer: 'Offerte',
}
const ROLES = ['admin', 'premium', 'user'] as const

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e']
const EVENT_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#0ea5e9', '#a855f7', '#f97316', '#14b8a6', '#ec4899', '#10b981', '#eab308', '#3b82f6']
const TOOLTIP_STYLE = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }

function ChartCard({ title, children, maximized, onMaximize, onClose }: {
  title: string; children: React.ReactNode; maximized: boolean; onMaximize: () => void; onClose: () => void
}) {
  if (maximized) return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <ResponsiveContainer width="100%" height={420}>{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </div>
  )
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
        <button onClick={onMaximize} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      <ResponsiveContainer width="100%" height={240}>{children as React.ReactElement}</ResponsiveContainer>
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, bg, loading }: {
  label: string; value: number; icon: React.ElementType; color: string; bg: string; loading: boolean
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5 flex items-center gap-4">
      <div className={`${bg} p-3 rounded-xl flex-shrink-0`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? '—' : value.toLocaleString('it-IT')}</p>
      </div>
    </div>
  )
}

// ── Overview map ──────────────────────────────────────────────────────
function OverviewMap(_: { isAdmin: boolean }) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef    = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return
    const map = L.map(mapDivRef.current, { center: [40.85, 14.27], zoom: 8 })
    L.tileLayer(OSM_TILES, OSM_OPTIONS).addTo(map)
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 150)

    ;(async () => {
      // Carica markercluster dinamicamente (stesso pattern di Messages.tsx)
      ;(window as any).L = L
      await import('leaflet.markercluster')
      await import('leaflet.markercluster/dist/MarkerCluster.css')
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css')

      const mcgEvents   = (L as any).markerClusterGroup({ maxClusterRadius: 50, zoomToBoundsOnClick: true, spiderfyOnMaxZoom: false })
      const mcgMessages = (L as any).markerClusterGroup({ maxClusterRadius: 50, zoomToBoundsOnClick: true, spiderfyOnMaxZoom: false })

      // Load events
      const evs = await getAllEvents()
      evs.forEach(ev => {
        if (!ev.lat || !ev.lon) return
        L.circleMarker([ev.lat, ev.lon], { radius: 7, color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.8, weight: 2 })
          .bindPopup(`<b>${esc(ev.title)}</b><br><small>${esc(ev.category ?? '')} · ${esc(ev.status)}</small>`)
          .addTo(mcgEvents)
      })

      // Load messages
      const { data } = await supabase.from('messages').select('title, text, location, message_type').limit(500)
      if (data) {
        data.forEach(m => {
          const coords = parseMessageCoords(m.location)
          if (!coords) return
          const color = m.message_type === 'event' ? '#f59e0b' : m.message_type === 'offer' ? '#10b981' : '#0ea5e9'
          L.circleMarker([coords.lat, coords.lng], { radius: 6, color, fillColor: color, fillOpacity: 0.75, weight: 2 })
            .bindPopup(`<b>${esc(m.title ?? m.text?.slice(0, 40) ?? '—')}</b><br><small>${esc(m.message_type)}</small>`)
            .addTo(mcgMessages)
        })
      }

      map.addLayer(mcgEvents)
      map.addLayer(mcgMessages)
    })()

    return () => { map.remove(); mapRef.current = null }
  }, [])

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Mappa globale</h2>
        <div className="flex gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" /> Eventi</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-500" /> Messaggi</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" /> Ev.msg</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> Offerte</span>
        </div>
      </div>
      <div ref={mapDivRef} style={{ height: 400 }} className="rounded-lg overflow-hidden" />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────
type Tab = 'overview' | 'messages' | 'events' | 'utenti'

export default function Dashboard({ isAdmin, userId }: { isAdmin: boolean; userId: string }) {
  const [tab, setTab]         = useState<Tab>('overview')
  const [kpis, setKpis]       = useState<KPIs>({ totalUsers: 0, totalMessages: 0, activeMessages: 0, expiredMessages: 0 })
  const [evKpis, setEvKpis]   = useState<EventKPIs>({ total: 0, published: 0, draft: 0, cancelled: 0 })
  const [days7, setDays7]     = useState<DayCount[]>(buildDays(7))
  const [days30, setDays30]   = useState<DayCount[]>(buildDays(30))
  const [typeData, setTypeData]     = useState<NameValue[]>([])
  const [roleData, setRoleData]     = useState<NameValue[]>([])
  const [evCatData, setEvCatData]   = useState<NameValue[]>([])
  const [evStatusData, setEvStatusData] = useState<NameValue[]>([])
  const [evMonthData, setEvMonthData]   = useState<{ month: string; eventi: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [maximized, setMaximized] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin && !userId) return
    async function fetchData() {
      try {
        const now   = new Date().toISOString()
        const ago7  = new Date(Date.now() - 7 * 86400000).toISOString()
        const ago30 = new Date(Date.now() - 30 * 86400000).toISOString()

        const fill = (rows: { created_at: string }[], base: DayCount[]) => {
          rows.forEach(({ created_at }) => {
            const label = new Date(created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
            const e = base.find(x => x.date === label)
            if (e) e.messages++
          })
        }

        if (isAdmin) {
          // I conteggi per tipo/ruolo si facevano scaricando message_log e
          // user_profiles per intero e contando in JS: l'intero database
          // transitava nel browser a ogni apertura della dashboard.
          // Con head:true il server risponde solo col numero, zero righe.
          const countBy = (table: string, col: string, val: string) =>
            supabase.from(table).select('id', { count: 'exact', head: true }).eq(col, val)

          const [
            usersRes, messagesRes, activeRes, expiredRes,
            recent7Res, recent30Res, eventsRes,
            typeCounts, roleCounts,
          ] = await Promise.all([
              supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
              supabase.from('message_log').select('id', { count: 'exact', head: true }),
              supabase.from('messages').select('id', { count: 'exact', head: true }).gt('expires_at', now),
              supabase.from('messages').select('id', { count: 'exact', head: true }).lt('expires_at', now),
              supabase.from('message_log').select('created_at').gte('created_at', ago7),
              supabase.from('message_log').select('created_at').gte('created_at', ago30),
              supabase.from('events').select('status, category, start_at'),
              Promise.all(MSG_TYPES.map(t => countBy('message_log', 'message_type', t))),
              Promise.all(ROLES.map(r => countBy('user_profiles', 'role', r))),
            ])
          setKpis({
            totalUsers: usersRes.count ?? 0,
            totalMessages: messagesRes.count ?? 0,
            activeMessages: activeRes.count ?? 0,
            expiredMessages: expiredRes.count ?? 0,
          })
          if (recent7Res.data)  { const d = buildDays(7);  fill(recent7Res.data, d);  setDays7(d) }
          if (recent30Res.data) { const d = buildDays(30); fill(recent30Res.data, d); setDays30(d) }
          setTypeData(MSG_TYPES.map((t, i) => ({
            name: MSG_TYPE_LABELS[t],
            value: typeCounts[i].count ?? 0,
          })))
          setRoleData(ROLES.map((r, i) => ({ name: r, value: roleCounts[i].count ?? 0 })))
          if (eventsRes.data) {
            const evs = eventsRes.data
            setEvKpis({
              total: evs.length,
              published: evs.filter(e => e.status === 'published').length,
              draft: evs.filter(e => e.status === 'draft').length,
              cancelled: evs.filter(e => e.status === 'cancelled').length,
            })
            const catMap: Record<string, number> = {}
            evs.forEach(e => { const c = e.category ?? 'Altro'; catMap[c] = (catMap[c] ?? 0) + 1 })
            setEvCatData(Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })))
            setEvStatusData([
              { name: 'Pubblicati', value: evs.filter(e => e.status === 'published').length },
              { name: 'Bozze',      value: evs.filter(e => e.status === 'draft').length },
              { name: 'Annullati',  value: evs.filter(e => e.status === 'cancelled').length },
            ])
            const monthMap: Record<string, number> = {}
            for (let i = 5; i >= 0; i--) {
              const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
              monthMap[d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })] = 0
            }
            evs.forEach(e => {
              if (!e.start_at) return
              const key = new Date(e.start_at).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })
              if (key in monthMap) monthMap[key]++
            })
            setEvMonthData(Object.entries(monthMap).map(([month, eventi]) => ({ month, eventi })))
          }
        } else {
          const [totalRes, activeRes, expiredRes, recent7Res, recent30Res, typesRes] = await Promise.all([
            supabase.from('message_log').select('id', { count: 'exact', head: true }).eq('author_id', userId),
            supabase.from('messages').select('id', { count: 'exact', head: true }).eq('author_id', userId).gt('expires_at', now),
            supabase.from('messages').select('id', { count: 'exact', head: true }).eq('author_id', userId).lt('expires_at', now),
            supabase.from('message_log').select('created_at').eq('author_id', userId).gte('created_at', ago7),
            supabase.from('message_log').select('created_at').eq('author_id', userId).gte('created_at', ago30),
            supabase.from('message_log').select('message_type').eq('author_id', userId),
          ])
          setKpis({ totalUsers: 0, totalMessages: totalRes.count ?? 0, activeMessages: activeRes.count ?? 0, expiredMessages: expiredRes.count ?? 0 })
          if (recent7Res.data)  { const d = buildDays(7);  fill(recent7Res.data, d);  setDays7(d) }
          if (recent30Res.data) { const d = buildDays(30); fill(recent30Res.data, d); setDays30(d) }
          if (typesRes.data) {
            const c: Record<string, number> = { message: 0, event: 0, offer: 0 }
            typesRes.data.forEach(m => { const t = m.message_type ?? 'message'; c[t] = (c[t] ?? 0) + 1 })
            setTypeData([{ name: 'Messaggi', value: c.message }, { name: 'Eventi', value: c.event }, { name: 'Offerte', value: c.offer }])
          }
        }
      } catch { /* leave defaults */ } finally { setLoading(false) }
    }
    fetchData()
  }, [isAdmin, userId])

  const msgKpiCards = [
    ...(isAdmin ? [{ label: 'Utenti totali', value: kpis.totalUsers, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950' }] : []),
    { label: 'Messaggi totali',  value: kpis.totalMessages,  icon: MessageSquare, color: 'text-sky-600',     bg: 'bg-sky-50 dark:bg-sky-950' },
    { label: 'Messaggi attivi',  value: kpis.activeMessages,  icon: CheckCircle,   color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950' },
    { label: 'Messaggi scaduti', value: kpis.expiredMessages, icon: Clock,         color: 'text-rose-600',    bg: 'bg-rose-50 dark:bg-rose-950' },
  ]
  const evKpiCards = [
    { label: 'Eventi totali', value: evKpis.total,     icon: CalendarDays,  color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950' },
    { label: 'Pubblicati',    value: evKpis.published, icon: CalendarCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950' },
    { label: 'Bozze',         value: evKpis.draft,     icon: FileEdit,      color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-950' },
    { label: 'Annullati',     value: evKpis.cancelled, icon: XCircle,       color: 'text-rose-600',    bg: 'bg-rose-50 dark:bg-rose-950' },
  ]

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',  label: 'Overview',  icon: LayoutDashboard },
    { id: 'messages',  label: 'Messaggi',  icon: MessageSquare },
    { id: 'events',    label: 'Eventi',    icon: CalendarDays },
    /* Separata dalla mappa globale: quella mostra dove sono i CONTENUTI,
       questa dove sono le PERSONE. Sovrapporle avrebbe dato una mappa che
       non risponde bene a nessuna delle due domande. */
    { id: 'utenti',    label: 'Mappa utenti', icon: MapPinned },
  ]

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {TABS.filter(t => (t.id !== 'events' && t.id !== 'utenti') || isAdmin).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === id ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ──────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* KPI messaggi */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Messaggi</p>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {msgKpiCards.map(c => <KpiCard key={c.label} {...c} loading={loading} />)}
            </div>
          </div>
          {/* KPI eventi */}
          {isAdmin && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Eventi</p>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {evKpiCards.map(c => <KpiCard key={c.label} {...c} loading={loading} />)}
              </div>
            </div>
          )}
          {/* Mappa globale */}
          <OverviewMap isAdmin={isAdmin} />
        </div>
      )}

      {/* ── MAPPA UTENTI ──────────────────────────────────────────── */}
      {tab === 'utenti' && isAdmin && <UsersMap />}

      {/* ── MESSAGGI ──────────────────────────────────────────────── */}
      {tab === 'messages' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {msgKpiCards.map(c => <KpiCard key={c.label} {...c} loading={loading} />)}
          </div>
          <div className={`grid grid-cols-1 gap-6 ${isAdmin ? 'md:grid-cols-2' : ''}`}>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Per tipo</h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} /><Legend iconType="circle" iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {isAdmin && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Utenti per ruolo</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={roleData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                      {roleData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} /><Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartCard title="Messaggi ultimi 7 giorni" maximized={maximized === '7d'} onMaximize={() => setMaximized('7d')} onClose={() => setMaximized(null)}>
              <LineChart data={days7} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="messages" name="Messaggi" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3, fill: '#4f46e5' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ChartCard>
            <ChartCard title="Messaggi ultimi 30 giorni" maximized={maximized === '30d'} onMaximize={() => setMaximized('30d')} onClose={() => setMaximized(null)}>
              <AreaChart data={days30} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad30" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="messages" name="Messaggi" stroke="#4f46e5" strokeWidth={2} fill="url(#grad30)" />
              </AreaChart>
            </ChartCard>
          </div>
        </div>
      )}

      {/* ── EVENTI ────────────────────────────────────────────────── */}
      {tab === 'events' && isAdmin && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {evKpiCards.map(c => <KpiCard key={c.label} {...c} loading={loading} />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Donut per stato */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Per stato</h2>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={evStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    <Cell fill="#22c55e" /><Cell fill="#f59e0b" /><Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} /><Legend iconType="circle" iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Trend mensile */}
            <ChartCard title="Trend eventi (6 mesi)" maximized={maximized === 'evmonth'} onMaximize={() => setMaximized('evmonth')} onClose={() => setMaximized(null)}>
              <AreaChart data={evMonthData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradEv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="eventi" name="Eventi" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradEv)" />
              </AreaChart>
            </ChartCard>
          </div>
          {/* Bar chart categorie — full width con altezza proporzionale */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Per categoria</h2>
              <button onClick={() => setMaximized(maximized === 'evcat' ? null : 'evcat')} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(240, evCatData.length * 28)}>
              <BarChart data={evCatData} layout="vertical" margin={{ top: 4, right: 40, left: 80, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={76} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="value" name="Eventi" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: '#6b7280' }}>
                  {evCatData.map((_, i) => <Cell key={i} fill={EVENT_COLORS[i % EVENT_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {maximized === 'evcat' && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">Per categoria</h2>
                  <button onClick={() => setMaximized(null)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"><X className="w-5 h-5" /></button>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(360, evCatData.length * 32)}>
                  <BarChart data={evCatData} layout="vertical" margin={{ top: 4, right: 60, left: 100, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} width={96} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="value" name="Eventi" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 12, fill: '#6b7280' }}>
                      {evCatData.map((_, i) => <Cell key={i} fill={EVENT_COLORS[i % EVENT_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
