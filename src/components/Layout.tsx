import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { PrototypeBanner } from './PrototypeBanner'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#fafaf8]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <PrototypeBanner />
        <Topbar />
        <main className="flex-1 overflow-y-auto px-6 py-5">{children}</main>
      </div>
    </div>
  )
}
