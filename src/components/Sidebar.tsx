import { NavLink } from 'react-router-dom'
import { FileText, LifeBuoy } from 'lucide-react'
import { NAV_GROUPS } from './navConfig'

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-neutral-border)] bg-[var(--color-surface)] md:flex">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-[var(--color-neutral-border)] px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-dark)] text-white shadow-[0_4px_10px_rgba(55,138,221,0.35)]">
          <FileText size={18} strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-bold leading-tight tracking-tight">EDMS</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-neutral-medium)]">
            Document Governance
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <div className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-neutral-soft)]">
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
                      `group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                        isActive
                          ? 'bg-[var(--color-brand-primary-soft)] font-semibold text-[var(--color-brand-primary-dark)]'
                          : item.roadmap
                            ? 'text-[var(--color-neutral-soft)] hover:bg-[var(--color-neutral-bg-soft)] hover:text-[var(--color-neutral-medium)]'
                            : 'text-[var(--color-neutral-dark)] hover:bg-[var(--color-neutral-bg-soft)]'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-[var(--color-brand-primary)]" />
                        )}
                        <Icon
                          size={15}
                          strokeWidth={isActive ? 2.25 : 1.75}
                          className={
                            isActive
                              ? 'text-[var(--color-brand-primary)]'
                              : item.roadmap
                                ? 'text-[var(--color-neutral-soft)]'
                                : 'text-[var(--color-neutral-medium)] group-hover:text-[var(--color-neutral-dark)]'
                          }
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.roadmap && (
                          <span className="rounded bg-[var(--color-chip-bg)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--color-chip-text)]">
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
      <div className="border-t border-[var(--color-neutral-border)] p-3">
        <a
          href="https://github.com/DrOsmond-STU/EDMS-Document-Management-System"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-[var(--color-neutral-medium)] transition-colors hover:bg-[var(--color-neutral-bg-soft)] hover:text-[var(--color-brand-primary)]"
        >
          <LifeBuoy size={13} strokeWidth={1.75} />
          <span>Dokumentasi & Bantuan</span>
        </a>
      </div>
    </aside>
  )
}
