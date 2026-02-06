"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type ProjectItem = {
  id: string;
  name: string;
  size: number;
};

type ProjectTree = {
  project_id: string;
  source: ProjectItem[];
  intermediate: ProjectItem[];
  outputs: ProjectItem[];
};

type ProjectRun = {
  created_at: string;
  job_id: string;
  source_kind: string;
  source_file_id: string;
  ingest_svg_id: string;
  processed_svg_id: string;
  gcode_id: string;
  status: string;
};

type MachineConfig = {
  width: number;
  height: number;
  unit: "mm" | "in";
};

type ArtTransform = {
  xMm: number;
  yMm: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
};

type HandleId =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

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
  const [machine, setMachine] = useState<MachineConfig>({
    width: 420,
    height: 297,
    unit: "mm"
  });
  const [artTransform, setArtTransform] = useState<ArtTransform>({
    xMm: 0,
    yMm: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0
  });
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
  const [canvasTab, setCanvasTab] = useState<"design" | "preview">("design");
  const [openSections, setOpenSections] = useState({
    vectorize: true,
    machine: false,
    playback: true
  });
  const [inspectorRoot, setInspectorRoot] = useState<HTMLElement | null>(null);
  const [projectRoot, setProjectRoot] = useState<HTMLElement | null>(null);
  const [projectTree, setProjectTree] = useState<ProjectTree | null>(null);
  const [projectRuns, setProjectRuns] = useState<ProjectRun[]>([]);
  const [selectedRunKey, setSelectedRunKey] = useState<string | null>(null);
  const [draggingArt, setDraggingArt] = useState(false);
  const [artDragStart, setArtDragStart] = useState<{ x: number; y: number } | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [gridStepMm, setGridStepMm] = useState(10);
  const [snapStepMm, setSnapStepMm] = useState(1);
  const [rotateNudgeMode, setRotateNudgeMode] = useState(false);
  const [transformWarning, setTransformWarning] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const artBoundsRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<{
    mode: "move" | "scale" | "rotate";
    startX: number;
    startY: number;
    startTransform: ArtTransform;
    centerX?: number;
    centerY?: number;
    startDistance?: number;
    startAngle?: number;
    startLocalX?: number;
    startLocalY?: number;
    handle?: HandleId;
  } | null>(null);
  const sectionStorageKey = "vectra.inspector.sections";

  useEffect(() => {
    setInspectorRoot(document.getElementById("inspector-root"));
    setProjectRoot(document.getElementById("project-root"));
    const raw = window.localStorage.getItem(sectionStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        vectorize?: boolean;
        machine?: boolean;
        playback?: boolean;
      };
      setOpenSections((prev) => ({
        vectorize:
          typeof parsed.vectorize === "boolean"
            ? parsed.vectorize
            : prev.vectorize,
        machine:
          typeof parsed.machine === "boolean" ? parsed.machine : prev.machine,
        playback:
          typeof parsed.playback === "boolean"
            ? parsed.playback
            : prev.playback
      }));
    } catch {
      window.localStorage.removeItem(sectionStorageKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(sectionStorageKey, JSON.stringify(openSections));
  }, [openSections]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!svgMarkup) return;
      if (event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) {
        return;
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        setRotateNudgeMode((prev) => !prev);
        return;
      }

      const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key);
      if (!isArrow) return;
      event.preventDefault();

      if (rotateNudgeMode) {
        const rotateStep = event.shiftKey ? 5 : 1;
        const scaleStep = event.shiftKey ? 0.1 : 0.02;
        if (event.key === "ArrowLeft") {
          applyConstrainedTransform({
            ...artTransform,
            rotation: artTransform.rotation - rotateStep
          });
          return;
        }
        if (event.key === "ArrowRight") {
          applyConstrainedTransform({
            ...artTransform,
            rotation: artTransform.rotation + rotateStep
          });
          return;
        }
        if (event.key === "ArrowUp") {
          applyConstrainedTransform({
            ...artTransform,
            scaleX: Math.max(0.05, artTransform.scaleX + scaleStep),
            scaleY: Math.max(0.05, artTransform.scaleY + scaleStep)
          });
          return;
        }
        if (event.key === "ArrowDown") {
          applyConstrainedTransform({
            ...artTransform,
            scaleX: Math.max(0.05, artTransform.scaleX - scaleStep),
            scaleY: Math.max(0.05, artTransform.scaleY - scaleStep)
          });
          return;
        }
      }

      const stepMm = event.shiftKey ? 10 : event.altKey ? 0.2 : 1;
      let dx = 0;
      let dy = 0;
      if (event.key === "ArrowLeft") dx = -stepMm;
      if (event.key === "ArrowRight") dx = stepMm;
      if (event.key === "ArrowUp") dy = -stepMm;
      if (event.key === "ArrowDown") dy = stepMm;
      applyConstrainedTransform({
        ...artTransform,
        xMm: artTransform.xMm + dx,
        yMm: artTransform.yMm + dy
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [svgMarkup, rotateNudgeMode, artTransform]);

  useEffect(() => {
    if (!svgMarkup || !svgSize) return;
    if (isTransformInsideWorkArea(artTransform)) {
      setTransformWarning(null);
    } else {
      setTransformWarning("Artwork exceeds machine work area.");
    }
  }, [machine.width, machine.height, machine.unit, svgSize, svgBaseScale, artTransform, svgMarkup]);

  const refreshProjectData = async (id: string) => {
    const summaryRes = await fetch(`${API_BASE_URL}/api/projects/${id}/summary`);
    if (!summaryRes.ok) return;
    const summaryData = await summaryRes.json();
    setProjectTree(summaryData.tree || null);
    setProjectRuns(summaryData.runs || []);
  };

  const runKey = (run: ProjectRun) => `${run.created_at}|${run.job_id}`;

  useEffect(() => {
    if (projectRuns.length === 0) {
      setSelectedRunKey(null);
      return;
    }
    const stillExists = selectedRunKey
      ? projectRuns.some((run) => runKey(run) === selectedRunKey)
      : false;
    if (!stillExists) {
      setSelectedRunKey(runKey(projectRuns[0]));
    }
  }, [projectRuns, selectedRunKey]);

  const loadRunIntoPreview = async (id: string, run: ProjectRun) => {
    const gcodeTextRes = await fetch(
      `${API_BASE_URL}/api/gcode/${id}/${run.gcode_id}`
    );
    if (!gcodeTextRes.ok) {
      setStatus("Failed to load selected run G-code.");
      return;
    }
    const gcodeText = await gcodeTextRes.text();
    setGcodeStrokes(parseGcode(gcodeText));

    const previewRes = await fetch(
      `${API_BASE_URL}/api/preview/${id}/${run.gcode_id}`
    );
    if (!previewRes.ok) {
      setStatus("Failed to load selected run preview.");
      return;
    }
    const previewData = await previewRes.json();
    setPreview(previewData.frames || []);
    setMeta(previewData.meta || null);
    setPlayhead(0);
    setPlaying(false);
    setCanvasTab("preview");

    const svgRes = await fetch(`${API_BASE_URL}/api/svg/${id}/${run.processed_svg_id}`);
    if (svgRes.ok) {
      const svgText = await svgRes.text();
      setSvgMarkup(svgText);
      setSvgSize(parseSvgSize(svgText));
    }
  };
  const fitToPaper = () => {
    if (!canvasRef.current || !svgSize) return;
    const bed = getBedMetrics();
    if (!bed) return;
    const paperW = bed.bedW;
    const paperH = bed.bedH;
    if (paperW <= 0 || paperH <= 0) return;
    const scale = Math.min(paperW / svgSize.w, paperH / svgSize.h);
    if (Number.isFinite(scale) && scale > 0) {
      setSvgBaseScale(scale);
      setView({ x: 0, y: 0, scale: 1 });
      setArtTransform((prev) => ({
        ...prev,
        xMm: 0,
        yMm: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0
      }));
      setTransformWarning(null);
    }
  };

  const resetArtTransform = () => {
    setArtTransform({
      xMm: 0,
      yMm: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0
    });
  };

  const getUnitFactor = () => (machine.unit === "mm" ? 1 : 25.4);

  const getMachineMm = () => ({
    widthMm: machine.width * getUnitFactor(),
    heightMm: machine.height * getUnitFactor()
  });

  const getBedMetrics = () => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const { widthMm, heightMm } = getMachineMm();
    const ratio = widthMm / Math.max(1e-6, heightMm);
    let bedW: number;
    let bedH: number;
    if (ratio >= 1) {
      bedW = rect.width * 0.7;
      bedH = bedW / ratio;
    } else {
      bedH = rect.height * 0.7;
      bedW = bedH * ratio;
    }
    const pxPerMm = bedW / Math.max(widthMm, 1e-6);
    return { bedW, bedH, pxPerMm };
  };

  const isTransformInsideWorkArea = (candidate: ArtTransform) => {
    if (!svgSize) return true;
    const bed = getBedMetrics();
    if (!bed) return true;
    const artW = svgSize.w * svgBaseScale * candidate.scaleX;
    const artH = svgSize.h * svgBaseScale * candidate.scaleY;
    const tx = candidate.xMm * bed.pxPerMm;
    const ty = candidate.yMm * bed.pxPerMm;
    const rad = (candidate.rotation * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const hw = artW / 2;
    const hh = artH / 2;
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh }
    ];
    for (const p of corners) {
      const rx = tx + p.x * c - p.y * s;
      const ry = ty + p.x * s + p.y * c;
      if (Math.abs(rx) > bed.bedW / 2 || Math.abs(ry) > bed.bedH / 2) {
        return false;
      }
    }
    return true;
  };

  const snapValue = (value: number, step: number) => {
    if (step <= 0) return value;
    return Math.round(value / step) * step;
  };

  const applyConstrainedTransform = (candidate: ArtTransform) => {
    if (isTransformInsideWorkArea(candidate)) {
      setArtTransform(candidate);
      setTransformWarning(null);
      return true;
    }
    setTransformWarning("Artwork exceeds machine work area.");
    return false;
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
    await refreshProjectData(uploadData.project_id);
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
    await refreshProjectData(uploadData.project_id);
  };

  const inspectorPanel = (
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
      </div>
      <div className="uploader secondary">
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
      <div className="inspector-sections">
        <section className="inspector-section">
          <button
            className="inspector-toggle"
            onClick={() =>
              setOpenSections((prev) => ({
                ...prev,
                vectorize: !prev.vectorize
              }))
            }
          >
            <span>Vectorize</span>
            <span>{openSections.vectorize ? "−" : "+"}</span>
          </button>
          {openSections.vectorize ? (
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
            </div>
          ) : null}
        </section>
        <section className="inspector-section">
          <button
            className="inspector-toggle"
            onClick={() =>
              setOpenSections((prev) => ({
                ...prev,
                machine: !prev.machine
              }))
            }
          >
            <span>Machine</span>
            <span>{openSections.machine ? "−" : "+"}</span>
          </button>
          {openSections.machine ? (
            <div className="controls">
              <label>
                Work Width
                <input
                  type="number"
                  min="10"
                  value={machine.width}
                  onChange={(e) =>
                    setMachine((prev) => ({
                      ...prev,
                      width: Number(e.target.value) || prev.width
                    }))
                  }
                />
              </label>
              <label>
                Work Height
                <input
                  type="number"
                  min="10"
                  value={machine.height}
                  onChange={(e) =>
                    setMachine((prev) => ({
                      ...prev,
                      height: Number(e.target.value) || prev.height
                    }))
                  }
                />
              </label>
              <label>
                Units
                <select
                  value={machine.unit}
                  onChange={(e) => {
                    const nextUnit = e.target.value as "mm" | "in";
                    setMachine((prev) => {
                      if (prev.unit === nextUnit) return prev;
                      const factor = prev.unit === "mm" ? 1 / 25.4 : 25.4;
                      return {
                        unit: nextUnit,
                        width: Number((prev.width * factor).toFixed(2)),
                        height: Number((prev.height * factor).toFixed(2))
                      };
                    });
                  }}
                >
                  <option value="mm">mm</option>
                  <option value="in">in</option>
                </select>
              </label>
              <label>
                Position X
                <input
                  type="number"
                  step={machine.unit === "mm" ? "1" : "0.05"}
                  value={Number((artTransform.xMm / getUnitFactor()).toFixed(2))}
                  onChange={(e) =>
                    applyConstrainedTransform({
                      ...artTransform,
                      xMm: Number(e.target.value) * getUnitFactor()
                    })
                  }
                />
              </label>
              <label>
                Position Y
                <input
                  type="number"
                  step={machine.unit === "mm" ? "1" : "0.05"}
                  value={Number((artTransform.yMm / getUnitFactor()).toFixed(2))}
                  onChange={(e) =>
                    applyConstrainedTransform({
                      ...artTransform,
                      yMm: Number(e.target.value) * getUnitFactor()
                    })
                  }
                />
              </label>
              <label>
                Scale X
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  value={Number(artTransform.scaleX.toFixed(2))}
                  onChange={(e) =>
                    applyConstrainedTransform({
                      ...artTransform,
                      scaleX: Math.max(0.1, Number(e.target.value) || artTransform.scaleX)
                    })
                  }
                />
              </label>
              <label>
                Scale Y
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  value={Number(artTransform.scaleY.toFixed(2))}
                  onChange={(e) =>
                    applyConstrainedTransform({
                      ...artTransform,
                      scaleY: Math.max(0.1, Number(e.target.value) || artTransform.scaleY)
                    })
                  }
                />
              </label>
              <label>
                Rotation
                <input
                  type="number"
                  step="1"
                  value={Math.round(artTransform.rotation)}
                  onChange={(e) =>
                    applyConstrainedTransform({
                      ...artTransform,
                      rotation: Number(e.target.value)
                    })
                  }
                />
              </label>
              <label className="checkbox">
                <button className="btn ghost" onClick={resetArtTransform}>
                  Reset Transform
                </button>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
                Show Machine Grid
              </label>
              <label>
                Grid Increment
                <input
                  type="number"
                  min="0.1"
                  step={machine.unit === "mm" ? "0.5" : "0.01"}
                  value={Number((gridStepMm / getUnitFactor()).toFixed(2))}
                  onChange={(e) =>
                    setGridStepMm(
                      Math.max(0.1, Number(e.target.value) * getUnitFactor() || gridStepMm)
                    )
                  }
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={snapToGrid}
                  onChange={(e) => setSnapToGrid(e.target.checked)}
                />
                Snap Move To Grid
              </label>
              <label>
                Snap Increment
                <input
                  type="number"
                  min="0.1"
                  step={machine.unit === "mm" ? "0.5" : "0.01"}
                  value={Number((snapStepMm / getUnitFactor()).toFixed(2))}
                  onChange={(e) =>
                    setSnapStepMm(
                      Math.max(0.1, Number(e.target.value) * getUnitFactor() || snapStepMm)
                    )
                  }
                />
              </label>
              {transformWarning ? (
                <div className="transform-warning">{transformWarning}</div>
              ) : null}
              <div className="transform-hint">
                Keyboard: `R` toggles {rotateNudgeMode ? "Rotate" : "Move"} mode.
                Arrows nudge. `Shift` = coarse, `Alt` = fine.
                {snapToGrid ? ` Snap: ${Number((snapStepMm / getUnitFactor()).toFixed(2))} ${machine.unit}.` : ""}
              </div>
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
          ) : null}
        </section>
        <section className="inspector-section">
          <button
            className="inspector-toggle"
            onClick={() =>
              setOpenSections((prev) => ({
                ...prev,
                playback: !prev.playback
              }))
            }
          >
            <span>Playback</span>
            <span>{openSections.playback ? "−" : "+"}</span>
          </button>
          {openSections.playback ? (
            preview.length > 0 ? (
              <div className="playback">
                <button className="btn" onClick={() => setPlaying((prev) => !prev)}>
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
            ) : (
              <div className="playback-empty">
                Run a job to enable playback controls.
              </div>
            )
          ) : null}
        </section>
      </div>
      {!svgMarkup ? (
        <div className="svg-placeholder">
          SVG preview appears here after selecting an .svg file.
        </div>
      ) : null}
      <div className="status">{status}</div>
      <div className="progress-wrap">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${jobProgress}%` }} />
        </div>
        <div className="progress-text">{jobProgress}%</div>
      </div>
      {meta ? (
        <div className="meta">
          ETA: {meta.estimated_time_s}s | Distance: {meta.distance_mm}mm | Pen
          Lifts: {meta.pen_lifts}
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
  );

  const selectedRun = selectedRunKey
    ? projectRuns.find((run) => runKey(run) === selectedRunKey) || null
    : null;
  const projectPanel = (
    <div className="project-panel">
      <div className="project-meta">
        <div className="project-meta-label">Project ID</div>
        <div className="project-meta-value">{projectId || "Not loaded"}</div>
      </div>

      <div className="project-section">
        <div className="project-section-title">Files</div>
        <div className="project-subsection">
          <div className="project-subtitle">Source</div>
          {projectTree?.source?.length ? (
            <ul className="project-list">
              {projectTree.source.map((item) => (
                <li key={`src-${item.name}`}>{item.name}</li>
              ))}
            </ul>
          ) : (
            <div className="project-empty">No source files</div>
          )}
        </div>
        <div className="project-subsection">
          <div className="project-subtitle">Intermediate</div>
          {projectTree?.intermediate?.length ? (
            <ul className="project-list">
              {projectTree.intermediate.slice(0, 8).map((item) => (
                <li key={`int-${item.name}`}>{item.name}</li>
              ))}
            </ul>
          ) : (
            <div className="project-empty">No intermediates</div>
          )}
        </div>
        <div className="project-subsection">
          <div className="project-subtitle">Outputs</div>
          {projectTree?.outputs?.length ? (
            <ul className="project-list">
              {projectTree.outputs.slice(0, 8).map((item) => (
                <li key={`out-${item.name}`}>{item.name}</li>
              ))}
            </ul>
          ) : (
            <div className="project-empty">No outputs</div>
          )}
        </div>
      </div>

      <div className="project-section">
        <div className="project-section-title">Output Management</div>
        {projectId && selectedRun ? (
          <div className="output-actions">
            <a
              className="btn ghost"
              href={`${API_BASE_URL}/api/gcode/${projectId}/${selectedRun.gcode_id}`}
              target="_blank"
              rel="noreferrer"
            >
              Download G-code
            </a>
            <a
              className="btn ghost"
              href={`${API_BASE_URL}/api/svg/${projectId}/${selectedRun.processed_svg_id}`}
              target="_blank"
              rel="noreferrer"
            >
              Download SVG
            </a>
          </div>
        ) : (
          <div className="project-empty">No completed run outputs</div>
        )}
      </div>

      <div className="project-section">
        <div className="project-section-title">Run History</div>
        {projectRuns.length ? (
          <ul className="run-list">
            {projectRuns.slice(0, 12).map((run) => (
              <li key={`${run.created_at}-${run.job_id}`} className="run-item">
                <button
                  className={`run-item-btn ${
                    selectedRunKey === runKey(run) ? "active" : ""
                  }`}
                  onClick={async () => {
                    setSelectedRunKey(runKey(run));
                    if (!projectId) return;
                    await loadRunIntoPreview(projectId, run);
                  }}
                >
                  <div className="run-top">
                    <span>{new Date(run.created_at).toLocaleString()}</span>
                    <span className="run-status">{run.status}</span>
                  </div>
                  <div className="run-bottom">
                    <span>{run.source_kind}</span>
                    <span>{run.gcode_id}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="project-empty">No runs yet</div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="canvas-content">
      <div className="canvas-tabs">
        <button
          className={`canvas-tab ${canvasTab === "design" ? "active" : ""}`}
          onClick={() => setCanvasTab("design")}
        >
          Design
        </button>
        <button
          className={`canvas-tab ${canvasTab === "preview" ? "active" : ""}`}
          onClick={() => setCanvasTab("preview")}
        >
          G-code Preview
        </button>
      </div>
      <div
        className="canvas-area"
        ref={canvasRef}
        onPointerDown={(e) => {
          if (interactionRef.current) return;
          setPanning(true);
          setLastPoint({ x: e.clientX, y: e.clientY });
        }}
        onPointerMove={(e) => {
          const interaction = interactionRef.current;
          if (interaction) {
            const bed = getBedMetrics();
            if (!bed) return;
            if (interaction.mode === "move") {
              const dx = e.clientX - interaction.startX;
              const dy = e.clientY - interaction.startY;
              let xMm = interaction.startTransform.xMm + dx / (view.scale * bed.pxPerMm);
              let yMm = interaction.startTransform.yMm + dy / (view.scale * bed.pxPerMm);
              if (snapToGrid) {
                xMm = snapValue(xMm, snapStepMm);
                yMm = snapValue(yMm, snapStepMm);
              }
              applyConstrainedTransform({
                ...interaction.startTransform,
                xMm,
                yMm
              });
            } else if (interaction.mode === "scale") {
              if (
                interaction.centerX === undefined ||
                interaction.centerY === undefined ||
                interaction.startLocalX === undefined ||
                interaction.startLocalY === undefined ||
                !interaction.handle
              ) return;
              const rad = (interaction.startTransform.rotation * Math.PI) / 180;
              const c = Math.cos(rad);
              const s = Math.sin(rad);
              const dx = e.clientX - interaction.centerX;
              const dy = e.clientY - interaction.centerY;
              const localX = dx * c + dy * s;
              const localY = -dx * s + dy * c;
              let scaleX = interaction.startTransform.scaleX;
              let scaleY = interaction.startTransform.scaleY;
              const hx = interaction.handle.includes("e") || interaction.handle.includes("w");
              const hy = interaction.handle.includes("n") || interaction.handle.includes("s");
              if (hx) {
                const ratioX = Math.abs(localX) / Math.max(1, Math.abs(interaction.startLocalX));
                scaleX = Math.max(0.05, interaction.startTransform.scaleX * ratioX);
              }
              if (hy) {
                const ratioY = Math.abs(localY) / Math.max(1, Math.abs(interaction.startLocalY));
                scaleY = Math.max(0.05, interaction.startTransform.scaleY * ratioY);
              }
              applyConstrainedTransform({
                ...interaction.startTransform,
                scaleX,
                scaleY
              });
            } else if (interaction.mode === "rotate") {
              if (!interaction.centerX || !interaction.centerY || interaction.startAngle === undefined) return;
              const angle = Math.atan2(e.clientY - interaction.centerY, e.clientX - interaction.centerX);
              const deltaDeg = ((angle - interaction.startAngle) * 180) / Math.PI;
              applyConstrainedTransform({
                ...interaction.startTransform,
                rotation: interaction.startTransform.rotation + deltaDeg
              });
            }
            return;
          }
          if (!panning || !lastPoint) return;
          const dx = e.clientX - lastPoint.x;
          const dy = e.clientY - lastPoint.y;
          setView((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
          setLastPoint({ x: e.clientX, y: e.clientY });
        }}
        onPointerUp={() => {
          setPanning(false);
          setLastPoint(null);
          setDraggingArt(false);
          setArtDragStart(null);
          interactionRef.current = null;
        }}
        onPointerLeave={() => {
          setPanning(false);
          setLastPoint(null);
          setDraggingArt(false);
          setArtDragStart(null);
          interactionRef.current = null;
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
          {(() => {
            const bed = getBedMetrics();
            const bedStyle =
              machine.width >= machine.height
                ? { width: "70%", aspectRatio: `${machine.width} / ${machine.height}` }
                : { height: "70%", aspectRatio: `${machine.width} / ${machine.height}` };
            const minorGridPx = bed ? Math.max(3, bed.pxPerMm * gridStepMm) : 12;
            const majorGridPx = minorGridPx * 5;
            const gridStyle = showGrid
              ? {
                  backgroundImage: [
                    "linear-gradient(to right, rgba(97, 220, 226, 0.12) 1px, transparent 1px)",
                    "linear-gradient(to bottom, rgba(97, 220, 226, 0.12) 1px, transparent 1px)",
                    "linear-gradient(to right, rgba(97, 220, 226, 0.22) 1px, transparent 1px)",
                    "linear-gradient(to bottom, rgba(97, 220, 226, 0.22) 1px, transparent 1px)"
                  ].join(","),
                  backgroundSize: [
                    `${minorGridPx}px ${minorGridPx}px`,
                    `${minorGridPx}px ${minorGridPx}px`,
                    `${majorGridPx}px ${majorGridPx}px`,
                    `${majorGridPx}px ${majorGridPx}px`
                  ].join(",")
                }
              : {};
            const xPx = bed ? artTransform.xMm * bed.pxPerMm : 0;
            const yPx = bed ? artTransform.yMm * bed.pxPerMm : 0;
            const scaledWidth = svgSize
              ? svgSize.w * svgBaseScale * artTransform.scaleX
              : 0;
            const scaledHeight = svgSize
              ? svgSize.h * svgBaseScale * artTransform.scaleY
              : 0;
            const transform = `translate(${xPx}px, ${yPx}px) rotate(${artTransform.rotation}deg)`;
            return (
              <>
          <div
            className="paper"
            style={{
              ...bedStyle,
              ...gridStyle
            }}
          >
            {machine.width} x {machine.height} {machine.unit}
          </div>
          <div
            className={`svg-layer ${canvasTab === "design" ? "interactive" : "hidden"}`}
            aria-label="SVG Preview"
          >
            {svgMarkup ? (
              <div
                className="svg-content"
                onPointerDown={(e) => {
                  if (canvasTab !== "design") return;
                  e.stopPropagation();
                  setDraggingArt(true);
                  setArtDragStart({ x: e.clientX, y: e.clientY });
                  interactionRef.current = {
                    mode: "move",
                    startX: e.clientX,
                    startY: e.clientY,
                    startTransform: { ...artTransform }
                  };
                }}
                style={
                  svgSize
                    ? {
                        width: `${svgSize.w * svgBaseScale * artTransform.scaleX}px`,
                        height: `${svgSize.h * svgBaseScale * artTransform.scaleY}px`,
                        transform: `translate(${xPx}px, ${yPx}px) rotate(${artTransform.rotation}deg)`
                      }
                    : undefined
                }
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />
            ) : null}
          </div>
          {canvasTab === "design" && svgMarkup && svgSize ? (
            <div
              ref={artBoundsRef}
              className={`art-bounds ${transformWarning ? "outside" : ""}`}
              style={{
                width: `${scaledWidth}px`,
                height: `${scaledHeight}px`,
                transform
              }}
            >
              <button
                className="rotate-grip"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (!artBoundsRef.current) return;
                  const rect = artBoundsRef.current.getBoundingClientRect();
                  const cx = rect.left + rect.width / 2;
                  const cy = rect.top + rect.height / 2;
                  interactionRef.current = {
                    mode: "rotate",
                    startX: e.clientX,
                    startY: e.clientY,
                    startTransform: { ...artTransform },
                    centerX: cx,
                    centerY: cy,
                    startAngle: Math.atan2(e.clientY - cy, e.clientX - cx)
                  };
                }}
                aria-label="Rotate artwork"
              />
              {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as HandleId[]).map(
                (handle) => (
                  <button
                    key={handle}
                    className={`transform-handle ${handle}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (!artBoundsRef.current) return;
                  const rect = artBoundsRef.current.getBoundingClientRect();
                  const cx = rect.left + rect.width / 2;
                  const cy = rect.top + rect.height / 2;
                  const dx = e.clientX - cx;
                  const dy = e.clientY - cy;
                  const rad = (artTransform.rotation * Math.PI) / 180;
                  const c = Math.cos(rad);
                  const s = Math.sin(rad);
                  const startLocalX = dx * c + dy * s;
                  const startLocalY = -dx * s + dy * c;
                  interactionRef.current = {
                    mode: "scale",
                    startX: e.clientX,
                    startY: e.clientY,
                    startTransform: { ...artTransform },
                    centerX: cx,
                    centerY: cy,
                    startLocalX,
                    startLocalY,
                    handle
                  };
                }}
                    aria-label={`Resize ${handle}`}
                  />
                )
              )}
            </div>
          ) : null}
              </>
            );
          })()}
          {canvasTab === "preview" && gcodeStrokes.length > 0 && svgSize ? (
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
          {canvasTab === "preview" && preview.length > 0 && svgSize ? (
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
        {!svgMarkup ? (
          <div className="canvas-empty-note">
            Import a file and run the pipeline to generate a preview.
          </div>
        ) : null}
      </div>
      </div>
      {projectRoot ? createPortal(projectPanel, projectRoot) : null}
      {inspectorRoot ? createPortal(inspectorPanel, inspectorRoot) : null}
    </>
  );
}
