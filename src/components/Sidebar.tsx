import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, MessageSquare, Settings, LogOut, CalendarDays, Activity, Lock, Flag, Store, Utensils,
  Moon, Sun, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

interface SidebarProps {
  onSignOut: () => void
  username: string
  isAdmin: boolean
  userId: string
  /* Su telefono la barra laterale esce dallo schermo e torna solo quando
     la si chiama: sessantaquattro caratteri di larghezza fissa su un
     display da 375 px lasciavano un terzo di pagina al contenuto. */
  aperta?: boolean
  onChiudi?: () => void
  /** Gestisce almeno un locale. */
  isGestore?: boolean
  /** Solo gestore: niente altre voci. */
  soloGestore?: boolean
  scuro: boolean
  onScuro: () => void
}

type Voce = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; conta?: number }

/* Le segnalazioni ancora da decidere: il numero accanto alla voce, cosi'
   si vede da ogni pagina che c'e' da fare. */
function useSegnalazioniAperte(attivo: boolean) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!attivo) return
    const conta = () => supabase.rpc('admin_segnalazioni', { p_tutte: false })
      .then(({ data }) => setN(Array.isArray(data) ? data.length : 0))
    conta()
    const t = setInterval(conta, 120_000)
    window.addEventListener('segnalazioni-cambiate', conta)
    return () => { clearInterval(t); window.removeEventListener('segnalazioni-cambiate', conta) }
  }, [attivo])
  return n
}

export default function Sidebar({ onSignOut, username, isAdmin, userId, aperta = false, onChiudi, isGestore = false, soloGestore = false, scuro, onScuro }: SidebarProps) {
  const segnalazioni = useSegnalazioniAperte(isAdmin)

  /* Voci raggruppate per lavoro, non in fila: prima si guardava un
     elenco piatto di undici voci con il profilo al secondo posto. */
  const gruppi: { nome?: string; voci: Voce[] }[] = soloGestore
    ? [{ voci: [{ to: '/miei-locali', label: 'I miei locali', icon: Utensils }] }]
    : [
        { voci: [{ to: '/', label: 'Oggi', icon: LayoutDashboard }] },
        { nome: 'Contenuti', voci: [
          { to: '/messages', label: 'Messaggi', icon: MessageSquare },
          ...(isAdmin ? [
            { to: '/events', label: 'Eventi', icon: CalendarDays },
            { to: '/capsule', label: 'Capsule', icon: Lock },
          ] : []),
        ] },
        ...(isAdmin ? [{ nome: 'Moderazione', voci: [{ to: '/segnalazioni', label: 'Segnalazioni', icon: Flag, conta: segnalazioni }] }] : []),
        ...(isAdmin || isGestore ? [{ nome: 'Locali', voci: [
          ...(isAdmin ? [{ to: '/locali', label: 'Tutti i locali', icon: Store }] : []),
          ...(isGestore ? [{ to: '/miei-locali', label: 'I miei locali', icon: Utensils }] : []),
        ] }] : []),
        ...(isAdmin ? [
          { nome: 'Persone', voci: [{ to: '/users', label: 'Utenti', icon: Users }] },
          { nome: 'Sistema', voci: [
            { to: '/diagnostica', label: 'Diagnostica app', icon: Activity },
            { to: '/settings', label: 'Impostazioni', icon: Settings },
          ] },
        ] : []),
      ]
  const ruolo = isAdmin ? 'Amministratore' : soloGestore ? 'Gestore' : 'Premium'

  return (
    <>
    {/* Velo: sotto la barra aperta, chiude al tocco. Solo su schermi
        stretti, dove la barra sta sopra il contenuto. */}
    {aperta && (
      <div onClick={onChiudi} className="lg:hidden fixed inset-0 z-30 bg-black/50" aria-hidden />
    )}
    <aside aria-label="Menu" className={`w-60 flex-shrink-0 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col
      fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-200
      ${aperta ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className="px-5 h-16 flex items-center gap-2.5 flex-shrink-0">
        <img src="/icona.png" alt="" className="w-8 h-8 rounded-lg" />
        <div className="leading-tight">
          <span className="block font-display text-lg font-bold text-gray-900 dark:text-white">POPQua</span>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">Pannello</span>
        </div>
        <button onClick={onChiudi} aria-label="Chiudi il menu" className="lg:hidden ml-auto p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {gruppi.map((g, i) => (
          <div key={g.nome ?? i}>
            {g.nome && <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{g.nome}</p>}
            <div className="space-y-0.5">
              {g.voci.map(({ to, label, icon: Icon, conta }) => (
                <NavLink key={to} to={to} end={to === '/'} onClick={onChiudi}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                    }`}>
                  <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {!!conta && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center"
                      aria-label={`${conta} da vedere`}>{conta}</span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-800 space-y-1">
        <button onClick={onScuro}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          {scuro ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          {scuro ? 'Tema chiaro' : 'Tema scuro'}
        </button>
        <div className="flex items-center gap-2 pl-1">
          <NavLink to={soloGestore ? '/miei-locali' : `/users/${userId}`} onClick={onChiudi} title="Il mio profilo"
            className="flex-1 min-w-0 flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="w-8 h-8 rounded-full bg-gray-900 dark:bg-gray-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white dark:text-gray-900 uppercase">
              {username.charAt(0)}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">{username}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{ruolo}</span>
            </span>
          </NavLink>
          <button onClick={onSignOut} title="Esci" aria-label="Esci"
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
    </>
  )
}
