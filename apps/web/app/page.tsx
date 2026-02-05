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

type JobStatus = {
  job_id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  message: string;
  result?: {
    ingest_svg_id?: string | null;
    processed_svg_id?: string | null;
    gcode_id?: string | null;
    source_kind?: string | null;
  } | null;
  error?: string | null;
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
  const [vMode, setVMode] = useState("color");
  const [vColorMode, setVColorMode] = useState("color");
  const [vHierarchical, setVHierarchical] = useState(false);
  const [vFilterSpeckle, setVFilterSpeckle] = useState(4);
  const [vColorPrecision, setVColorPrecision] = useState(6);
  const [vLengthThreshold, setVLengthThreshold] = useState(4);
  const [vCornerThreshold, setVCornerThreshold] = useState(60);
  const [vSegmentLength, setVSegmentLength] = useState(4);
  const [vSpiro, setVSpiro] = useState(true);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<
    Array<{
      name: string;
      mode: string;
      colormode: string;
      hierarchical: boolean;
      filter_speckle: number;
      color_precision: number;
      length_threshold: number;
      corner_threshold: number;
      segment_length: number;
      spiro: boolean;
    }>
  >([]);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [jobProgress, setJobProgress] = useState(0);
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

    const canPreviewDirect = !file.name.toLowerCase().endsWith(".svg");
    setStatus("Uploading...");
    setJobProgress(0);
    setPreview([]);
    setGcodeStrokes([]);
    setMeta(null);
    setPlayhead(0);
    setPlaying(false);

    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      body: formData
    });

    if (!uploadRes.ok) {
      setStatus("Upload failed.");
      setJobProgress(0);
      return;
    }

    const uploadData = await uploadRes.json();
    setProjectId(uploadData.project_id);
    try {
      const presetsRes = await fetch(
        `${API_BASE_URL}/api/presets/vectorize/${uploadData.project_id}`
      );
      if (presetsRes.ok) {
        const presetsData = await presetsRes.json();
        setPresets(presetsData.presets || []);
      }
    } catch {
      setPresets([]);
    }

    const startJobRes = await fetch(`${API_BASE_URL}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: uploadData.project_id,
        file_id: uploadData.file_id,
        filename: uploadData.filename,
        mode: vMode,
        colormode: vColorMode,
        hierarchical: vHierarchical,
        filter_speckle: vFilterSpeckle,
        color_precision: vColorPrecision,
        length_threshold: vLengthThreshold,
        corner_threshold: vCornerThreshold,
        segment_length: vSegmentLength,
        spiro: vSpiro,
        pen_down_cmd: penDownCmd,
        pen_up_cmd: penUpCmd,
        pen_dwell_s: penDwell,
        vertical_flip: verticalFlip
      })
    });

    if (!startJobRes.ok) {
      setStatus("Failed to start job.");
      setJobProgress(0);
      return;
    }

    const startedJob = (await startJobRes.json()) as JobStatus;
    let seenSvgId: string | null = null;
    let finalJob = startedJob;

    while (true) {
      const pollRes = await fetch(`${API_BASE_URL}/api/jobs/${startedJob.job_id}`);
      if (!pollRes.ok) {
        setStatus("Job polling failed.");
        setJobProgress(0);
        return;
      }
      const polled = (await pollRes.json()) as JobStatus;
      finalJob = polled;
      setJobProgress(polled.progress);
      setStatus(polled.message);

      const maybeSvgId = polled.result?.ingest_svg_id;
      if (canPreviewDirect && maybeSvgId && maybeSvgId !== seenSvgId) {
        const svgRes = await fetch(
          `${API_BASE_URL}/api/svg/${uploadData.project_id}/${maybeSvgId}`
        );
        if (svgRes.ok) {
          const svgText = await svgRes.text();
          setSvgMarkup(svgText);
          setSvgSize(parseSvgSize(svgText));
          seenSvgId = maybeSvgId;
        }
      }

      if (polled.status === "completed" || polled.status === "failed") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    if (finalJob.status === "failed") {
      setStatus(finalJob.error ? `Job failed: ${finalJob.error}` : "Job failed");
      setJobProgress(100);
      return;
    }

    const finalGcodeId = finalJob.result?.gcode_id;
    if (!finalGcodeId) {
      setStatus("Completed without G-code output.");
      setJobProgress(100);
      return;
    }

    const gcodeTextRes = await fetch(
      `${API_BASE_URL}/api/gcode/${uploadData.project_id}/${finalGcodeId}`
    );
    if (!gcodeTextRes.ok) {
      setStatus("Failed to fetch G-code.");
      setJobProgress(100);
      return;
    }
    const gcodeText = await gcodeTextRes.text();
    setGcodeStrokes(parseGcode(gcodeText));

    const previewRes = await fetch(
      `${API_BASE_URL}/api/preview/${uploadData.project_id}/${finalGcodeId}`
    );
    if (!previewRes.ok) {
      setStatus("Preview failed.");
      setJobProgress(100);
      return;
    }

    const previewData = await previewRes.json();
    setPreview(previewData.frames || []);
    setMeta(previewData.meta || null);
    setPlayhead(0);
    setPlaying(false);
    setStatus("Ready");
    setJobProgress(100);
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
              Presets
              <select
                value=""
                onChange={(e) => {
                  const selected = presets.find(
                    (preset) => preset.name === e.target.value
                  );
                  if (!selected) return;
                  setVMode(selected.mode);
                  setVColorMode(selected.colormode);
                  setVHierarchical(selected.hierarchical);
                  setVFilterSpeckle(selected.filter_speckle);
                  setVColorPrecision(selected.color_precision);
                  setVLengthThreshold(selected.length_threshold);
                  setVCornerThreshold(selected.corner_threshold);
                  setVSegmentLength(selected.segment_length);
                  setVSpiro(selected.spiro);
                }}
              >
                <option value="">Select preset</option>
                {presets.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Save Preset
              <div className="preset-row">
                <input
                  type="text"
                  placeholder="Preset name"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                />
                <button
                  className="btn ghost"
                  onClick={async () => {
                    if (!projectId || !presetName.trim()) return;
                    const saveRes = await fetch(
                      `${API_BASE_URL}/api/presets/vectorize`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          project_id: projectId,
                          preset: {
                            name: presetName.trim(),
                            mode: vMode,
                            colormode: vColorMode,
                            hierarchical: vHierarchical,
                            filter_speckle: vFilterSpeckle,
                            color_precision: vColorPrecision,
                            length_threshold: vLengthThreshold,
                            corner_threshold: vCornerThreshold,
                            segment_length: vSegmentLength,
                            spiro: vSpiro
                          }
                        })
                      }
                    );
                    if (saveRes.ok) {
                      const nextPresets = await saveRes.json();
                      setPresets(nextPresets.presets || []);
                      setPresetName("");
                    }
                  }}
                >
                  Save
                </button>
              </div>
            </label>
            <label>
              Vector Mode
              <select value={vMode} onChange={(e) => setVMode(e.target.value)}>
                <option value="color">Color</option>
                <option value="binary">Binary</option>
              </select>
            </label>
            <label>
              Color Mode
              <select
                value={vColorMode}
                onChange={(e) => setVColorMode(e.target.value)}
              >
                <option value="color">Color</option>
                <option value="bw">BW</option>
              </select>
            </label>
            <label>
              Filter Speckle
              <input
                type="number"
                min="0"
                value={vFilterSpeckle}
                onChange={(e) => setVFilterSpeckle(Number(e.target.value))}
              />
            </label>
            <label>
              Color Precision
              <input
                type="number"
                min="1"
                value={vColorPrecision}
                onChange={(e) => setVColorPrecision(Number(e.target.value))}
              />
            </label>
            <label>
              Length Threshold
              <input
                type="number"
                step="0.5"
                min="0"
                value={vLengthThreshold}
                onChange={(e) => setVLengthThreshold(Number(e.target.value))}
              />
            </label>
            <label>
              Corner Threshold
              <input
                type="number"
                step="1"
                min="0"
                value={vCornerThreshold}
                onChange={(e) => setVCornerThreshold(Number(e.target.value))}
              />
            </label>
            <label>
              Segment Length
              <input
                type="number"
                step="0.5"
                min="0"
                value={vSegmentLength}
                onChange={(e) => setVSegmentLength(Number(e.target.value))}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={vHierarchical}
                onChange={(e) => setVHierarchical(e.target.checked)}
              />
              Hierarchical
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={vSpiro}
                onChange={(e) => setVSpiro(e.target.checked)}
              />
              Spiro
            </label>
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
          <div className="progress-wrap">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${jobProgress}%` }}
              />
            </div>
            <div className="progress-text">{jobProgress}%</div>
          </div>
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
