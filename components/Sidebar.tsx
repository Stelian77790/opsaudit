'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, ClipboardList, FileText,
  Users, Settings, LogOut, Zap, ChevronDown, Plus,
  Brain, Shield, AlertOctagon
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/audits', icon: ClipboardList, label: 'Audits' },
  { href: '/templates', icon: FileText, label: 'Templates' },
  { href: '/actions', icon: ClipboardList, label: 'Actions' },
  { href: '/permits', icon: Shield, label: 'Permits' },
  { href: '/incidents', icon: AlertOctagon, label: 'Incidents' },
  { href: '/intelligence', icon: Brain, label: 'Intelligence' },
  { href: '/team', icon: Users, label: 'Team' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logOut } = useAuth()
  const router = useRouter()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  async function handleLogout() {
    await logOut()
    router.push('/auth/login')
  }

  return (
    <aside className="w-60 h-screen bg-[#0D0D0D] border-r border-[#1F1F1F] flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="p-4 border-b border-[#1F1F1F]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" fill="white" />
          </div>
          <div>
            <span className="text-white font-semibold text-sm">OpsAudit</span>
            <span className="text-xs bg-orange-500/20 text-orange-400 ml-1 px-1.5 py-0.5 rounded-full">AI</span>
          </div>
        </div>
        {user?.name && (
          <p className="text-xs text-neutral-600 mt-1 truncate">{user.name}</p>
        )}
      </div>

      {/* Quick Action */}
      <div className="px-3 pt-3">
        <Link href="/audits/new" className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2">
          <Plus className="w-4 h-4" /> New Audit
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} className={active ? 'sidebar-item-active' : 'sidebar-item'}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User Menu */}
      <div className="p-3 border-t border-[#1F1F1F]">
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1A1A1A] transition-colors"
        >
          <div className="w-7 h-7 bg-orange-500/20 border border-orange-500/30 rounded-full flex items-center justify-center text-orange-400 text-xs font-medium shrink-0">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm text-white truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-neutral-600 truncate">{user?.role || ''}</p>
          </div>
          <ChevronDown className={`w-3 h-3 text-neutral-600 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        {userMenuOpen && (
          <div className="mt-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg overflow-hidden animate-fade-in">
            <Link href="/settings" className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-[#222] transition-colors">
              <Settings className="w-3.5 h-3.5" /> Settings
            </Link>
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-[#222] transition-colors">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
