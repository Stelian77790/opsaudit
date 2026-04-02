'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { AppUser } from '@/types'

interface AuthContextType {
  user: AppUser | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  logOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadUserData(fbUser: FirebaseUser): Promise<AppUser | null> {
    const userDoc = await getDoc(doc(db, 'users', fbUser.uid))
    if (userDoc.exists()) {
      return { uid: fbUser.uid, ...userDoc.data() } as AppUser
    }
    return null
  }

  async function refreshUser() {
    if (firebaseUser) {
      const userData = await loadUserData(firebaseUser)
      setUser(userData)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)
      if (fbUser) {
        const userData = await loadUserData(fbUser)
        setUser(userData)
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function signUp(email: string, password: string, name: string) {
    const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password)
    await setDoc(doc(db, 'users', fbUser.uid), {
      email,
      name,
      companyId: null,
      role: null,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    })
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    const { user: fbUser } = await signInWithPopup(auth, provider)
    const userDoc = await getDoc(doc(db, 'users', fbUser.uid))
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', fbUser.uid), {
        email: fbUser.email,
        name: fbUser.displayName || 'User',
        companyId: null,
        role: null,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      })
    }
  }

  async function logOut() {
    await signOut(auth)
    setUser(null)
    setFirebaseUser(null)
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email)
  }

  return (
    <AuthContext.Provider value={{
      user, firebaseUser, loading,
      signIn, signUp, signInWithGoogle, logOut, resetPassword, refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
