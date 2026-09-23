import { useEffect, useRef, useState } from 'react'
import { Button } from './ui'

/** Kanvas tanda tangan (mouse & sentuh). onSave menerima PNG data URL. */
export function SignaturePad({ onSave, onCancel, saving }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    const ratio = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#10243f'
  }, [])

  function point(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e) {
    e.preventDefault()
    canvasRef.current.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    const p = point(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function move(e) {
    if (!drawing.current) return
    const ctx = canvasRef.current.getContext('2d')
    const p = point(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setEmpty(false)
  }

  function end() {
    drawing.current = false
  }

  function clear() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setEmpty(true)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-40 w-full touch-none rounded-md border-2 border-dashed border-[var(--color-neutral-border)] bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={clear} className="text-[12px] text-[var(--color-neutral-medium)] hover:underline">Bersihkan</button>
        <div className="flex gap-2">
          {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Batal</Button>}
          <Button type="button" variant="primary" size="sm" disabled={empty || saving} onClick={() => onSave(canvasRef.current.toDataURL('image/png'))}>
            {saving ? 'Menyimpan…' : 'Simpan Tanda Tangan'}
          </Button>
        </div>
      </div>
    </div>
  )
}
