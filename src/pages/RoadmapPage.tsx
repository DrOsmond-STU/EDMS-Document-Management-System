import { useLocation } from 'react-router-dom'
import { Map } from 'lucide-react'
import { PageHeader, Card } from '../components/ui'
import { NAV_GROUPS } from '../components/navConfig'

export function RoadmapPage() {
  const { pathname } = useLocation()
  const item = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.path === pathname)

  return (
    <div>
      <PageHeader title={item?.label ?? 'Roadmap'} subtitle="Modul roadmap — belum diimplementasikan di prototipe ini" />
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Map size={28} className="text-[var(--color-brand-primary)]" />
        <p className="max-w-md text-sm text-[var(--color-neutral-medium)]">
          Modul ini termasuk dalam arsitektur target 10 domain / 30 modul, tetapi belum dibangun di prototipe.
          Lihat status dan fase implementasinya di <code className="rounded bg-[var(--color-neutral-bg)] px-1.5 py-0.5">docs/01_PRD.md</code>{' '}
          Bagian 4 dan 11.
        </p>
      </Card>
    </div>
  )
}
