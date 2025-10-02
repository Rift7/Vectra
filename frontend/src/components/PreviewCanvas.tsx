import React, { useEffect, useRef, useState } from 'react'

export type PreviewCanvasProps = {
  svgUrl: string | null
}

// Simple canvas renderer that rasterizes the SVG image and supports pan/zoom.
// For MVP we draw the full SVG. Future: stroke-level animation using parsed paths.
export function PreviewCanvas({ svgUrl }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const draggingRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    let active = true
    if (!svgUrl) {
      setImg(null)
      return
    }
    const image = new Image()
    // proxy makes /media same-origin in dev, so no crossOrigin needed
    image.onload = () => {
      if (!active) return
      setImg(image)
      // Fit to canvas on load
      const c = canvasRef.current
      if (c) {
        const sx = c.width / image.width
        const sy = c.height / image.height
        const s = Math.min(sx, sy) * 0.95
        setScale(isFinite(s) && s > 0 ? s : 1)
        setOffset({ x: (c.width - image.width * s) / 2, y: (c.height - image.height * s) / 2 })
      }
    }
    image.onerror = () => {
      if (!active) return
      setImg(null)
    }
    image.src = svgUrl
    return () => {
      active = false
    }
  }, [svgUrl])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    // HiDPI handling
    const dpr = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = Math.floor(rect.width * dpr)
    c.height = Math.floor(rect.height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const render = () => {
      ctx.clearRect(0, 0, rect.width, rect.height)
      if (img) {
        ctx.save()
        ctx.translate(offset.x, offset.y)
        ctx.scale(scale, scale)
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(img, 0, 0)
        ctx.restore()
      } else {
        ctx.fillStyle = '#333'
        ctx.fillRect(0, 0, rect.width, rect.height)
      }
      // Overlay grid (optional)
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      for (let x = 0; x < rect.width; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, rect.height); ctx.stroke()
      }
      for (let y = 0; y < rect.height; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(rect.width, y); ctx.stroke()
      }
      ctx.restore()
    }

    render()
  }, [img, scale, offset])

  // Pan/zoom handlers
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = c.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const delta = -Math.sign(e.deltaY) * 0.1
      const next = Math.min(10, Math.max(0.1, scale * (1 + delta)))
      // Zoom around cursor
      const k = next / scale
      setOffset({ x: mx - (mx - offset.x) * k, y: my - (my - offset.y) * k })
      setScale(next)
    }

    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      draggingRef.current = { x: e.clientX, y: e.clientY }
      c.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return
      const dx = e.clientX - draggingRef.current.x
      const dy = e.clientY - draggingRef.current.y
      draggingRef.current = { x: e.clientX, y: e.clientY }
      setOffset((o) => ({ x: o.x + dx, y: o.y + dy }))
    }
    const onUp = (e: PointerEvent) => {
      draggingRef.current = null
      c.releasePointerCapture(e.pointerId)
    }

    c.addEventListener('wheel', onWheel, { passive: false })
    c.addEventListener('pointerdown', onDown)
    c.addEventListener('pointermove', onMove)
    c.addEventListener('pointerup', onUp)
    c.addEventListener('pointercancel', onUp)
    return () => {
      c.removeEventListener('wheel', onWheel)
      c.removeEventListener('pointerdown', onDown)
      c.removeEventListener('pointermove', onMove)
      c.removeEventListener('pointerup', onUp)
      c.removeEventListener('pointercancel', onUp)
    }
  }, [scale, offset])

  return (
    <div style={{ width: '100%', height: 500, border: '1px solid #444', borderRadius: 6 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', background: '#1a1a1a' }} />
    </div>
  )
}
