import React, { useCallback, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { PreviewCanvas } from './components/PreviewCanvas'

function App() {
  const [assetId, setAssetId] = useState('')
  const [stepsJson, setStepsJson] = useState('[{"type":"import","params":{"layer":1}}]')
  const [logs, setLogs] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const [svgUrl, setSvgUrl] = useState<string | null>(null)

  const addLog = useCallback((msg: string) => setLogs((l) => [msg, ...l].slice(0, 200)), [])

  const connectAndRun = useCallback(() => {
    try {
      const steps = JSON.parse(stepsJson)
      const ws = new WebSocket('ws://127.0.0.1:8000/ws/preview/run/')
      wsRef.current = ws
      ws.onopen = () => {
        addLog('WS open')
        ws.send(JSON.stringify({ action: 'run', asset_id: parseInt(assetId, 10), steps }))
      }
      ws.onmessage = (evt) => {
        addLog(`<= ${evt.data}`)
        try {
          const msg = JSON.parse(evt.data)
          if (msg.event === 'completed' && msg.output_svg_url) {
            setSvgUrl(msg.output_svg_url)
          }
        } catch {}
      }
      ws.onclose = () => addLog('WS closed')
      ws.onerror = (e) => addLog('WS error')
    } catch (e:any) {
      addLog('Invalid steps JSON')
    }
  }, [assetId, stepsJson])

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Vectra Live Preview (MVP)</h1>
      <p>Login to Django at <code>/api-auth/login/</code> in the same browser first.</p>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <label>
          Asset ID
          <input value={assetId} onChange={(e) => setAssetId(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>
          Steps JSON
          <textarea value={stepsJson} onChange={(e) => setStepsJson(e.target.value)} rows={6} style={{ width: '100%' }} />
        </label>
        <button onClick={connectAndRun}>Run</button>
      </div>
      <h2>Preview</h2>
      <PreviewCanvas svgUrl={svgUrl} />
      <h2>Events</h2>
      <pre style={{ background: '#111', color: '#0f0', padding: '1rem', height: 300, overflow: 'auto' }}>{logs.join('\n')}</pre>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
