import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type StrokePlayerProps = {
  svgUrl: string | null
  height?: number
}

type StrokeItem = {
  el: SVGPathElement | SVGPolylineElement | SVGLineElement
  length: number
  layer: number
  color: string
}

type GroupInfo = { visible: boolean; color: string; length: number; count: number }

const LAYER_PALETTE = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
]

export function StrokePlayer({ svgUrl, height = 500 }: StrokePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null)
  const [strokes, setStrokes] = useState<StrokeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0..1
  const [speed, setSpeed] = useState(1)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)

  // Highlight/grouping state
  const [mode, setMode] = useState<'layer' | 'tool'>('layer')
  const [layers, setLayers] = useState<Record<string, GroupInfo>>({})
  const [tools, setTools] = useState<Record<string, GroupInfo>>({})

  // Derived totals based on visibility and mode
  const totalDrawLength = useMemo(() => {
    if (mode === 'layer') {
      const vis = new Set(Object.entries(layers).filter(([, v]) => v.visible).map(([k]) => k))
      return strokes.filter((s) => vis.has(String(s.layer))).reduce((a, b) => a + b.length, 0)
    } else {
      const vis = new Set(Object.entries(tools).filter(([, v]) => v.visible).map(([k]) => k))
      return strokes.filter((s) => vis.has(s.color)).reduce((a, b) => a + b.length, 0)
    }
  }, [mode, layers, tools, strokes])

  // Fetch and mount SVG
  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      setPlaying(false)
      setProgress(0)
      setStrokes([])
      setLayers({})
      setTools({})
      setSvgEl(null)
      if (!svgUrl) return
      setLoading(true)
      try {
        const res = await fetch(svgUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const text = await res.text()
        if (cancelled) return
        const parser = new DOMParser()
        const doc = parser.parseFromString(text, 'image/svg+xml')
        const svg = doc.documentElement as unknown as SVGSVGElement
        svg.style.background = '#ffffff'
        const host = containerRef.current
        if (!host) return
        host.innerHTML = ''
        host.appendChild(svg)
        setSvgEl(svg)

        const nodes: StrokeItem[] = []
        const addStroke = (el: any, len: number) => {
          const layer = detectLayer(el)
          const col = getComputedColor(el)
          el.setAttribute('fill', 'none')
          el.setAttribute('stroke', col)
          el.setAttribute('stroke-width', el.getAttribute('stroke-width') || '1')
          el.style.strokeDasharray = `${len}`
          el.style.strokeDashoffset = `${len}`
          nodes.push({ el, length: len, layer, color: col })
        }

        svg.querySelectorAll('path').forEach((p) => {
          try { addStroke(p, (p as SVGPathElement).getTotalLength()) } catch {}
        })
        svg.querySelectorAll('polyline').forEach((pl) => {
          addStroke(pl, polylineLength(pl as SVGPolylineElement))
        })
        svg.querySelectorAll('line').forEach((ln) => {
          addStroke(ln, lineLength(ln as SVGLineElement))
        })

        // Build groups
        const layerMap: Record<string, GroupInfo> = {}
        const toolMap: Record<string, GroupInfo> = {}
        for (const s of nodes) {
          const lid = String(s.layer)
          layerMap[lid] = layerMap[lid] || { visible: true, color: LAYER_PALETTE[(s.layer - 1) % LAYER_PALETTE.length], length: 0, count: 0 }
          layerMap[lid].length += s.length
          layerMap[lid].count += 1

          toolMap[s.color] = toolMap[s.color] || { visible: true, color: s.color, length: 0, count: 0 }
          toolMap[s.color].length += s.length
          toolMap[s.color].count += 1
        }
        setStrokes(nodes)
        setLayers(layerMap)
        setTools(toolMap)
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

  // Apply coloring based on mode
  useEffect(() => {
    for (const s of strokes) {
      if (mode === 'layer') {
        const gi = layers[String(s.layer)]
        if (gi) s.el.setAttribute('stroke', gi.color)
      } else {
        s.el.setAttribute('stroke', s.color)
      }
    }
  }, [mode, layers, strokes])

  // Animate
  const tick = useCallback((ts: number) => {
    if (!playing) return
    const last = lastTsRef.current ?? ts
    const dt = (ts - last) / 1000
    lastTsRef.current = ts
    const rate = 0.2 * speed
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
    // Update stroke dashoffsets according to progress and visibility filters
    let remaining = totalDrawLength * progress
    for (const s of strokes) {
      const visible = mode === 'layer' ? (layers[String(s.layer)]?.visible ?? true) : (tools[s.color]?.visible ?? true)
      if (!visible) {
        ;(s.el as any).style.strokeDashoffset = `${s.length}`
        continue
      }
      const drawn = Math.max(0, Math.min(s.length, remaining))
      const offset = s.length - drawn
      ;(s.el as any).style.strokeDashoffset = `${offset}`
      remaining -= drawn
    }
  }, [progress, strokes, totalDrawLength, layers, tools, mode])

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

  // Toggles UI
  const layerEntries = useMemo(() => Object.entries(layers).sort((a, b) => parseInt(a[0]) - parseInt(b[0])), [layers])
  const toolEntries = useMemo(() => Object.entries(tools), [tools])
  const toggleLayer = (key: string) => setLayers((m) => ({ ...m, [key]: { ...m[key], visible: !m[key].visible } }))
  const toggleTool = (key: string) => setTools((m) => ({ ...m, [key]: { ...m[key], visible: !m[key].visible } }))

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
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
        <label>
          Color by
          <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <option value="layer">Layer</option>
            <option value="tool">Tool (stroke color)</option>
          </select>
        </label>
        <div>Total length (visible): {Math.round(totalDrawLength)}</div>
      </div>

      <input type="range" min={0} max={1} step={0.001} value={progress} onChange={(e) => setProgress(parseFloat(e.target.value))} style={{ width: '100%', marginBottom: 8 }} />

      {mode === 'layer' ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          {layerEntries.map(([lid, info]) => (
            <label key={lid} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={info.visible} onChange={() => toggleLayer(lid)} />
              <span style={{ width: 14, height: 14, background: info.color, display: 'inline-block', border: '1px solid #333' }} />
              Layer {lid} <small>({info.count})</small>
            </label>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          {toolEntries.map(([col, info]) => (
            <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={info.visible} onChange={() => toggleTool(col)} />
              <span style={{ width: 14, height: 14, background: info.color, display: 'inline-block', border: '1px solid #333' }} />
              {col} <small>({info.count})</small>
            </label>
          ))}
        </div>
      )}

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

function detectLayer(el: Element): number {
  let cur: Element | null = el
  while (cur) {
    const dl = cur.getAttribute('data-layer') || cur.getAttribute('data-vpype-layer')
    if (dl && /^\d+$/.test(dl)) return parseInt(dl, 10)
    const id = cur.getAttribute('id') || ''
    const m = id.toLowerCase().match(/layer\s*(\d+)/)
    if (m) return parseInt(m[1], 10)
    cur = cur.parentElement
  }
  return 1
}

function getComputedColor(el: Element): string {
  const s = (el as HTMLElement)
  const stroke = el.getAttribute('stroke')
  if (stroke && stroke !== 'none') return stroke
  try {
    const cs = window.getComputedStyle(s)
    const col = cs.stroke || ''
    if (!col || col === 'none') return '#000'
    return rgbToHex(col)
  } catch {
    return '#000'
  }
}

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return rgb
  const r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10)
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}
