export function computeNiceAxisTicksFromZero(maximumValue: number, desiredTickCount = 4): number[] {
  if (!Number.isFinite(maximumValue) || maximumValue <= 0) return [0, 1];
  const roughStep = maximumValue / desiredTickCount;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceStep = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;
  const ticks: number[] = [];
  for (let tick = 0; tick <= maximumValue + niceStep * 0.001; tick += niceStep) ticks.push(tick);
  if ((ticks[ticks.length - 1] ?? 0) < maximumValue) ticks.push(ticks.length * niceStep);
  return ticks;
}

export function pickEvenlySpacedIndexes(length: number, maximumLabels: number): number[] {
  if (length <= maximumLabels) return Array.from({ length }, (_, index) => index);
  const step = (length - 1) / (maximumLabels - 1);
  return Array.from({ length: maximumLabels }, (_, index) => Math.round(index * step));
}
