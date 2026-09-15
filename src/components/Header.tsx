import { useLocation } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'

function resolveTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard'
  if (pathname === '/users') return 'Utenti'
  if (pathname.startsWith('/users/')) return 'Dettaglio utente'
  if (pathname === '/messages') return 'Messaggi'
  if (pathname.startsWith('/messages/new')) return 'Nuovo messaggio'
  if (pathname.startsWith('/messages/')) return 'Dettaglio messaggio'
  if (pathname === '/events') return 'Eventi'
  if (pathname.startsWith('/events/new')) return 'Nuovo evento'
  if (pathname.startsWith('/events/')) return 'Dettaglio evento'
  if (pathname === '/settings') return 'Impostazioni'
  return 'Admin'
}

interface HeaderProps {
  darkMode: boolean
  onToggleDark: () => void
}

export default function Header({ darkMode, onToggleDark }: HeaderProps) {
  const location = useLocation()
  const title = resolveTitle(location.pathname)

  return (
    <header className="h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center px-6 gap-4 flex-shrink-0">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex-1">{title}</h1>

      <button
        onClick={onToggleDark}
        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={darkMode ? 'Modalità chiara' : 'Modalità scura'}
      >
        {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <span className="text-sm font-semibold bg-indigo-600 text-white px-3 py-1 rounded-full">
        Admin
      </span>
    </header>
  )
}
