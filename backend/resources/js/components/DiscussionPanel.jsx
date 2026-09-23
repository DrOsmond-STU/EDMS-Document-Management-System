import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, CornerDownRight, MessagesSquare, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../AuthContext'
import { Button, Card, inputClass } from './ui'

function errorText(err, fallback) {
  if (err?.body?.errors) return Object.values(err.body.errors).flat().join(' ')
  return err?.body?.message || err?.message || fallback
}

const when = (v) => new Date(v).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

/** Tebalkan @Nama yang memang disebut (ada di daftar mentions). Teks dirender sebagai teks, bukan HTML. */
function Body({ text, mentions }) {
  if (!mentions?.length) return <span className="whitespace-pre-line">{text}</span>
  const names = mentions.map((m) => m.name).sort((a, b) => b.length - a.length)
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(@(?:${escaped.join('|')}))`, 'g'))
  return (
    <span className="whitespace-pre-line">
      {parts.map((p, i) => (p.startsWith('@') && names.includes(p.slice(1))
        ? <span key={i} className="rounded bg-[var(--color-brand-primary-soft)] px-1 font-semibold text-[var(--color-brand-primary)]">{p}</span>
        : <span key={i}>{p}</span>))}
    </span>
  )
}

/** Textarea dengan saran @mention: ketik "@" + beberapa huruf untuk memilih pengguna. */
function Composer({ users, placeholder, onSubmit, withSection, compact }) {
  const [text, setText] = useState('')
  const [section, setSection] = useState('')
  const [mentions, setMentions] = useState([])
  const [query, setQuery] = useState(null)
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  function onChange(e) {
    const value = e.target.value
    setText(value)
    const upto = value.slice(0, e.target.selectionStart)
    const m = upto.match(/@([\p{L}\p{N} ]{0,30})$/u)
    setQuery(m ? m[1].toLowerCase() : null)
  }

  function pick(user) {
    const pos = ref.current.selectionStart
    const before = text.slice(0, pos).replace(/@([\p{L}\p{N} ]{0,30})$/u, `@${user.name} `)
    setText(before + text.slice(pos))
    setMentions((ms) => (ms.some((m) => m.id === user.id) ? ms : [...ms, user]))
    setQuery(null)
    ref.current.focus()
  }

  const suggestions = query === null ? [] : users.filter((u) => u.name.toLowerCase().includes(query.trim())).slice(0, 6)

  async function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    const used = mentions.filter((m) => text.includes(`@${m.name}`))
    const ok = await onSubmit({ body: text.trim(), section: section.trim() || null, mentions: used.map((m) => m.id) })
    setBusy(false)
    if (ok) { setText(''); setSection(''); setMentions([]) }
  }

  return (
    <form onSubmit={submit} className="relative">
      {withSection && (
        <input className={`${inputClass} mb-1.5`} placeholder="Bagian dokumen yang dibahas (opsional), mis. Bab 4.2 / Lampiran B" value={section} onChange={(e) => setSection(e.target.value)} />
      )}
      <textarea ref={ref} className={inputClass} rows={compact ? 2 : 3} placeholder={placeholder} value={text} onChange={onChange}
        onKeyDown={(e) => { if (e.key === 'Escape') setQuery(null) }} />
      {suggestions.length > 0 && (
        <div className="absolute left-2 z-20 mt-1 w-64 overflow-hidden rounded-md border border-[var(--color-neutral-border)] bg-white shadow-lg">
          {suggestions.map((u) => (
            <button type="button" key={u.id} onMouseDown={(e) => { e.preventDefault(); pick(u) }}
              className="block w-full px-3 py-1.5 text-left text-[12.5px] hover:bg-[var(--color-neutral-bg-soft)]">@{u.name}</button>
          ))}
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10.5px] text-[var(--color-neutral-medium)]">Ketik @ untuk menyebut pengguna — mereka akan mendapat notifikasi.</span>
        <Button type="submit" size="sm" variant="primary" disabled={busy || !text.trim()}>{busy ? 'Mengirim…' : 'Kirim'}</Button>
      </div>
    </form>
  )
}

function Comment({ c, me, canModerate, onChanged, setError, isReply }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(c.body ?? '')

  if (c.is_deleted) {
    return <div className="text-[12px] italic text-[var(--color-neutral-soft)]">Komentar telah dihapus.</div>
  }

  async function run(fn, fallback) {
    try { await fn(); onChanged() } catch (err) { setError(errorText(err, fallback)) }
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[12.5px] font-bold text-[var(--color-neutral-dark)]">{c.author?.name}</span>
        <span className="text-[10.5px] text-[var(--color-neutral-medium)]">{when(c.created_at)}{c.edited_at ? ' · disunting' : ''}</span>
        {!isReply && c.section && <span className="rounded bg-[var(--color-neutral-bg)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--color-neutral-dark)]">{c.section}</span>}
      </div>
      {editing ? (
        <div className="mt-1">
          <textarea className={inputClass} rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="mt-1 flex gap-1.5">
            <Button size="sm" variant="primary" onClick={() => run(async () => { await api(`comments/${c.id}`, { method: 'PATCH', body: { body: text } }); setEditing(false) }, 'Gagal menyunting.')}>Simpan</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Batal</Button>
          </div>
        </div>
      ) : (
        <div className="mt-0.5 text-[13px] leading-relaxed text-[var(--color-neutral-dark)]"><Body text={c.body} mentions={c.mentions} /></div>
      )}
      {!editing && (c.user_id === me || canModerate) && (
        <div className="mt-1 flex gap-3 text-[11px] text-[var(--color-neutral-medium)]">
          {c.user_id === me && <button type="button" className="inline-flex items-center gap-1 hover:text-[var(--color-brand-primary)]" onClick={() => setEditing(true)}><Pencil size={11} /> Sunting</button>}
          <button type="button" className="inline-flex items-center gap-1 hover:text-[#b23b3a]" onClick={() => { if (window.confirm('Hapus komentar ini?')) run(() => api(`comments/${c.id}`, { method: 'DELETE' }), 'Gagal menghapus.') }}><Trash2 size={11} /> Hapus</button>
        </div>
      )}
    </div>
  )
}

export function DiscussionPanel({ documentId }) {
  const { user } = useAuth()
  const [threads, setThreads] = useState(null)
  const [canModerate, setCanModerate] = useState(false)
  const [users, setUsers] = useState([])
  const [showResolved, setShowResolved] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api(`documents/${documentId}/comments`)
      .then((r) => { setThreads(r.threads); setCanModerate(r.can_moderate) })
      .catch((err) => setError(errorText(err, 'Gagal memuat diskusi.')))
  }, [documentId])

  useEffect(() => { load() }, [load])
  useEffect(() => { api('master-data').then((m) => setUsers((m.users ?? []).filter((u) => u.id !== user?.id))).catch(() => {}) }, [user?.id])
  useEffect(() => {
    if (threads && window.location.hash === '#diskusi') document.getElementById('diskusi')?.scrollIntoView({ behavior: 'smooth' })
  }, [threads])

  async function post(payload) {
    setError('')
    try {
      await api(`documents/${documentId}/comments`, { method: 'POST', body: payload })
      setReplyTo(null)
      load()
      return true
    } catch (err) {
      setError(errorText(err, 'Gagal mengirim komentar.'))
      return false
    }
  }

  async function toggleResolved(t) {
    try {
      await api(`comments/${t.id}/resolve`, { method: 'POST', body: { resolved: !t.resolved_at } })
      load()
    } catch (err) {
      setError(errorText(err, 'Gagal memperbarui status utas.'))
    }
  }

  const open = (threads ?? []).filter((t) => !t.resolved_at)
  const resolved = (threads ?? []).filter((t) => t.resolved_at)
  const visible = showResolved ? resolved : open

  return (
    <Card>
      <div id="diskusi" className="mb-3 flex flex-wrap items-center justify-between gap-2 scroll-mt-24">
        <h2 className="flex items-center gap-2 text-[13.5px] font-bold"><MessagesSquare size={15} /> Diskusi</h2>
        <div className="flex rounded-md border border-[var(--color-neutral-border)] p-0.5 text-[11.5px]">
          <button type="button" onClick={() => setShowResolved(false)} className={`rounded px-2 py-0.5 font-semibold ${!showResolved ? 'bg-[var(--color-brand-primary)] text-white' : 'text-[var(--color-neutral-medium)]'}`}>Terbuka ({open.length})</button>
          <button type="button" onClick={() => setShowResolved(true)} className={`rounded px-2 py-0.5 font-semibold ${showResolved ? 'bg-[var(--color-brand-primary)] text-white' : 'text-[var(--color-neutral-medium)]'}`}>Selesai ({resolved.length})</button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

      {!showResolved && <div className="mb-4"><Composer users={users} withSection placeholder="Mulai diskusi atau beri catatan tinjauan…" onSubmit={post} /></div>}

      {!threads ? <p className="text-[12.5px] text-[var(--color-neutral-medium)]">Memuat…</p> : visible.length === 0 ? (
        <p className="py-4 text-center text-[12.5px] text-[var(--color-neutral-medium)]">{showResolved ? 'Belum ada utas yang diselesaikan.' : 'Belum ada diskusi terbuka.'}</p>
      ) : (
        <div className="space-y-3">
          {visible.map((t) => (
            <div key={t.id} className={`rounded-lg border px-3.5 py-3 ${t.resolved_at ? 'border-[#bfe0cc] bg-[#f4faf6]' : 'border-[var(--color-neutral-border)]'}`}>
              <Comment c={t} me={user?.id} canModerate={canModerate} onChanged={load} setError={setError} />
              {t.replies?.length > 0 && (
                <div className="ml-3 mt-2.5 space-y-2.5 border-l-2 border-[var(--color-neutral-border)] pl-3">
                  {t.replies.map((r) => <Comment key={r.id} c={r} me={user?.id} canModerate={canModerate} onChanged={load} setError={setError} isReply />)}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px]">
                {!t.resolved_at && (
                  <button type="button" className="inline-flex items-center gap-1 font-semibold text-[var(--color-brand-primary)] hover:underline" onClick={() => setReplyTo(replyTo === t.id ? null : t.id)}>
                    <CornerDownRight size={12} /> Balas
                  </button>
                )}
                {!t.is_deleted && (t.user_id === user?.id || canModerate) && (
                  <button type="button" className="inline-flex items-center gap-1 font-semibold text-[#1d6e48] hover:underline" onClick={() => toggleResolved(t)}>
                    {t.resolved_at ? <><RotateCcw size={12} /> Buka kembali</> : <><CheckCircle2 size={12} /> Tandai selesai</>}
                  </button>
                )}
                {t.resolved_at && <span className="text-[var(--color-neutral-medium)]">Diselesaikan {t.resolver?.name ? `oleh ${t.resolver.name} ` : ''}{when(t.resolved_at)}</span>}
              </div>
              {replyTo === t.id && (
                <div className="ml-3 mt-2 border-l-2 border-[var(--color-brand-primary)] pl-3">
                  <Composer users={users} compact placeholder="Tulis balasan…" onSubmit={(p) => post({ ...p, parent_id: t.id })} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
