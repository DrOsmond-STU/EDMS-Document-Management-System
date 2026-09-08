import { Sidebar } from './Sidebar'

export function Layout({ children }) {
  return (
    <div className="flex min-h-screen w-full bg-[var(--color-app-bg)]">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
