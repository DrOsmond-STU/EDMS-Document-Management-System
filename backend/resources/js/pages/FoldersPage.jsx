import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, FolderTree, Pencil, Plus, Tag, Tags, Trash2, X } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api } from '../api'
import { Button, Card, Field, inputClass, Modal } from '../components/ui'

const STATUS_LABEL = {
  draft: 'Draft', review: 'Review', approval: 'Approval', released: 'Released',
  frozen: 'Dibekukan', revoked: 'Dicabut', obsolete: 'Obsolete',
}
const PALETTE = ['#2f5aa3', '#1d6e48', '#b9791c', '#b23b3a', '#6b4fa3', '#0f7c8a', '#5b6673']

function errorText(err, fallback) {
  if (err?.body?.errors) return Object.values(err.body.errors).flat().join(' ')
  return err?.body?.message || err?.message || fallback
}

function CategoryChip({ category, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ backgroundColor: category.color }}>
      {category.name}
      {onRemove && <button type="button" onClick={onRemove} className="opacity-80 hover:opacity-100"><X size={10} /></button>}
    </span>
  )
}

function FolderNode({ folder, childrenOf, depth, selected, onSelect, expanded, toggle }) {
  const kids = childrenOf[folder.id] ?? []
  const isOpen = expanded.has(folder.id)
  const active = selected?.kind === 'folder' && selected.id === folder.id
  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1 rounded-md py-1 pr-2 text-[12.5px] ${active ? 'bg-[var(--color-brand-primary)] text-white' : 'hover:bg-[var(--color-neutral-bg-soft)]'}`}
        style={{ paddingLeft: 4 + depth * 14 }}
        onClick={() => onSelect({ kind: 'folder', id: folder.id })}
      >
        <button type="button" className="flex h-4 w-4 items-center justify-center" onClick={(e) => { e.stopPropagation(); toggle(folder.id) }}>
          {kids.length > 0 ? (isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
        </button>
        {active || isOpen ? <FolderOpen size={14} className="shrink-0" /> : <Folder size={14} className="shrink-0" />}
        <span className="flex-1 truncate">{folder.name}</span>
        <span className={`text-[10.5px] tabular-nums ${active ? 'text-white/80' : 'text-[var(--color-neutral-medium)]'}`}>{folder.documents_count}</span>
      </div>
      {isOpen && kids.map((k) => (
        <FolderNode key={k.id} folder={k} childrenOf={childrenOf} depth={depth + 1} selected={selected} onSelect={onSelect} expanded={expanded} toggle={toggle} />
      ))}
    </div>
  )
}

function FolderModal({ state, folders, onClose, onSaved }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!state) return
    setForm(state.folder
      ? { name: state.folder.name, description: state.folder.description ?? '', parent_id: state.folder.parent_id ?? '' }
      : { name: '', description: '', parent_id: state.parentId ?? '' })
    setError('')
  }, [state])
  if (!state || !form) return null
  const editing = Boolean(state.folder)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const body = { ...form, parent_id: form.parent_id ? Number(form.parent_id) : null }
    try {
      onSaved(editing ? await api(`folders/${state.folder.id}`, { method: 'PATCH', body }) : await api('folders', { method: 'POST', body }))
    } catch (err) {
      setError(errorText(err, 'Gagal menyimpan folder.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={editing ? 'Ubah Folder' : 'Folder Baru'}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nama Folder"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus /></Field>
        <Field label="Di dalam" hint="Kosongkan untuk folder tingkat teratas">
          <select className={inputClass} value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
            <option value="">— Tingkat teratas —</option>
            {folders.filter((f) => f.id !== state.folder?.id).map((f) => <option key={f.id} value={f.id}>{f.path}</option>)}
          </select>
        </Field>
        <Field label="Keterangan" hint="Opsional"><input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function CategoryModal({ state, onClose, onSaved }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!state) return
    setForm(state.category ? { name: state.category.name, color: state.category.color } : { name: '', color: PALETTE[0] })
    setError('')
  }, [state])
  if (!state || !form) return null
  const editing = Boolean(state.category)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      onSaved(editing
        ? await api(`document-categories/${state.category.id}`, { method: 'PATCH', body: form })
        : await api('document-categories', { method: 'POST', body: form }))
    } catch (err) {
      setError(errorText(err, 'Gagal menyimpan kategori.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={editing ? 'Ubah Kategori' : 'Kategori Baru'}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nama Kategori"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Wajib Dibaca Karyawan Baru" required autoFocus /></Field>
        <Field label="Warna">
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                className={`h-7 w-7 rounded-full border-2 ${form.color === c ? 'border-[var(--color-neutral-dark)]' : 'border-transparent'}`} style={{ backgroundColor: c }} aria-label={c} />
            ))}
          </div>
        </Field>
        <div><CategoryChip category={{ name: form.name || 'Pratinjau', color: form.color }} /></div>
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function AddDocumentsModal({ folder, existingIds, onClose, onAdded }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [picked, setPicked] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ per_page: '30' })
      if (q.trim()) qs.set('q', q.trim())
      api(`documents?${qs.toString()}`).then((r) => setResults(r.data ?? [])).catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  function toggle(id) {
    setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function submit() {
    setBusy(true); setError('')
    try {
      await api(`folders/${folder.id}/documents`, { method: 'POST', body: { document_ids: [...picked] } })
      onAdded()
    } catch (err) {
      setError(errorText(err, 'Gagal menambahkan dokumen.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Tambah Dokumen ke "${folder.name}"`}>
      <div className="flex flex-col gap-3">
        <input className={inputClass} placeholder="Cari kode atau judul dokumen…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="max-h-[50vh] overflow-y-auto rounded-md border border-[var(--color-neutral-border)]">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-[var(--color-neutral-medium)]">Tidak ada dokumen.</p>
          ) : results.map((d) => {
            const already = existingIds.has(d.id)
            return (
              <label key={d.id} className={`flex cursor-pointer items-center gap-2 border-b border-[var(--color-neutral-border)] px-3 py-2 text-[12.5px] last:border-0 ${already ? 'opacity-50' : 'hover:bg-[var(--color-neutral-bg-soft)]'}`}>
                <input type="checkbox" disabled={already} checked={already || picked.has(d.id)} onChange={() => toggle(d.id)} />
                <span className="font-mono text-[11px] text-[var(--color-neutral-medium)]">{d.code}</span>
                <span className="flex-1 truncate">{d.title}</span>
                <span className="text-[10.5px] text-[var(--color-neutral-medium)]">{already ? 'sudah ada' : STATUS_LABEL[d.status] ?? d.status}</span>
              </label>
            )
          })}
        </div>
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[var(--color-neutral-medium)]">{picked.size} dipilih</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Batal</Button>
            <Button variant="primary" disabled={busy || picked.size === 0} onClick={submit}>{busy ? 'Menambahkan…' : 'Tambahkan'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function DocCategoriesModal({ doc, categories, onClose, onSaved }) {
  const [selected, setSelected] = useState(new Set((doc?.categories ?? []).map((c) => c.id)))
  const [busy, setBusy] = useState(false)
  if (!doc) return null
  async function save() {
    setBusy(true)
    try {
      await api(`documents/${doc.id}/categories`, { method: 'PUT', body: { category_ids: [...selected] } })
      onSaved()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open onClose={onClose} title={`Kategori — ${doc.code}`}>
      <div className="flex flex-col gap-3">
        {categories.length === 0 ? <p className="text-[12.5px] text-[var(--color-neutral-medium)]">Belum ada kategori.</p> : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = selected.has(c.id)
              return (
                <button type="button" key={c.id} onClick={() => setSelected((s) => { const n = new Set(s); on ? n.delete(c.id) : n.add(c.id); return n })}
                  className="rounded-full border-2 px-2.5 py-1 text-[11.5px] font-bold transition-colors"
                  style={on ? { backgroundColor: c.color, borderColor: c.color, color: '#fff' } : { borderColor: c.color, color: c.color }}>
                  {c.name}
                </button>
              )
            })}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button variant="primary" disabled={busy} onClick={save}>Simpan</Button>
        </div>
      </div>
    </Modal>
  )
}

export default function FoldersPage() {
  const [folders, setFolders] = useState(null)
  const [categories, setCategories] = useState([])
  const [canManage, setCanManage] = useState(false)
  const [selected, setSelected] = useState(null)
  const [expanded, setExpanded] = useState(new Set())
  const [docs, setDocs] = useState(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [folderModal, setFolderModal] = useState(null)
  const [categoryModal, setCategoryModal] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [catDoc, setCatDoc] = useState(null)

  const loadTree = useCallback(() => {
    api('folders')
      .then((r) => { setFolders(r.folders); setCategories(r.categories); setCanManage(r.can_manage) })
      .catch((err) => setError(errorText(err, 'Gagal memuat folder.')))
  }, [])

  const loadDocs = useCallback(() => {
    if (!selected) { setDocs(null); return }
    const base = selected.kind === 'folder' ? `folders/${selected.id}/documents` : `document-categories/${selected.id}/documents`
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
    api(base + qs).then((r) => setDocs(r.documents)).catch((err) => setError(errorText(err, 'Gagal memuat dokumen.')))
  }, [selected, q])

  useEffect(() => { loadTree() }, [loadTree])
  useEffect(() => { const t = setTimeout(loadDocs, q ? 250 : 0); return () => clearTimeout(t) }, [loadDocs, q])

  const childrenOf = useMemo(() => {
    const map = {}
    ;(folders ?? []).forEach((f) => { const k = f.parent_id ?? 'root'; (map[k] ??= []).push(f) })
    return map
  }, [folders])

  const foldersWithPath = useMemo(() => {
    const byId = Object.fromEntries((folders ?? []).map((f) => [f.id, f]))
    const path = (f) => (f.parent_id && byId[f.parent_id] ? `${path(byId[f.parent_id])} / ${f.name}` : f.name)
    return (folders ?? []).map((f) => ({ ...f, path: path(f) })).sort((a, b) => a.path.localeCompare(b.path))
  }, [folders])

  const current = selected?.kind === 'folder'
    ? foldersWithPath.find((f) => f.id === selected.id)
    : categories.find((c) => c.id === selected?.id)

  function toggle(id) {
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function removeFromFolder(doc) {
    try {
      await api(`folders/${selected.id}/documents/${doc.id}`, { method: 'DELETE' })
      loadDocs(); loadTree()
    } catch (err) {
      setError(errorText(err, 'Gagal mengeluarkan dokumen.'))
    }
  }

  async function deleteCurrent() {
    const isFolder = selected.kind === 'folder'
    if (!window.confirm(`Hapus ${isFolder ? 'folder' : 'kategori'} "${current.name}"? Dokumen di dalamnya TIDAK ikut terhapus.`)) return
    try {
      await api(isFolder ? `folders/${current.id}` : `document-categories/${current.id}`, { method: 'DELETE' })
      setSelected(null); loadTree()
    } catch (err) {
      setError(errorText(err, 'Gagal menghapus.'))
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Document Repository</div>
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]"><FolderTree size={18} /> Folder Virtual & Kategori</h1>
        <p className="mt-0.5 max-w-2xl text-[12.5px] text-[var(--color-neutral-medium)]">
          Kelompokkan dokumen sesuai kebutuhan kerja tanpa mengubah nomor atau lokasi resminya. Satu dokumen boleh berada di beberapa folder; menghapus folder tidak menghapus dokumen.
        </p>
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error} <button className="ml-2 underline" onClick={() => setError('')}>tutup</button></div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Card className="!p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Folder</span>
              {canManage && <button type="button" title="Folder baru" className="text-[var(--color-brand-primary)]" onClick={() => setFolderModal({ parentId: null })}><FolderPlus size={15} /></button>}
            </div>
            {!folders ? <p className="px-1 text-[12px] text-[var(--color-neutral-medium)]">Memuat…</p>
              : (childrenOf.root ?? []).length === 0 ? <p className="px-1 py-2 text-[12px] text-[var(--color-neutral-medium)]">Belum ada folder.</p>
              : (childrenOf.root ?? []).map((f) => (
                <FolderNode key={f.id} folder={f} childrenOf={childrenOf} depth={0} selected={selected} onSelect={(s) => { setSelected(s); setQ('') }} expanded={expanded} toggle={toggle} />
              ))}
          </Card>
          <Card className="!p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Kategori</span>
              {canManage && <button type="button" title="Kategori baru" className="text-[var(--color-brand-primary)]" onClick={() => setCategoryModal({})}><Plus size={15} /></button>}
            </div>
            {categories.length === 0 ? <p className="px-1 py-2 text-[12px] text-[var(--color-neutral-medium)]">Belum ada kategori.</p> : categories.map((c) => {
              const active = selected?.kind === 'category' && selected.id === c.id
              return (
                <div key={c.id} onClick={() => { setSelected({ kind: 'category', id: c.id }); setQ('') }}
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[12.5px] ${active ? 'bg-[var(--color-neutral-bg)] font-semibold' : 'hover:bg-[var(--color-neutral-bg-soft)]'}`}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[10.5px] tabular-nums text-[var(--color-neutral-medium)]">{c.documents_count}</span>
                </div>
              )
            })}
          </Card>
        </div>

        <Card>
          {!current ? (
            <div className="flex flex-col items-center gap-2 py-20 text-center">
              <FolderTree size={30} className="text-[var(--color-neutral-soft)]" />
              <p className="text-[13px] text-[var(--color-neutral-medium)]">Pilih folder atau kategori di sebelah kiri untuk melihat dokumennya.</p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-[15px] font-bold text-[var(--color-neutral-dark)]">
                    {selected.kind === 'folder' ? <FolderOpen size={16} /> : <Tag size={16} style={{ color: current.color }} />}
                    {selected.kind === 'folder' ? current.path : current.name}
                  </div>
                  {current.description && <p className="mt-0.5 text-[12px] text-[var(--color-neutral-medium)]">{current.description}</p>}
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.kind === 'folder' && <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}><Plus size={13} /> Tambah Dokumen</Button>}
                    {selected.kind === 'folder' && <Button size="sm" variant="secondary" onClick={() => setFolderModal({ parentId: current.id })}><FolderPlus size={13} /> Subfolder</Button>}
                    <Button size="sm" variant="secondary" onClick={() => (selected.kind === 'folder' ? setFolderModal({ folder: current }) : setCategoryModal({ category: current }))}><Pencil size={13} /> Ubah</Button>
                    <Button size="sm" variant="ghost" onClick={deleteCurrent}><Trash2 size={13} /></Button>
                  </div>
                )}
              </div>
              <input className={`${inputClass} mb-3`} placeholder="Cari di dalam…" value={q} onChange={(e) => setQ(e.target.value)} />
              {!docs ? <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p> : docs.length === 0 ? (
                <p className="py-10 text-center text-[12.5px] text-[var(--color-neutral-medium)]">Belum ada dokumen di sini.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-[12.5px]">
                    <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                      <tr className="border-b border-[var(--color-neutral-border)]">
                        <th className="py-2 pr-3 font-bold">Kode</th>
                        <th className="py-2 pr-3 font-bold">Judul</th>
                        <th className="py-2 pr-3 font-bold">Fungsi</th>
                        <th className="py-2 pr-3 font-bold">Status</th>
                        <th className="py-2 pr-3 font-bold">Kategori</th>
                        <th className="py-2 pr-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map((doc) => (
                        <tr key={doc.id} className="border-b border-[var(--color-neutral-border)] align-top">
                          <td className="py-2 pr-3 font-mono text-[11.5px]"><Link to={`/documents/${doc.id}`} className="text-[var(--color-brand-primary)] hover:underline">{doc.code}</Link></td>
                          <td className="py-2 pr-3 font-semibold text-[var(--color-neutral-dark)]">{doc.title}</td>
                          <td className="py-2 pr-3 text-[12px]">{doc.org_function?.name ?? '—'}</td>
                          <td className="py-2 pr-3 text-[12px]">{STATUS_LABEL[doc.status] ?? doc.status} <span className="text-[var(--color-neutral-medium)]">v{doc.version}</span></td>
                          <td className="py-2 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {doc.categories?.map((c) => <CategoryChip key={c.id} category={c} />)}
                              {canManage && <button type="button" onClick={() => setCatDoc(doc)} className="text-[var(--color-neutral-medium)] hover:text-[var(--color-brand-primary)]" title="Atur kategori"><Tags size={13} /></button>}
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {canManage && selected.kind === 'folder' && (
                              <button type="button" onClick={() => removeFromFolder(doc)} className="text-[11px] text-[var(--color-neutral-medium)] hover:text-[#b23b3a]" title="Keluarkan dari folder (dokumen tidak dihapus)">Keluarkan</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <FolderModal state={folderModal} folders={foldersWithPath} onClose={() => setFolderModal(null)}
        onSaved={(f) => { setFolderModal(null); if (f.parent_id) setExpanded((s) => new Set(s).add(f.parent_id)); loadTree() }} />
      <CategoryModal state={categoryModal} onClose={() => setCategoryModal(null)} onSaved={() => { setCategoryModal(null); loadTree(); loadDocs() }} />
      {addOpen && current && selected.kind === 'folder' && (
        <AddDocumentsModal folder={current} existingIds={new Set((docs ?? []).map((d) => d.id))} onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); loadDocs(); loadTree() }} />
      )}
      {catDoc && <DocCategoriesModal doc={catDoc} categories={categories} onClose={() => setCatDoc(null)} onSaved={() => { setCatDoc(null); loadDocs(); loadTree() }} />}
    </Layout>
  )
}
