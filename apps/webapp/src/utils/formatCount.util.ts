const COMPACT_STEPS = [
  [1_000_000_000, "B"],
  [1_000_000, "M"],
  [1_000, "K"],
] as const;

export function formatCompactCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  const whole = Math.floor(n);
  const step = COMPACT_STEPS.find(([divisor]) => whole >= divisor);
  if (!step) return String(whole);
  const [divisor, suffix] = step;
  const tenths = Math.floor(whole / (divisor / 10));
  const rounded = tenths >= 1000 ? Math.floor(tenths / 10) : tenths / 10;
  return `${String(rounded).replace(/\.0$/, "")}${suffix}`;
}

export function formatTaggedPeopleSummary(firstName: string, total: number): string {
  const others = total - 1;
  if (others <= 0) return firstName;
  return `${firstName} and ${formatCompactCount(others)} ${others === 1 ? "other" : "others"}`;
}
