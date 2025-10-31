// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type User = {
  id: string
  email?: string | null
  type?: 'candidate' | 'recruiter' | null
  [k: string]: any
}

type AuthContextValue = {
  user: User | null
  isLoading: boolean
  signup: (email: string, password: string, type: 'candidate' | 'recruiter') => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Helper: fetch profile row and merge with auth user
  const fetchProfile = async (authUserId: string | undefined | null) => {
    if (!authUserId) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle()
    if (error) {
      console.error('error fetching profile', error)
      return null
    }
    return data
  }

  const refreshUser = async () => {
    setIsLoading(true)
    try {
      const { data } = await supabase.auth.getUser()
      const authUser = data?.user ?? null
      if (!authUser) {
        setUser(null)
      } else {
        const profile = await fetchProfile(authUser.id)
        setUser({
          id: authUser.id,
          email: authUser.email,
          type: profile?.type ?? null,
          ...profile
        })
      }
    } catch (err) {
      console.error('refreshUser error', err)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // initialize
    refreshUser()

    // listen to auth state change
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // session may be null on logout
      // call refreshUser to re-fetch profile and update state
      refreshUser()
    })

    return () => {
      listener.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // signup with a role (type)
  const signup = async (email: string, password: string, type: 'candidate' | 'recruiter') => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      })
      if (error) throw error

      // If immediate user created (sometimes email confirmation required), create profile row
      const userId = data.user?.id
      if (userId) {
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({ id: userId, full_name: '', headline: '', location: '', skills: [], type })
        if (upsertError) throw upsertError
      }

      // refresh local user state
      await refreshUser()
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      await refreshUser()
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const value: AuthContextValue = {
    user,
    isLoading,
    signup,
    login,
    logout,
    refreshUser
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
