import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'
import { getStorage, FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Function to safely initialize/get the app
// This is lazy so it won't crash at build time if keys are missing
function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp()
  
  // during build, if apiKey is missing, initialize with dummy values 
  // to prevent the SDK from crashing the build
  const config = {
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey || 'BUILD_TIME_DUMMY_KEY',
    projectId: firebaseConfig.projectId || 'BUILD_TIME_DUMMY_PROJECT'
  }
  
  return initializeApp(config)
}

export const app = getFirebaseApp()
export const auth: Auth = getAuth(app)
export const db: Firestore = getFirestore(app)
export const storage: FirebaseStorage = getStorage(app)
export default app
