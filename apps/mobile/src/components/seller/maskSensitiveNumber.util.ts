export const maskAllButLastFourCharacters = (value: string) => {
  const compact = value.replace(/\s/g, "");
  if (compact.length <= 4) return "••••";
  return `${"•".repeat(Math.min(compact.length - 4, 8))} ${compact.slice(-4)}`;
};
