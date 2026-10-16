"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const navItems = [
  { name: 'Leads', href: '/app/leads', icon: 'users' },
  { name: 'Campanhas', href: '/app/campanhas', icon: 'calendar' },
  { name: 'Pipeline', href: '/app/pipeline', icon: 'folder-open' },
  { name: 'Analytics', href: '/app/analytics', icon: 'pie-chart' },
  { name: 'Configurações', href: '/app/perfil', icon: 'settings' },
]

export const DashboardShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-gray-900 border-r border-gray-800 transition-all duration-300",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-10 h-12 px-2">
            {isSidebarOpen && (
              <span className="font-courier font-bold text-xl tracking-tighter">
                TA<span className="text-gray-500">PP</span>O
              </span>
            )}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link 
                  key={item.name} 
                  href={item.href} 
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group",
                    isActive ? "bg-white text-black" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <img 
                    src={`/icons/${item.icon}.svg`} 
                    alt={item.name} 
                    className={cn(
                      "w-5 h-5 transition-colors",
                      isActive ? "text-black" : "text-gray-400 group-hover:text-white"
                    )} 
                    style={{ filter: isActive ? 'invert(0)' : 'invert(1)' }}
                  />
                  {isSidebarOpen && <span className="font-courier text-sm font-medium">{item.name}</span>}
                </Link>
              )
            })}
          </nav>

          <div className="mt-auto p-2 border-t border-gray-800">
            <div className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600" />
              {isSidebarOpen && (
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-bold truncate">SDR TEST</span>
                  <span className="text-[10px] text-gray-500 truncate">Plano Pro</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300 min-h-screen",
        isSidebarOpen ? "ml-64" : "ml-20"
      )}>
        <header className="h-16 border-b border-gray-800 flex items-center justify-between px-8 bg-black/50 backdrop-blur-sm sticky top-0 z-40">
          <h1 className="font-courier font-bold uppercase tracking-widest text-sm text-gray-400">
            {pathname.split('/').pop() || 'Dashboard'}
          </h1>
          <div className="flex items-center gap-4">
            <button className="p-2 text-gray-400 hover:text-white transition-colors relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-white rounded-full" />
            </button>
            <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700" />
          </div>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
