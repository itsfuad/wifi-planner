import React, { useMemo } from "react";
import { Image } from "react-konva";
import type { SimulationResponse } from "../sim/worker";
interface Props {
  data: SimulationResponse;
  opacity?: number;
}
const stops = [
  { at: -90, rgb: [139, 92, 246] },
  { at: -80, rgb: [59, 130, 246] },
  { at: -70, rgb: [6, 182, 212] },
  { at: -60, rgb: [34, 197, 94] },
  { at: -45, rgb: [163, 230, 53] },
] as const;
const color = (rssi: number) => {
  if (rssi <= -95) return [100, 116, 139, 0] as const;
  const c = Math.max(stops[0].at, Math.min(stops[stops.length - 1].at, rssi));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i],
      b = stops[i + 1];
    if (c >= a.at && c <= b.at) {
      const t = (c - a.at) / (b.at - a.at);
      return [
        Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t),
        Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t),
        Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t),
        255,
      ] as const;
    }
  }
  return [163, 230, 53, 255] as const;
};
export const Heatmap: React.FC<Props> = ({ data, opacity = 0.56 }) => {
  const canvas = useMemo(() => {
    const s = document.createElement("canvas");
    s.width = data.width;
    s.height = data.height;
    const ctx = s.getContext("2d");
    if (!ctx) return null;
    const img = ctx.createImageData(data.width, data.height);
    for (let i = 0; i < data.data.length; i++) {
      const [r, g, b, a] = color(data.data[i]),
        o = i * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
    return s;
  }, [data]);
  return canvas ? (
    <Image
      image={canvas}
      width={data.width * data.resolution}
      height={data.height * data.resolution}
      opacity={opacity}
      listening={false}
      perfectDrawEnabled={false}
    />
  ) : null;
};
