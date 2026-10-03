export function Sparkline({ values, label, colorVariable = "--blue-500", width = 96, height = 28 }: { readonly values: readonly number[]; readonly label: string; readonly colorVariable?: string; readonly width?: number; readonly height?: number }) {
  if (values.length < 2) return null;
  const largestValue = Math.max(...values);
  const smallestValue = Math.min(...values);
  const range = largestValue - smallestValue || 1;
  const path = values
    .map((value, index) => `${index === 0 ? "M" : "L"}${((index / (values.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((value - smallestValue) / range) * (height - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={path} fill="none" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: `var(${colorVariable})` }} />
    </svg>
  );
}
