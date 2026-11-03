import assert from "node:assert/strict";
import test from "node:test";

import { buildSellerSalesChart, sellerSalesXAxisIndices } from "./sellerSalesSeries.util";

test("seller sales chart preserves backend labels and minor-unit values while scaling bars", () => {
  const chart = buildSellerSalesChart([
    { label: "09:00", value: 125_000 },
    { label: "10:00", value: 0 },
    { label: "11:00", value: 250_000 },
  ]);

  assert.deepEqual(chart.points.map(({ label, value }) => ({ label, value })), [
    { label: "09:00", value: 125_000 },
    { label: "10:00", value: 0 },
    { label: "11:00", value: 250_000 },
  ]);
  assert.equal(chart.points[2]?.height, 158);
  assert.equal(chart.points[1]?.height, 0);
  assert.equal(chart.hasSales, true);
  assert.deepEqual(chart.ticks.map((tick) => tick.value), [250_000, 187_500, 125_000, 62_500, 0]);
});

test("empty and zero-valued seller periods expose no fabricated sales", () => {
  assert.deepEqual(buildSellerSalesChart([]), {
    points: [],
    ticks: [18, 57.5, 97, 136.5, 176].map((y) => ({ value: 0, y })),
    baselineY: 176,
    hasSales: false,
  });
  assert.equal(buildSellerSalesChart([{ label: "Today", value: 0 }]).hasSales, false);
});

test("seller sales chart supports negative series values without dropping data", () => {
  const chart = buildSellerSalesChart([{ label: "Earlier", value: -100 }, { label: "Now", value: 100 }]);
  assert.deepEqual(chart.points.map((point) => point.value), [-100, 100]);
  assert.equal(chart.baselineY, 97);
  assert.equal(chart.hasSales, true);
});

test("seller sales x-axis keeps labels sparse and stable", () => {
  assert.deepEqual(sellerSalesXAxisIndices(0), []);
  assert.deepEqual(sellerSalesXAxisIndices(1), [0]);
  assert.deepEqual(sellerSalesXAxisIndices(24), [0, 8, 15, 23]);
});
