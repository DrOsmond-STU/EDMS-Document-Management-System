import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function Layout({ children }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--color-app-bg)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
