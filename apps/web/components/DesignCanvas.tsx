"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Transformer } from "react-konva";
import useImage from "use-image";
import {
  type ArtTransform,
  type MachineConfig,
  getBaseScale,
  getBedMetrics,
  snapValue
} from "../lib/canvas-transform";
import { type ArtTransformAction } from "../lib/use-art-transform";

type Props = {
  isActive: boolean;
  svgMarkup: string | null;
  machine: MachineConfig;
  artTransform: ArtTransform;
  onTransformAction: (action: ArtTransformAction) => void;
  showGrid: boolean;
  gridStepMm: number;
  snapToGrid: boolean;
  snapStepMm: number;
  onBaseScaleChange: (scale: number) => void;
  view: { x: number; y: number; scale: number };
  onViewChange: (view: { x: number; y: number; scale: number }) => void;
  onCursorChange: (cursor: { xMm: number; yMm: number } | null) => void;
  rotateNudgeMode: boolean;
  onRotateNudgeModeChange: (next: boolean) => void;
};

export default function DesignCanvas({
  isActive,
  svgMarkup,
  machine,
  artTransform,
  onTransformAction,
  showGrid,
  gridStepMm,
  snapToGrid,
  snapStepMm,
  onBaseScaleChange,
  view,
  onViewChange,
  onCursorChange,
  rotateNudgeMode,
  onRotateNudgeModeChange
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const [stageSize, setStageSize] = useState({ width: 300, height: 300 });
  const [selected, setSelected] = useState(false);
  const [panning, setPanning] = useState(false);
  const [lastPointer, setLastPointer] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setStageSize({
        width: Math.max(10, Math.floor(rect.width)),
        height: Math.max(10, Math.floor(rect.height))
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const imageSrc = useMemo(() => {
    if (!svgMarkup) return "";
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  }, [svgMarkup]);
  const [image] = useImage(imageSrc);

  const { bedW, bedH, bedX, bedY, bedCx, bedCy, pxPerMm, widthMm, heightMm } = getBedMetrics(
    stageSize.width,
    stageSize.height,
    machine
  );

  const baseScale = image ? getBaseScale(image.width, image.height, bedW, bedH) : 1;

  useEffect(() => {
    // Keep a consistent initial "fit and centered" camera when content or bed changes.
    onViewChange({ x: 0, y: 0, scale: 1 });
  }, [svgMarkup, machine.width, machine.height, machine.unit, onViewChange]);

  const updateCursorFromPointer = (point: { x: number; y: number } | null) => {
    if (!point) {
      onCursorChange(null);
      return;
    }
    const sceneX = (point.x - view.x) / Math.max(view.scale, 1e-6);
    const sceneY = (point.y - view.y) / Math.max(view.scale, 1e-6);
    const xMm = (sceneX - bedCx) / pxPerMm;
    const yMm = (sceneY - bedCy) / pxPerMm;
    if (Math.abs(xMm) > widthMm / 2 || Math.abs(yMm) > heightMm / 2) {
      onCursorChange(null);
      return;
    }
    onCursorChange({ xMm, yMm });
  };

  useEffect(() => {
    onBaseScaleChange(baseScale);
  }, [baseScale, onBaseScaleChange]);

  useEffect(() => {
    if (!selected || !transformerRef.current || !imageRef.current) return;
    transformerRef.current.nodes([imageRef.current]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selected, image, artTransform]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isActive) return;
      if (!image) return;
      if (event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) {
        return;
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        onRotateNudgeModeChange(!rotateNudgeMode);
        return;
      }

      const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key);
      if (!isArrow) return;
      event.preventDefault();

      if (rotateNudgeMode) {
        const rotateStep = event.shiftKey ? 5 : 1;
        const scaleStep = event.shiftKey ? 0.1 : 0.02;
        if (event.key === "ArrowLeft") {
          onTransformAction({ type: "rotate", deltaDeg: -rotateStep });
          return;
        }
        if (event.key === "ArrowRight") {
          onTransformAction({ type: "rotate", deltaDeg: rotateStep });
          return;
        }
        if (event.key === "ArrowUp") {
          onTransformAction({ type: "scaleUniform", delta: scaleStep, min: 0.05 });
          return;
        }
        if (event.key === "ArrowDown") {
          onTransformAction({ type: "scaleUniform", delta: -scaleStep, min: 0.05 });
          return;
        }
      }

      const stepMm = event.shiftKey ? 10 : event.altKey ? 0.2 : 1;
      let dxMm = 0;
      let dyMm = 0;
      if (event.key === "ArrowLeft") dxMm = -stepMm;
      if (event.key === "ArrowRight") dxMm = stepMm;
      if (event.key === "ArrowUp") dyMm = -stepMm;
      if (event.key === "ArrowDown") dyMm = stepMm;
      if (snapToGrid) {
        onTransformAction({
          type: "patch",
          value: {
            xMm: snapValue(artTransform.xMm + dxMm, snapStepMm),
            yMm: snapValue(artTransform.yMm + dyMm, snapStepMm)
          }
        });
        return;
      }
      onTransformAction({ type: "move", dxMm, dyMm });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    image,
    isActive,
    rotateNudgeMode,
    onRotateNudgeModeChange,
    onTransformAction,
    artTransform,
    snapToGrid,
    snapStepMm
  ]);

  const minorPx = Math.max(4, pxPerMm * Math.max(0.1, gridStepMm));
  const majorPx = minorPx * 5;
  const minorV = [] as number[];
  const minorH = [] as number[];
  const majorV = [] as number[];
  const majorH = [] as number[];
  if (showGrid) {
    for (let x = bedX; x <= bedX + bedW; x += minorPx) {
      minorV.push(x);
    }
    for (let y = bedY; y <= bedY + bedH; y += minorPx) {
      minorH.push(y);
    }
    for (let x = bedX; x <= bedX + bedW; x += majorPx) {
      majorV.push(x);
    }
    for (let y = bedY; y <= bedY + bedH; y += majorPx) {
      majorH.push(y);
    }
  }

  return (
    <div ref={containerRef} className="design-canvas">
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        onWheel={(e) => {
          e.evt.preventDefault();
          const pointer = e.target.getStage()?.getPointerPosition();
          if (!pointer) return;
          const oldScale = view.scale;
          const scaleBy = e.evt.deltaY > 0 ? 0.94 : 1.06;
          const nextScale = Math.max(0.2, Math.min(8, oldScale * scaleBy));
          const mousePointTo = {
            x: (pointer.x - view.x) / oldScale,
            y: (pointer.y - view.y) / oldScale
          };
          onViewChange({
            scale: nextScale,
            x: pointer.x - mousePointTo.x * nextScale,
            y: pointer.y - mousePointTo.y * nextScale
          });
          updateCursorFromPointer(pointer);
        }}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            setSelected(false);
            setPanning(true);
            setLastPointer({ x: e.evt.clientX, y: e.evt.clientY });
          }
          const pointer = e.target.getStage()?.getPointerPosition() || null;
          updateCursorFromPointer(pointer);
        }}
        onMouseMove={(e) => {
          const pointer = e.target.getStage()?.getPointerPosition() || null;
          updateCursorFromPointer(pointer);
          if (!panning || !lastPointer) return;
          const dx = e.evt.clientX - lastPointer.x;
          const dy = e.evt.clientY - lastPointer.y;
          onViewChange({ ...view, x: view.x + dx, y: view.y + dy });
          setLastPointer({ x: e.evt.clientX, y: e.evt.clientY });
        }}
        onMouseUp={() => {
          setPanning(false);
          setLastPointer(null);
        }}
        onMouseLeave={() => {
          setPanning(false);
          setLastPointer(null);
          onCursorChange(null);
        }}
      >
        <Layer>
          <Group x={view.x} y={view.y} scaleX={view.scale} scaleY={view.scale}>
            <Rect x={bedX} y={bedY} width={bedW} height={bedH} stroke="#31d0d6" strokeWidth={1} />
            {minorV.map((x) => (
              <Line
                key={`mv-${x}`}
                points={[x, bedY, x, bedY + bedH]}
                stroke="rgba(97,220,226,0.12)"
                strokeWidth={1}
              />
            ))}
            {minorH.map((y) => (
              <Line
                key={`mh-${y}`}
                points={[bedX, y, bedX + bedW, y]}
                stroke="rgba(97,220,226,0.12)"
                strokeWidth={1}
              />
            ))}
            {majorV.map((x) => (
              <Line
                key={`gv-${x}`}
                points={[x, bedY, x, bedY + bedH]}
                stroke="rgba(97,220,226,0.22)"
                strokeWidth={1}
              />
            ))}
            {majorH.map((y) => (
              <Line
                key={`gh-${y}`}
                points={[bedX, y, bedX + bedW, y]}
                stroke="rgba(97,220,226,0.22)"
                strokeWidth={1}
              />
            ))}
            {image ? (
              <KonvaImage
                ref={imageRef}
                image={image}
                x={bedCx + artTransform.xMm * pxPerMm}
                y={bedCy + artTransform.yMm * pxPerMm}
                offsetX={image.width / 2}
                offsetY={image.height / 2}
                scaleX={baseScale * artTransform.scaleX}
                scaleY={baseScale * artTransform.scaleY}
                rotation={artTransform.rotation}
                draggable
                onClick={() => setSelected(true)}
                onTap={() => setSelected(true)}
                onDragMove={(e) => {
                  const node = e.target;
                  let xMm = (node.x() - bedCx) / pxPerMm;
                  let yMm = (node.y() - bedCy) / pxPerMm;
                  if (snapToGrid) {
                    xMm = snapValue(xMm, snapStepMm);
                    yMm = snapValue(yMm, snapStepMm);
                  }
                  onTransformAction({ type: "patch", value: { xMm, yMm } });
                }}
                onTransformEnd={(e) => {
                  const node = e.target;
                  const nextScaleX = Math.max(0.05, node.scaleX() / Math.max(baseScale, 1e-6));
                  const nextScaleY = Math.max(0.05, node.scaleY() / Math.max(baseScale, 1e-6));
                  onTransformAction({
                    type: "patch",
                    value: {
                      xMm: (node.x() - bedCx) / pxPerMm,
                      yMm: (node.y() - bedCy) / pxPerMm,
                      scaleX: nextScaleX,
                      scaleY: nextScaleY,
                      rotation: node.rotation()
                    }
                  });
                }}
              />
            ) : null}
            {selected && image ? (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                enabledAnchors={[
                  "top-left",
                  "top-center",
                  "top-right",
                  "middle-left",
                  "middle-right",
                  "bottom-left",
                  "bottom-center",
                  "bottom-right"
                ]}
                anchorSize={7}
                borderDash={[4, 4]}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 8 || newBox.height < 8) return oldBox;
                  return newBox;
                }}
              />
            ) : null}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
