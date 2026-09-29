export function calculateNiceAxisMaximum(maximumValue: number, tickCount: number): { axisMaximum: number; tickStep: number } {
  if (maximumValue <= 0) return { axisMaximum: tickCount, tickStep: 1 };
  const roughStep = maximumValue / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalisedStep = roughStep / magnitude;
  const niceNormalisedStep = normalisedStep <= 1 ? 1 : normalisedStep <= 2 ? 2 : normalisedStep <= 2.5 ? 2.5 : normalisedStep <= 5 ? 5 : 10;
  const tickStep = niceNormalisedStep * magnitude;
  return { axisMaximum: tickStep * Math.ceil(maximumValue / tickStep), tickStep };
}

export function listAxisTickValues(axisMaximum: number, tickStep: number): number[] {
  const ticks: number[] = [];
  for (let tick = 0; tick <= axisMaximum + tickStep / 2; tick += tickStep) ticks.push(tick);
  return ticks;
}

export function formatShortDateLabel(dateKey: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00.000Z`));
}
