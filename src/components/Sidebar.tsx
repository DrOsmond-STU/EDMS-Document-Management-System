import { NavLink } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { NAV_GROUPS } from './navConfig'

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-neutral-border)] bg-white md:flex">
      <div className="flex items-center gap-2 border-b border-[var(--color-neutral-border)] px-5 py-4">
        <FileText size={22} className="text-[var(--color-brand-primary)]" />
        <div>
          <div className="text-sm font-bold leading-tight">EDMS</div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
            Document Governance
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <div className="mb-1.5 px-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                      isActive
                        ? 'bg-[var(--color-brand-primary)]/10 font-semibold text-[var(--color-brand-primary)]'
                        : item.roadmap
                          ? 'text-[var(--color-neutral-medium)] hover:bg-[var(--color-neutral-bg)]'
                          : 'text-[var(--color-neutral-dark)] hover:bg-[var(--color-neutral-bg)]'
                    }`
                  }
                >
                  <span>{item.label}</span>
                  {item.roadmap && (
                    <span className="rounded bg-[var(--color-chip-bg)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--color-chip-text)]">
                      Roadmap
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
