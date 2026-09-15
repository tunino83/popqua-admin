import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, MessageSquare, Settings, LogOut, UserCircle, CalendarDays, MapPinned } from 'lucide-react'

interface SidebarProps {
  onSignOut: () => void
  username: string
  isAdmin: boolean
  userId: string
}

export default function Sidebar({ onSignOut, username, isAdmin, userId }: SidebarProps) {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
    { to: `/users/${userId}`, label: 'Il mio profilo', icon: UserCircle, adminOnly: false },
    { to: '/users', label: 'Utenti', icon: Users, adminOnly: true },
    { to: '/users-map', label: 'Mappa utenti', icon: MapPinned, adminOnly: true },
    { to: '/messages', label: 'Messaggi', icon: MessageSquare, adminOnly: false },
    { to: '/events', label: 'Eventi', icon: CalendarDays, adminOnly: true },
    { to: '/settings', label: 'Impostazioni', icon: Settings, adminOnly: true },
  ].filter(item => !item.adminOnly || isAdmin)

  return (
    <aside className="w-64 flex-shrink-0 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <img src="/icona.png" alt="POPQua" className="w-8 h-8 rounded-xl" />
          <span className="text-lg font-bold text-gray-900 dark:text-white">POPQua</span>
          <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
            isAdmin
              ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
              : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
          }`}>
            {isAdmin ? 'Admin' : 'Premium'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase">
              {username.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{username}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{isAdmin ? 'Amministratore' : 'Premium'}</p>
          </div>
          <button onClick={onSignOut} title="Esci"
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
