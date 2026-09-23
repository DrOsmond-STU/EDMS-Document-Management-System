import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Link2 } from 'lucide-react'
import { api } from '../api'
import { Card } from './ui'

/** Dokumen terkait — dihitung dari relasi, standar, kategori, fungsi, dan kata kunci yang sama. */
export function RelatedDocuments({ documentId }) {
  const [items, setItems] = useState(null)

  useEffect(() => {
    api(`documents/${documentId}/related`).then((r) => setItems(r.related)).catch(() => setItems([]))
  }, [documentId])

  if (!items || items.length === 0) return null

  return (
    <Card>
      <h2 className="mb-2 flex items-center gap-2 text-[13.5px] font-bold"><Link2 size={15} /> Dokumen Terkait</h2>
      <ul className="divide-y divide-[var(--color-neutral-border)]">
        {items.map((d) => (
          <li key={d.id}>
            <Link to={`/documents/${d.id}`} className="block py-2 hover:bg-[var(--color-neutral-bg-soft)]">
              <div className="text-[12.5px]"><span className="font-mono text-[11px] text-[var(--color-brand-primary)]">{d.code}</span> <span className="font-semibold">{d.title}</span></div>
              <div className="text-[10.5px] text-[var(--color-neutral-medium)]">Karena: {d.reasons.join(' · ')}</div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
