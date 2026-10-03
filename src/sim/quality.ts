export type SignalGrade = "excellent" | "good" | "fair" | "poor" | "dead";
export const getSignalGrade = (rssi: number): SignalGrade =>
  rssi >= -55
    ? "excellent"
    : rssi >= -67
      ? "good"
      : rssi >= -75
        ? "fair"
        : rssi >= -85
          ? "poor"
          : "dead";
export const estimateThroughputMbps = (
  rssi: number,
  band: 2.4 | 5 | 6 = 5,
): number => {
  const ceiling = band === 2.4 ? 120 : band === 5 ? 600 : 900;
  if (rssi <= -88) return 0;
  if (rssi >= -48) return ceiling;
  const n = Math.max(0, Math.min(1, (rssi + 88) / 40));
  return Math.round(ceiling * Math.pow(n, 2.15));
};
