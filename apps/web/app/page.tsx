"use client";

import { useState } from "react";
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

  const readSvg = async (nextFile: File | null) => {
    if (!nextFile) {
      setSvgMarkup(null);
      return;
    }
    if (!nextFile.name.toLowerCase().endsWith(".svg")) {
      setSvgMarkup(null);
      return;
    }
    const text = await nextFile.text();
    setSvgMarkup(text);
  };

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
    setStatus("Building preview...");

    const previewRes = await fetch(
      `${API_BASE_URL}/api/preview/${uploadData.file_id}`
    );
    if (!previewRes.ok) {
      setStatus("Preview failed.");
      return;
    }

    const previewData = await previewRes.json();
    setPreview(previewData.frames || []);
    setMeta(previewData.meta || null);
    setStatus("Ready");
  };

  return (
    <div className="canvas-content">
      <div className="canvas-tabs">Canvas | G-code Preview</div>
      <div className="canvas-area">
        <div className="paper">Paper / Bed Outline</div>
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
          {svgMarkup ? (
            <div className="svg-preview" aria-label="SVG Preview">
              <div
                className="svg-content"
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />
            </div>
          ) : (
            <div className="svg-placeholder">
              SVG preview appears here after selecting an .svg file.
            </div>
          )}
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
