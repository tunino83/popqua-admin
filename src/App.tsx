import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { PenLine } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Messages from './pages/Messages'
import Settings from './pages/Settings'
import Events from './pages/Events'
import EventDetail from './pages/EventDetail'
import UserDetail from './pages/UserDetail'
import MessageDetail from './pages/MessageDetail'
import CreateMessage from './pages/CreateMessage'
import UsersMap from './pages/UsersMap'
import Login from './pages/Login'
import { useAuth } from './hooks/useAuth'
import { ShieldX } from 'lucide-react'

function NewMessageFab() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/messages/new')}
      className="fixed bottom-6 right-6 z-40 w-12 h-12 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
      title="Nuovo messaggio"
    >
      <PenLine className="w-5 h-5" />
    </button>
  )
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false)
  const { user, profile, loading, isAdmin, isPremium, signIn, signInWithGoogle, signOut } = useAuth()
  const userId = profile?.id ?? ''

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Caricamento…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={signIn} onGoogleLogin={signInWithGoogle} />
  }

  if (!isAdmin && !isPremium) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-100 rounded-2xl mb-4">
            <ShieldX className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Accesso negato</h1>
          <p className="text-sm text-gray-500 mb-4">Il tuo account non ha i permessi di amministratore.</p>
          <button
            onClick={signOut}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition"
          >
            Esci
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar onSignOut={signOut} username={profile?.username ?? user.email ?? 'Admin'} isAdmin={isAdmin} userId={userId} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} />
          <main className="flex-1 overflow-y-auto p-6">
            <NewMessageFab />
            <Routes>
              <Route path="/" element={<Dashboard isAdmin={isAdmin} userId={userId} />} />
              {isAdmin && <Route path="/users" element={<Users />} />}
              {isAdmin && <Route path="/users-map" element={<UsersMap />} />}
              <Route path="/users/:id" element={<UserDetail />} />
              <Route path="/messages" element={<Messages isAdmin={isAdmin} userId={userId} />} />
              <Route path="/messages/new" element={<CreateMessage />} />
              <Route path="/messages/:id" element={<MessageDetail />} />
              {isAdmin && <Route path="/events" element={<Events />} />}
              {isAdmin && <Route path="/events/new" element={<EventDetail />} />}
              {isAdmin && <Route path="/events/:id" element={<EventDetail />} />}
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}
