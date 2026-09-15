import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ArrowLeft, MessageSquare, CheckCircle, Clock, Pencil, Save, X, Tag, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Profile {
  id: string
  username: string
  role: string | null
  avatar_url: string | null
  created_at: string
}

interface Message {
  id: string
  title: string | null
  text: string
  message_type: 'message' | 'event' | 'offer' | null
  created_at: string
  expires_at: string
}

interface DayCount { date: string; messages: number }
interface NameValue { name: string; value: number }

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e']
const TOOLTIP_STYLE = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }

const ROLES = ['user', 'premium', 'admin']

const roleBg: Record<string, string> = {
  admin: 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300',
  premium: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300',
  user: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
}

const typeBadge: Record<string, string> = {
  message: 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300',
  event: 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300',
  offer: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
}

const typeLabel: Record<string, string> = { message: 'Messaggio', event: 'Evento', offer: 'Offerta' }

function buildDays(n: number): DayCount[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return { date: d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }), messages: 0 }
  })
}

function buildMonths(n: number): DayCount[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (n - 1 - i))
    return { date: d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }), messages: 0 }
  })
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [days30, setDays30] = useState<DayCount[]>(buildDays(30))
  const [months6, setMonths6] = useState<DayCount[]>(buildMonths(6))
  const [typeData, setTypeData] = useState<NameValue[]>([])
  const [kpis, setKpis] = useState({ total: 0, active: 0, expired: 0, events: 0, offers: 0 })
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editRole, setEditRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    async function load() {
      try {
        const now = new Date().toISOString()
        const ago30 = new Date(Date.now() - 30 * 86400000).toISOString()
        const ago6m = new Date(Date.now() - 180 * 86400000).toISOString()

        const [profileRes, messagesRes, log30Res, log6mRes, logTypesRes, totalRes, activeRes, expiredRes] =
          await Promise.all([
            supabase.from('user_profiles').select('id, username, role, avatar_url, created_at').eq('id', id).single(),
            supabase.from('messages').select('id, title, text, message_type, created_at, expires_at').eq('author_id', id).order('created_at', { ascending: false }).limit(10),
            supabase.from('message_log').select('created_at').eq('author_id', id).gte('created_at', ago30),
            supabase.from('message_log').select('created_at').eq('author_id', id).gte('created_at', ago6m),
            supabase.from('message_log').select('message_type').eq('author_id', id),
            supabase.from('message_log').select('id', { count: 'exact', head: true }).eq('author_id', id),
            supabase.from('messages').select('id', { count: 'exact', head: true }).eq('author_id', id).gt('expires_at', now),
            supabase.from('messages').select('id', { count: 'exact', head: true }).eq('author_id', id).lt('expires_at', now),
          ])

        if (profileRes.data) {
          setProfile(profileRes.data)
          setEditUsername(profileRes.data.username)
          setEditRole(profileRes.data.role ?? 'user')
        }

        if (messagesRes.data) setMessages(messagesRes.data as Message[])

        if (log30Res.data) {
          const d = buildDays(30)
          log30Res.data.forEach(({ created_at }) => {
            const label = new Date(created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
            const e = d.find(x => x.date === label)
            if (e) e.messages++
          })
          setDays30(d)
        }

        if (log6mRes.data) {
          const m = buildMonths(6)
          log6mRes.data.forEach(({ created_at }) => {
            const label = new Date(created_at).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })
            const e = m.find(x => x.date === label)
            if (e) e.messages++
          })
          setMonths6(m)
        }

        if (logTypesRes.data) {
          const c: Record<string, number> = { message: 0, event: 0, offer: 0 }
          logTypesRes.data.forEach(m => { const t = m.message_type ?? 'message'; c[t] = (c[t] ?? 0) + 1 })
          setTypeData([
            { name: 'Messaggi', value: c['message'] },
            { name: 'Eventi', value: c['event'] },
            { name: 'Offerte', value: c['offer'] },
          ])
          setKpis({
            total: totalRes.count ?? 0,
            active: activeRes.count ?? 0,
            expired: expiredRes.count ?? 0,
            events: c['event'],
            offers: c['offer'],
          })
        } else {
          setKpis({ total: totalRes.count ?? 0, active: activeRes.count ?? 0, expired: expiredRes.count ?? 0, events: 0, offers: 0 })
        }
      } catch {
        // leave defaults
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleSave() {
    if (!id) return
    const trimmed = editUsername.trim()
    if (trimmed.length < 3 || trimmed.length > 30) {
      setSaveError('Il nome deve avere tra 3 e 30 caratteri.')
      return
    }
    if (!/^[A-Za-z0-9_.\-]+$/.test(trimmed)) {
      setSaveError('Solo lettere, numeri, punto, trattino e underscore.')
      return
    }
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase.from('user_profiles').update({ username: trimmed, role: editRole }).eq('id', id)
    if (error) {
      if (error.code === '23505') {
        setSaveError('Questo username è già in uso.')
      } else {
        setSaveError('Errore nel salvataggio.')
      }
    } else {
      setProfile(p => p ? { ...p, username: trimmed, role: editRole } : p)
      setEditing(false)
    }
    setSaving(false)
  }

  const now = new Date()

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">Caricamento…</div>
  if (!profile) return <div className="flex items-center justify-center py-20 text-gray-400">Utente non trovato</div>

  const kpiCards = [
    { label: 'Inviati (storico)', value: kpis.total, icon: MessageSquare, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950' },
    { label: 'Attivi ora', value: kpis.active, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950' },
    { label: 'Scaduti', value: kpis.expired, icon: Clock, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950' },
    { label: 'Eventi inviati', value: kpis.events, icon: CalendarDays, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950' },
    { label: 'Offerte inviate', value: kpis.offers, icon: Tag, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950' },
  ]

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/users')} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Torna agli utenti
      </button>

      {/* Profile card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-5">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-2xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-3xl flex-shrink-0">
              {profile.username?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Username</label>
                  <input
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value)}
                    className="w-full max-w-xs px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ruolo</label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {saveError && <p className="text-xs text-red-500">{saveError}</p>}
                <div className="flex items-center gap-2">
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-semibold rounded-lg transition">
                    <Save className="w-3.5 h-3.5" /> {saving ? 'Salvo…' : 'Salva'}
                  </button>
                  <button onClick={() => { setEditing(false); setSaveError(null) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg transition">
                    <X className="w-3.5 h-3.5" /> Annulla
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">{profile.username}</h1>
                  <button onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-indigo-600 transition">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
                  <div>
                    <span className="text-xs text-gray-400">Ruolo</span>
                    <div className="mt-0.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleBg[profile.role ?? 'user'] ?? roleBg['user']}`}>
                        {profile.role ?? 'user'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Registrato</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                      {new Date(profile.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">ID</span>
                    <p className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-xs">{profile.id}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {kpiCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className={`${bg} p-2.5 rounded-xl flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{value.toLocaleString('it-IT')}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Attività ultimi 30 giorni</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={days30} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} interval={4} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="messages" name="Messaggi" stroke="#4f46e5" strokeWidth={2} dot={{ r: 2, fill: '#4f46e5' }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Messaggi per tipo</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6 md:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Messaggi ultimi 6 mesi</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={months6} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="messages" name="Messaggi" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent messages */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Ultimi messaggi</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Nessun messaggio attivo</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {messages.map((msg) => {
              const t = (msg.message_type ?? 'message') as 'message' | 'event' | 'offer'
              const expiresAt = new Date(msg.expires_at)
              const isActive = expiresAt > now
              return (
                <div key={msg.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{msg.title ?? msg.text}</p>
                    {msg.title && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{msg.text}</p>}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                      <span className="text-xs text-gray-400">Scade: {expiresAt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeBadge[t]}`}>{typeLabel[t]}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isActive ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                      {isActive ? 'Attivo' : 'Scaduto'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
