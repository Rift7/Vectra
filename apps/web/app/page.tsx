"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../lib/api";

type PreviewMeta = {
  estimated_time_s: number;
  distance_mm: number;
  pen_lifts: number;
};

type PreviewFrame = {
  type: string;
  x: number;
  y: number;
  pen: string;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("Idle");
  const [preview, setPreview] = useState<PreviewFrame[]>([]);
  const [meta, setMeta] = useState<PreviewMeta | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [svgSize, setSvgSize] = useState<{ w: number; h: number } | null>(null);
  const [svgBaseScale, setSvgBaseScale] = useState(1);
  const [gcodeStrokes, setGcodeStrokes] = useState<Array<Array<{ x: number; y: number }>>>([]);
  const [penDownCmd, setPenDownCmd] = useState("M3 S1000");
  const [penUpCmd, setPenUpCmd] = useState("M5");
  const [penDwell, setPenDwell] = useState(0.1);
  const [verticalFlip, setVerticalFlip] = useState(true);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const fitToPaper = () => {
    if (!canvasRef.current || !svgSize) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const paperW = rect.width * 0.7;
    const paperH = rect.height * 0.7;
    if (paperW <= 0 || paperH <= 0) return;
    const scale = Math.min(paperW / svgSize.w, paperH / svgSize.h);
    if (Number.isFinite(scale) && scale > 0) {
      setSvgBaseScale(scale);
      setView({ x: 0, y: 0, scale: 1 });
    }
  };

  const parseSvgSize = (markup: string) => {
    try {
      const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
      const svg = doc.querySelector("svg");
      if (!svg) return null;
      const viewBox = svg.getAttribute("viewBox");
      if (viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
          return { w: parts[2], h: parts[3] };
        }
      }
      const wAttr = svg.getAttribute("width");
      const hAttr = svg.getAttribute("height");
      if (wAttr && hAttr) {
        const w = parseFloat(wAttr);
        const h = parseFloat(hAttr);
        if (!Number.isNaN(w) && !Number.isNaN(h)) {
          return { w, h };
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const buildToolpathFromSvg = (markup: string) => {
    const tempHost = document.createElement("div");
    tempHost.style.position = "fixed";
    tempHost.style.left = "-9999px";
    tempHost.style.top = "-9999px";
    tempHost.style.width = "0";
    tempHost.style.height = "0";
    tempHost.style.overflow = "hidden";

    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return { frames: [], meta: null };

    const svgEl = document.importNode(svg, true) as SVGSVGElement;
    tempHost.appendChild(svgEl);
    document.body.appendChild(tempHost);

    const shapes = Array.from(
      svgEl.querySelectorAll(
        "path, line, polyline, polygon, rect, circle, ellipse"
      )
    ) as SVGGeometryElement[];

    const frames: PreviewFrame[] = [];
    let distance = 0;
    let penLifts = 0;
    const sampleStep = 5;

    for (const shape of shapes) {
      const length = shape.getTotalLength?.();
      if (!length || !Number.isFinite(length)) continue;
      const points: { x: number; y: number }[] = [];
      for (let d = 0; d <= length; d += sampleStep) {
        const p = shape.getPointAtLength(d);
        points.push({ x: p.x, y: p.y });
      }
      if (points.length < 2) continue;

      penLifts += 1;
      frames.push({ type: "move", x: points[0].x, y: points[0].y, pen: "up" });

      for (let i = 1; i < points.length; i += 1) {
        const prev = points[i - 1];
        const next = points[i];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        distance += Math.hypot(dx, dy);
        frames.push({ type: "move", x: next.x, y: next.y, pen: "down" });
      }
    }

    document.body.removeChild(tempHost);

    if (frames.length === 0) return { frames: [], meta: null };

    const meta: PreviewMeta = {
      estimated_time_s: Math.round(distance / 20),
      distance_mm: Math.round(distance),
      pen_lifts: Math.max(0, penLifts - 1)
    };

    return { frames, meta };
  };

  const parseGcode = (content: string) => {
    const strokes: Array<Array<{ x: number; y: number }>> = [];
    let currentStroke: Array<{ x: number; y: number }> = [];
    let penDown = false;
    let current = { x: 0, y: 0 };

    const lines = content.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.split(";")[0].trim();
      if (!line) continue;
      if (line.includes("(")) {
        continue;
      }

      const parts = line.split(/\s+/);
      const cmd = parts[0].toUpperCase();
      if (cmd === "M3" || cmd === "M03") penDown = true;
      if (cmd === "M5" || cmd === "M05") penDown = false;

      if (cmd === "G0" || cmd === "G00") penDown = false;
      if (cmd === "G1" || cmd === "G01") penDown = true;

      let x = current.x;
      let y = current.y;
      for (const part of parts.slice(1)) {
        const axis = part[0]?.toUpperCase();
        const val = parseFloat(part.slice(1));
        if (Number.isNaN(val)) continue;
        if (axis === "X") x = val;
        if (axis === "Y") y = val;
      }

      if (x !== current.x || y !== current.y) {
        current = { x, y };
        if (penDown) {
          if (currentStroke.length === 0) {
            currentStroke.push(current);
          } else {
            currentStroke.push(current);
          }
        } else if (currentStroke.length > 0) {
          strokes.push(currentStroke);
          currentStroke = [];
        }
      }
    }

    if (currentStroke.length > 0) strokes.push(currentStroke);
    return strokes;
  };

  const buildStrokesFromFrames = (frames: PreviewFrame[]) => {
    const strokes: Array<Array<{ x: number; y: number }>> = [];
    let currentStroke: Array<{ x: number; y: number }> = [];
    for (const frame of frames) {
      if (frame.pen === "down") {
        currentStroke.push({ x: frame.x, y: frame.y });
      } else if (currentStroke.length > 0) {
        strokes.push(currentStroke);
        currentStroke = [];
      }
    }
    if (currentStroke.length > 0) strokes.push(currentStroke);
    return strokes;
  };

  useEffect(() => {
    if (!playing || preview.length === 0) return;
    const id = window.setInterval(() => {
      setPlayhead((prev) => {
        const next = prev + 1;
        if (next >= preview.length) {
          setPlaying(false);
          return preview.length - 1;
        }
        return next;
      });
    }, 30);
    return () => window.clearInterval(id);
  }, [playing, preview.length]);

  const readSvg = async (nextFile: File | null) => {
    if (!nextFile) {
      setSvgMarkup(null);
      setSvgSize(null);
      return;
    }
    if (!nextFile.name.toLowerCase().endsWith(".svg")) {
      setSvgMarkup(null);
      setSvgSize(null);
      return;
    }
    const text = await nextFile.text();
    setSvgMarkup(text);
    setSvgSize(parseSvgSize(text));
  };

  useEffect(() => {
    if (!svgMarkup) return;
    const { frames, meta: nextMeta } = buildToolpathFromSvg(svgMarkup);
    if (frames.length > 0) {
      setPreview(frames);
      setMeta(nextMeta);
    }
  }, [svgMarkup]);

  useEffect(() => {
    fitToPaper();
    window.addEventListener("resize", fitToPaper);
    return () => window.removeEventListener("resize", fitToPaper);
  }, [svgSize]);

  const handleUpload = async () => {
    if (!file) {
      setStatus("Please choose a file.");
      return;
    }

    setStatus("Uploading...");
    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      body: formData
    });

    if (!uploadRes.ok) {
      setStatus("Upload failed.");
      return;
    }

    const uploadData = await uploadRes.json();
    setStatus("Processing with vpype...");

    const processRes = await fetch(`${API_BASE_URL}/api/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: uploadData.project_id,
        file_id: uploadData.file_id
      })
    });
    if (!processRes.ok) {
      setStatus("vpype processing failed.");
      return;
    }
    const processData = await processRes.json();

    const gcodeRes = await fetch(`${API_BASE_URL}/api/gcode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: uploadData.project_id,
        svg_id: processData.svg_id,
        pen_down_cmd: penDownCmd,
        pen_up_cmd: penUpCmd,
        pen_dwell_s: penDwell,
        vertical_flip: verticalFlip
      })
    });
    if (!gcodeRes.ok) {
      setStatus("G-code generation failed.");
      return;
    }
    const gcodeData = await gcodeRes.json();

    const gcodeTextRes = await fetch(
      `${API_BASE_URL}/api/gcode/${uploadData.project_id}/${gcodeData.gcode_id}`
    );
    if (gcodeTextRes.ok) {
      const gcodeText = await gcodeTextRes.text();
      const strokes = parseGcode(gcodeText);
      setGcodeStrokes(strokes);
    }

    setStatus("Building preview...");

    const previewRes = await fetch(
      `${API_BASE_URL}/api/preview/${uploadData.project_id}/${gcodeData.gcode_id}`
    );
    if (!previewRes.ok) {
      setStatus("Preview failed.");
      return;
    }

    const previewData = await previewRes.json();
    setPreview(previewData.frames || []);
    setMeta(previewData.meta || null);
    setPlayhead(0);
    setPlaying(false);
    setStatus("Ready");
  };

  return (
    <div className="canvas-content">
      <div className="canvas-tabs">Canvas | G-code Preview</div>
      <div
        className="canvas-area"
        ref={canvasRef}
        onPointerDown={(e) => {
          setPanning(true);
          setLastPoint({ x: e.clientX, y: e.clientY });
        }}
        onPointerMove={(e) => {
          if (!panning || !lastPoint) return;
          const dx = e.clientX - lastPoint.x;
          const dy = e.clientY - lastPoint.y;
          setView((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
          setLastPoint({ x: e.clientX, y: e.clientY });
        }}
        onPointerUp={() => {
          setPanning(false);
          setLastPoint(null);
        }}
        onPointerLeave={() => {
          setPanning(false);
          setLastPoint(null);
        }}
        onWheel={(e) => {
          e.preventDefault();
          const zoomFactor = 1 - e.deltaY * 0.001;
          setView((prev) => {
            const nextScale = Math.min(5, Math.max(0.2, prev.scale * zoomFactor));
            return { ...prev, scale: nextScale };
          });
        }}
      >
        <div
          className="canvas-stage"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
          }}
        >
          <div className="paper">Paper / Bed Outline</div>
          <div className="svg-layer" aria-label="SVG Preview">
            {svgMarkup ? (
              <div
                className="svg-content"
                style={{
                  width: svgSize ? `${svgSize.w}px` : "70%",
                  height: svgSize ? `${svgSize.h}px` : "70%",
                  transform: `scale(${svgBaseScale})`
                }}
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />
            ) : null}
          </div>
          {gcodeStrokes.length > 0 && svgSize ? (
            <svg
              className="gcode-layer"
              viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
              style={{ transform: `scale(${svgBaseScale})` }}
            >
              {gcodeStrokes.map((stroke, i) => (
                <polyline
                  key={i}
                  points={stroke.map((p) => `${p.x},${p.y}`).join(" ")}
                />
              ))}
            </svg>
          ) : null}
          {preview.length > 0 && svgSize ? (
            <svg
              className="preview-layer"
              viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
              style={{ transform: `scale(${svgBaseScale})` }}
            >
              {buildStrokesFromFrames(preview.slice(0, playhead + 1)).map(
                (stroke, i) => (
                  <polyline
                    key={`p-${i}`}
                    points={stroke.map((p) => `${p.x},${p.y}`).join(" ")}
                  />
                )
              )}
              <circle
                cx={preview[Math.min(playhead, preview.length - 1)].x}
                cy={preview[Math.min(playhead, preview.length - 1)].y}
                r="0.8"
              />
            </svg>
          ) : null}
        </div>
        <div className="hint">
          <div className="uploader">
            <input
              type="file"
              onChange={async (e) => {
                const nextFile = e.target.files?.[0] ?? null;
                setFile(nextFile);
                await readSvg(nextFile);
              }}
            />
            <button className="btn" onClick={handleUpload}>
              Upload + Preview
            </button>
            <button className="btn ghost" onClick={fitToPaper}>
              Fit to Paper
            </button>
            <button
              className="btn ghost"
              onClick={() => setView({ x: 0, y: 0, scale: 1 })}
            >
              Reset View
            </button>
          </div>
          <div className="controls">
            <label>
              Pen Down
              <input
                type="text"
                value={penDownCmd}
                onChange={(e) => setPenDownCmd(e.target.value)}
              />
            </label>
            <label>
              Pen Up
              <input
                type="text"
                value={penUpCmd}
                onChange={(e) => setPenUpCmd(e.target.value)}
              />
            </label>
            <label>
              Dwell (s)
              <input
                type="number"
                step="0.05"
                min="0"
                value={penDwell}
                onChange={(e) => setPenDwell(Number(e.target.value))}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={verticalFlip}
                onChange={(e) => setVerticalFlip(e.target.checked)}
              />
              Vertical Flip
            </label>
          </div>
          {preview.length > 0 ? (
            <div className="playback">
              <button
                className="btn"
                onClick={() => setPlaying((prev) => !prev)}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  setPlayhead(0);
                  setPlaying(false);
                }}
              >
                Reset
              </button>
              <input
                className="scrubber"
                type="range"
                min={0}
                max={Math.max(0, preview.length - 1)}
                value={playhead}
                onChange={(e) => {
                  setPlayhead(Number(e.target.value));
                  setPlaying(false);
                }}
              />
              <div className="playback-meta">
                {playhead + 1} / {preview.length}
              </div>
            </div>
          ) : null}
          {!svgMarkup ? (
            <div className="svg-placeholder">
              SVG preview appears here after selecting an .svg file.
            </div>
          ) : null}
          <div className="status">{status}</div>
          {meta ? (
            <div className="meta">
              ETA: {meta.estimated_time_s}s | Distance: {meta.distance_mm}mm |
              Pen Lifts: {meta.pen_lifts}
            </div>
          ) : null}
          {preview.length > 0 ? (
            <div className="preview-list">
              {preview.map((frame, index) => (
                <div key={index}>
                  {frame.type} ({frame.x}, {frame.y}) {frame.pen}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
