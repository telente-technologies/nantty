import { createElement } from "react";
import { render, screen } from "@testing-library/react-native";

import { SalesChart } from "@/components/seller/salesChart";

jest.mock("@/theme", () => {
  const colors = { primary: "#304FFE", skeleton: "#E6E8EF", surface: "#FFFFFF", textSubtle: "#667085" };
  return {
    makeThemedStyles: (createStyles: (themeColors: typeof colors) => unknown) => () => createStyles(colors),
    useTheme: () => ({ colors, scheme: "light", isDark: false }),
  };
});

describe("SalesChart", () => {
  test("uses server period labels and store currency instead of fixed sample axes", async () => {
    await render(createElement(SalesChart, {
      series: [{ label: "2026-11-01", value: 12_500 }, { label: "2026-11-02", value: 25_000 }],
      totalSales: { amountMinor: 37_500, currency: "NGN" },
    }));

    expect(screen.getByText("2026-11-01")).toBeTruthy();
    expect(screen.getByText("2026-11-02")).toBeTruthy();
    expect(screen.queryByText("12 AM")).toBeNull();
    expect(screen.getByLabelText(/Sales chart for 2 time periods in NGN/)).toBeTruthy();
  });
});
