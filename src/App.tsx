import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useTemaScuro, bottone } from './components/ui'
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
import Diagnostica from './pages/Diagnostica'
import Capsule from './pages/Capsule'
import Segnalazioni from './pages/Segnalazioni'
import Locali from './pages/Locali'
import LocaleDetail from './pages/LocaleDetail'
import MieiLocali from './pages/MieiLocali'
import Login from './pages/Login'
import { useAuth } from './hooks/useAuth'
import { ShieldX } from 'lucide-react'

export default function App() {
  const [scuro, cambiaTema] = useTemaScuro()
  const [menuAperto, setMenuAperto] = useState(false)
  const { user, profile, loading, isAdmin, isPremium, isGestore, signIn, signInWithGoogle, signOut } = useAuth()
  const userId = profile?.id ?? ''

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Caricamento…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={signIn} onGoogleLogin={signInWithGoogle} />
  }

  if (!isAdmin && !isPremium && !isGestore) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-100 dark:bg-red-950 rounded-xl mb-4">
            <ShieldX className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Accesso negato</h1>
          <p className="text-sm text-gray-500 mb-4">Questo account non gestisce nessun locale e non ha accesso al pannello. Se hai un locale con POPQua, scrivici per collegarlo.</p>
          <button
            onClick={signOut}
            className={bottone('secondario')}
          >
            Esci
          </button>
        </div>
      </div>
    )
  }

  /* Chi gestisce un locale e non e' admin ne' premium vede solo i suoi locali. */
  const soloGestore = isGestore && !isAdmin && !isPremium

  return (
    <div>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar onSignOut={signOut} username={profile?.username ?? user.email ?? 'Admin'} isAdmin={isAdmin} userId={userId}
          isGestore={isGestore} soloGestore={soloGestore}
          aperta={menuAperto} onChiudi={() => setMenuAperto(false)} scuro={scuro} onScuro={cambiaTema} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header onApriMenu={() => setMenuAperto(true)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {soloGestore ? (
              <Routes>
                <Route path="/miei-locali" element={<MieiLocali userId={userId} />} />
                <Route path="/miei-locali/:id" element={<LocaleDetail gestore />} />
                <Route path="*" element={<Navigate to="/miei-locali" replace />} />
              </Routes>
            ) : <>
            <Routes>
              <Route path="/" element={<Dashboard isAdmin={isAdmin} userId={userId} />} />
              {isAdmin && <Route path="/users" element={<Users />} />}
              {/* La mappa ora e' una scheda di Utenti: il vecchio indirizzo ci porta. */}
              {isAdmin && <Route path="/users-map" element={<Navigate to="/users?vista=mappa" replace />} />}
              {isAdmin && <Route path="/diagnostica" element={<Diagnostica />} />}
              {isAdmin && <Route path="/capsule" element={<Capsule />} />}
              {isAdmin && <Route path="/segnalazioni" element={<Segnalazioni />} />}
              {isAdmin && <Route path="/locali" element={<Locali />} />}
              {isAdmin && <Route path="/locali/:id" element={<LocaleDetail />} />}
              <Route path="/users/:id" element={<UserDetail />} />
              <Route path="/messages" element={<Messages isAdmin={isAdmin} userId={userId} />} />
              <Route path="/messages/new" element={<CreateMessage />} />
              <Route path="/messages/:id" element={<MessageDetail />} />
              {isAdmin && <Route path="/events" element={<Events />} />}
              {isAdmin && <Route path="/events/new" element={<EventDetail />} />}
              {isAdmin && <Route path="/events/:id" element={<EventDetail />} />}
              <Route path="/settings" element={<Settings />} />
              {isGestore && <Route path="/miei-locali" element={<MieiLocali userId={userId} />} />}
              {isGestore && <Route path="/miei-locali/:id" element={<LocaleDetail gestore={!isAdmin} />} />}
            </Routes>
            </>}
          </main>
        </div>
      </div>
    </div>
  )
}
