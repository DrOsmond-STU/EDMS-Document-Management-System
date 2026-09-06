import { NavLink } from 'react-router-dom'
import { FileText, LifeBuoy } from 'lucide-react'
import { NAV_GROUPS } from './navConfig'

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-[var(--color-sidebar-bg)] md:flex">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-[var(--color-sidebar-border)] px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-sidebar-accent)]/15 text-[var(--color-sidebar-accent)]">
          <FileText size={18} strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-bold leading-tight tracking-tight text-white">EDMS</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-sidebar-text)]">
            Document Governance
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <div className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-sidebar-text)]/60">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-2.5 rounded-md border-l-2 px-2.5 py-1.5 text-[13px] transition-colors ${
                        isActive
                          ? 'border-[var(--color-sidebar-accent)] bg-[var(--color-sidebar-bg-active)] font-semibold text-[var(--color-sidebar-text-active)]'
                          : item.roadmap
                            ? 'border-transparent text-[var(--color-sidebar-text)]/50 hover:border-[var(--color-sidebar-border)] hover:bg-[var(--color-sidebar-bg-active)]/60'
                            : 'border-transparent text-[var(--color-sidebar-text)] hover:border-[var(--color-sidebar-border)] hover:bg-[var(--color-sidebar-bg-active)]/60 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          size={15}
                          strokeWidth={isActive ? 2.25 : 1.75}
                          className={
                            isActive
                              ? 'text-[var(--color-sidebar-accent)]'
                              : item.roadmap
                                ? 'text-[var(--color-sidebar-text)]/50'
                                : 'text-[var(--color-sidebar-text)] group-hover:text-white'
                          }
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.roadmap && (
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--color-sidebar-text)]">
                            Soon
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer hint */}
      <div className="border-t border-[var(--color-sidebar-border)] p-3">
        <a
          href="https://github.com/DrOsmond-STU/EDMS-Document-Management-System"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-[var(--color-sidebar-text)] transition-colors hover:bg-[var(--color-sidebar-bg-active)] hover:text-white"
        >
          <LifeBuoy size={13} strokeWidth={1.75} />
          <span>Dokumentasi & Bantuan</span>
        </a>
      </div>
    </aside>
  )
}
