import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'OpsAudit AI',
  description: 'AI-powered operational audit platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0A0A0A] text-white antialiased">
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#111111', color: '#fff', border: '1px solid #1F1F1F', borderRadius: '10px', fontSize: '14px' },
              success: { iconTheme: { primary: '#F97316', secondary: '#0A0A0A' } },
              error: { iconTheme: { primary: '#EF4444', secondary: '#0A0A0A' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
