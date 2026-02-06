export type MachineConfig = {
  width: number;
  height: number;
  unit: "mm" | "in";
};

export type ArtTransform = {
  xMm: number;
  yMm: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
};

export type BedMetrics = {
  bedW: number;
  bedH: number;
  bedX: number;
  bedY: number;
  bedCx: number;
  bedCy: number;
  pxPerMm: number;
  widthMm: number;
  heightMm: number;
};

export const getUnitFactor = (unit: MachineConfig["unit"]) => (unit === "mm" ? 1 : 25.4);

export const getMachineMm = (machine: MachineConfig) => ({
  widthMm: machine.width * getUnitFactor(machine.unit),
  heightMm: machine.height * getUnitFactor(machine.unit)
});

export const getBedMetrics = (
  stageWidth: number,
  stageHeight: number,
  machine: MachineConfig
): BedMetrics => {
  const { widthMm, heightMm } = getMachineMm(machine);
  const ratio = widthMm / Math.max(heightMm, 1e-6);
  const maxW = stageWidth * 0.7;
  const maxH = stageHeight * 0.7;
  let bedW = maxW;
  let bedH = bedW / Math.max(ratio, 1e-6);
  if (bedH > maxH) {
    bedH = maxH;
    bedW = bedH * ratio;
  }
  const bedX = (stageWidth - bedW) / 2;
  const bedY = (stageHeight - bedH) / 2;
  return {
    bedW,
    bedH,
    bedX,
    bedY,
    bedCx: bedX + bedW / 2,
    bedCy: bedY + bedH / 2,
    pxPerMm: bedW / Math.max(widthMm, 1e-6),
    widthMm,
    heightMm
  };
};

export const getBaseScale = (
  artWidth: number,
  artHeight: number,
  bedW: number,
  bedH: number
) => Math.min(bedW / Math.max(1, artWidth), bedH / Math.max(1, artHeight));

export const isTransformInsideWorkArea = (
  candidate: ArtTransform,
  opts: {
    artWidth: number;
    artHeight: number;
    baseScale: number;
    pxPerMm: number;
    bedW: number;
    bedH: number;
  }
) => {
  const artW = opts.artWidth * opts.baseScale * candidate.scaleX;
  const artH = opts.artHeight * opts.baseScale * candidate.scaleY;
  const tx = candidate.xMm * opts.pxPerMm;
  const ty = candidate.yMm * opts.pxPerMm;
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
    if (Math.abs(rx) > opts.bedW / 2 || Math.abs(ry) > opts.bedH / 2) {
      return false;
    }
  }
  return true;
};

export const snapValue = (value: number, step: number) =>
  step > 0 ? Math.round(value / step) * step : value;
