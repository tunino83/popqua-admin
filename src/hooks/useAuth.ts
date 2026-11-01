import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  username: string
  role: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  /* Gestisce almeno un locale (locali_gestori): entra nel pannello anche
     senza essere admin o premium, e vede solo i suoi locali. */
  const [isGestore, setIsGestore] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      if (data.session?.user) fetchProfile(data.session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const [{ data, error }, gestiti] = await Promise.all([
      supabase.from('user_profiles').select('id, username, role').eq('id', userId).single(),
      supabase.from('locali_gestori').select('locale_id', { count: 'exact', head: true }).eq('user_id', userId),
    ])
    setIsGestore((gestiti.count ?? 0) > 0)
    console.log('[useAuth] userId:', userId, 'profile:', JSON.stringify(data), 'error:', JSON.stringify(error))
    setProfile(data)
    setLoading(false)
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const isAdmin   = profile?.role === 'admin'
  const isPremium = profile?.role === 'premium'

  return { user, profile, loading, isAdmin, isPremium, isGestore, signIn, signInWithGoogle, signOut }
}
