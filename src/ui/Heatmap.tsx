import React, { useMemo } from 'react';
import { Image } from 'react-konva';
import type { SimulationResponse } from '../sim/worker';

interface HeatmapProps {
  data: SimulationResponse;
  opacity?: number;
}

export const Heatmap: React.FC<HeatmapProps> = ({ data, opacity = 0.6 }) => {
  const canvas = useMemo(() => {
    if (!data) return null;

    const canvas = document.createElement('canvas');
    canvas.width = data.width;
    canvas.height = data.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imgData = ctx.createImageData(data.width, data.height);
    const pixels = imgData.data;

    for (let i = 0; i < data.data.length; i++) {
        const rssi = data.data[i];
        const alphaIndex = i * 4 + 3;

        if (rssi <= -90) {
            pixels[i * 4] = 0;
            pixels[i * 4 + 1] = 0;
            pixels[i * 4 + 2] = 0;
            pixels[alphaIndex] = 0;
            continue;
        }

        const min = -90;
        const max = -30;
        let t = (rssi - min) / (max - min);
        if (t < 0) t = 0;
        if (t > 1) t = 1;

        // HSL ramp: 0 (Red) to 120 (Green)
        const hue = t * 120;

        const s = 1.0;
        const l = 0.5;

        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
        const m = l - c / 2;

        let r = 0, g = 0, b = 0;

        if (0 <= hue && hue < 60) {
            r = c; g = x; b = 0;
        } else if (60 <= hue && hue < 120) {
            r = x; g = c; b = 0;
        } else if (120 <= hue && hue < 180) {
            r = 0; g = c; b = x;
        }

        pixels[i * 4] = (r + m) * 255;
        pixels[i * 4 + 1] = (g + m) * 255;
        pixels[i * 4 + 2] = (b + m) * 255;
        pixels[alphaIndex] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }, [data]);

  if (!canvas) return null;

  return (
    <Image
      image={canvas}
      width={data.width * data.resolution}
      height={data.height * data.resolution}
      opacity={opacity}
      listening={false}
    />
  );
};
