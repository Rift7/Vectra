import React, { useCallback, useEffect, useRef, useState } from 'react'

export type StrokePlayerProps = {
  svgUrl: string | null
  height?: number
}

type StrokeItem = {
  el: SVGPathElement | SVGPolylineElement | SVGLineElement
  length: number
}

export function StrokePlayer({ svgUrl, height = 500 }: StrokePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null)
  const [strokes, setStrokes] = useState<StrokeItem[]>([])
  const [totalLength, setTotalLength] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0..1
  const [speed, setSpeed] = useState(1)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)

  // Fetch and mount SVG
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setPlaying(false)
      setProgress(0)
      setStrokes([])
      setTotalLength(0)
      setSvgEl(null)

      if (!svgUrl) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(svgUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const text = await res.text()
        if (cancelled) return
        const parser = new DOMParser()
        const doc = parser.parseFromString(text, 'image/svg+xml')
        const svg = doc.documentElement as unknown as SVGSVGElement
        svg.setAttribute('vector-effect', 'non-scaling-stroke')
        svg.style.background = '#ffffff'
        // Insert into DOM so getTotalLength works
        const host = containerRef.current
        if (!host) return
        host.innerHTML = ''
        host.appendChild(svg)
        setSvgEl(svg)

        const nodes: StrokeItem[] = []
        const pathNodes = svg.querySelectorAll('path')
        pathNodes.forEach((p) => {
          try {
            const len = (p as SVGPathElement).getTotalLength()
            p.setAttribute('fill', 'none')
            p.setAttribute('stroke', p.getAttribute('stroke') || '#000')
            p.setAttribute('stroke-width', p.getAttribute('stroke-width') || '1')
            p.style.strokeDasharray = `${len}`
            p.style.strokeDashoffset = `${len}`
            nodes.push({ el: p as SVGPathElement, length: len })
          } catch {}
        })
        const polyNodes = svg.querySelectorAll('polyline')
        polyNodes.forEach((pl) => {
          const len = polylineLength(pl as SVGPolylineElement)
          pl.setAttribute('fill', 'none')
          pl.setAttribute('stroke', pl.getAttribute('stroke') || '#000')
          pl.setAttribute('stroke-width', pl.getAttribute('stroke-width') || '1')
          ;(pl as SVGPolylineElement).style.strokeDasharray = `${len}`
          ;(pl as SVGPolylineElement).style.strokeDashoffset = `${len}`
          nodes.push({ el: pl as SVGPolylineElement, length: len })
        })
        const lineNodes = svg.querySelectorAll('line')
        lineNodes.forEach((ln) => {
          const len = lineLength(ln as SVGLineElement)
          ln.setAttribute('stroke', ln.getAttribute('stroke') || '#000')
          ln.setAttribute('stroke-width', ln.getAttribute('stroke-width') || '1')
          ;(ln as SVGLineElement).style.strokeDasharray = `${len}`
          ;(ln as SVGLineElement).style.strokeDashoffset = `${len}`
          nodes.push({ el: ln as SVGLineElement, length: len })
        })

        const sum = nodes.reduce((a, b) => a + b.length, 0)
        setStrokes(nodes)
        setTotalLength(sum)
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load SVG')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [svgUrl])

  // Animate
  const tick = useCallback((ts: number) => {
    if (!playing) return
    const last = lastTsRef.current ?? ts
    const dt = (ts - last) / 1000 // seconds
    lastTsRef.current = ts

    const rate = 0.2 * speed // fraction per second (tune)
    const next = Math.min(1, progress + rate * dt)
    setProgress(next)

    if (next < 1) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      setPlaying(false)
      lastTsRef.current = null
    }
  }, [playing, progress, speed])

  useEffect(() => {
    // Update stroke dashoffsets according to progress
    let remaining = totalLength * progress
    for (const s of strokes) {
      const drawn = Math.max(0, Math.min(s.length, remaining))
      const offset = s.length - drawn
      ;(s.el as any).style.strokeDashoffset = `${offset}`
      remaining -= drawn
    }
  }, [progress, strokes, totalLength])

  const onPlay = () => {
    if (!svgEl || strokes.length === 0) return
    setPlaying(true)
    lastTsRef.current = null
    rafRef.current = requestAnimationFrame(tick)
  }
  const onPause = () => {
    setPlaying(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }
  const onReset = () => {
    setPlaying(false)
    setProgress(0)
    lastTsRef.current = null
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <button onClick={playing ? onPause : onPlay} disabled={!svgEl || strokes.length === 0}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button onClick={onReset} disabled={!svgEl}>Reset</button>
        <label>
          Speed
          <select value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </label>
        <div>Total length: {Math.round(totalLength)}</div>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={progress}
        onChange={(e) => setProgress(parseFloat(e.target.value))}
        style={{ width: '100%', marginBottom: 8 }}
      />
      {loading && <div>Loading SVG...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <div ref={containerRef} style={{ width: '100%', height, border: '1px solid #444', borderRadius: 6, background: '#fafafa' }} />
    </div>
  )
}

function polylineLength(pl: SVGPolylineElement): number {
  const pts = (pl.getAttribute('points') || '').trim().split(/\s+/)
  let prev: [number, number] | null = null
  let total = 0
  for (const p of pts) {
    const [xStr, yStr] = p.split(',')
    const x = parseFloat(xStr)
    const y = parseFloat(yStr)
    if (!isFinite(x) || !isFinite(y)) continue
    if (prev) total += Math.hypot(x - prev[0], y - prev[1])
    prev = [x, y]
  }
  return total
}

function lineLength(ln: SVGLineElement): number {
  const x1 = parseFloat(ln.getAttribute('x1') || '0')
  const y1 = parseFloat(ln.getAttribute('y1') || '0')
  const x2 = parseFloat(ln.getAttribute('x2') || '0')
  const y2 = parseFloat(ln.getAttribute('y2') || '0')
  return Math.hypot(x2 - x1, y2 - y1)
}
