import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { PageHeader, Card, Button, Field, inputClass } from '../components/ui'
import { rolesHavePermission } from '../state/permissions'

export function MasterData() {
  const { state, currentUser, addFunction, addStandard } = useApp()
  const canManage = rolesHavePermission(currentUser.roles, 'masterdata.manage')

  const [deptName, setDeptName] = useState('')
  const [stdCode, setStdCode] = useState('')
  const [stdName, setStdName] = useState('')

  function handleAddDept(e: React.FormEvent) {
    e.preventDefault()
    if (!deptName.trim()) return
    addFunction({ id: deptName.trim().toLowerCase().replace(/\s+/g, '-'), name: deptName.trim() })
    setDeptName('')
  }

  function handleAddStandard(e: React.FormEvent) {
    e.preventDefault()
    if (!stdCode.trim() || !stdName.trim()) return
    addStandard({ code: stdCode.trim().toUpperCase(), name: stdName.trim() })
    setStdCode('')
    setStdName('')
  }

  return (
    <div>
      <PageHeader title="Master Data" subtitle="Fungsi/departemen dan daftar standar yang berlaku di seluruh organisasi" />

      {!canManage && (
        <p className="mb-4 rounded-md bg-[var(--color-brand-warning)]/10 px-3 py-2 text-xs text-[#8a5a10]">
          Peran aktif Anda tidak berwenang mengelola Master Data (khusus System Administrator). Anda dapat melihat daftar di bawah ini.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-bold">Fungsi / Departemen</h2>
          <div className="mb-4 flex flex-col divide-y divide-[var(--color-neutral-border)]">
            {state.functions.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-2 text-xs">
                <span className="font-medium">{f.name}</span>
                <span className="font-mono text-[10px] text-[var(--color-neutral-medium)]">{f.id}</span>
              </div>
            ))}
          </div>
          {canManage && (
            <form onSubmit={handleAddDept} className="flex gap-2">
              <input className={inputClass} placeholder="Nama fungsi/departemen baru" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
              <Button type="submit" variant="primary"><Plus size={14} /></Button>
            </form>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-bold">Daftar Standar</h2>
          <div className="mb-4 flex flex-col divide-y divide-[var(--color-neutral-border)]">
            {state.standards.map((s) => (
              <div key={s.code} className="flex items-center justify-between py-2 text-xs">
                <span className="font-medium">{s.name}</span>
                <span className="font-mono text-[10px] text-[var(--color-neutral-medium)]">{s.code}</span>
              </div>
            ))}
          </div>
          {canManage && (
            <form onSubmit={handleAddStandard} className="grid grid-cols-[100px_1fr_auto] gap-2">
              <Field label="Kode">
                <input className={inputClass} placeholder="ISO..." value={stdCode} onChange={(e) => setStdCode(e.target.value)} />
              </Field>
              <Field label="Nama Standar">
                <input className={inputClass} placeholder="Nama standar" value={stdName} onChange={(e) => setStdName(e.target.value)} />
              </Field>
              <Button type="submit" variant="primary" className="self-end"><Plus size={14} /></Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
