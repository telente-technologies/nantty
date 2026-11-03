export interface SellerSalesSeriesValue {
  readonly label: string;
  readonly value: number;
}

export interface SellerSalesChartPoint extends SellerSalesSeriesValue {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SellerSalesChartModel {
  readonly points: readonly SellerSalesChartPoint[];
  readonly ticks: readonly { readonly value: number; readonly y: number }[];
  readonly baselineY: number;
  readonly hasSales: boolean;
}

const CHART_WIDTH = 720;
const PLOT_TOP = 18;
const PLOT_BOTTOM = 176;
const PLOT_LEFT = 76;
const PLOT_RIGHT = 12;
const TICK_COUNT = 4;

export function buildSellerSalesChart(series: readonly SellerSalesSeriesValue[]): SellerSalesChartModel {
  const values = series.map(({ value }) => Number.isFinite(value) ? value : 0);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const hasSales = values.some((value) => value !== 0);
  const range = maximum - minimum || 1;
  const plotHeight = PLOT_BOTTOM - PLOT_TOP;
  const baselineY = hasSales ? PLOT_TOP + (maximum / range) * plotHeight : PLOT_BOTTOM;
  const plotWidth = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  const slotWidth = series.length ? plotWidth / series.length : 0;
  const points = series.map((point, index) => {
    const value = Number.isFinite(point.value) ? point.value : 0;
    const valueY = hasSales ? PLOT_TOP + ((maximum - value) / range) * plotHeight : baselineY;
    return {
      label: point.label,
      value,
      x: PLOT_LEFT + index * slotWidth + slotWidth * 0.18,
      y: Math.min(valueY, baselineY),
      width: slotWidth * 0.64,
      height: Math.abs(baselineY - valueY),
    };
  });
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, index) => {
    const fraction = index / TICK_COUNT;
    return {
      value: hasSales ? Math.round(maximum - fraction * range) : 0,
      y: PLOT_TOP + fraction * plotHeight,
    };
  });

  return { points, ticks, baselineY, hasSales };
}

export function sellerSalesXAxisIndices(length: number): readonly number[] {
  if (length <= 1) return length === 1 ? [0] : [];
  return [...new Set([0, Math.round((length - 1) / 3), Math.round((length - 1) * 2 / 3), length - 1])];
}
