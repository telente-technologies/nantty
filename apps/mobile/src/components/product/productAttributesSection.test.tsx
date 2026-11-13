import { render, screen } from "@testing-library/react-native";

import { ProductAttributesSection } from "./productAttributesSection";

jest.mock("@/theme", () => ({
  useTheme: () => ({ colors: { divider: "divider", textMuted: "muted", textSubtle: "subtle" } }),
}));

describe("ProductAttributesSection", () => {
  it("renders seller-provided specifications and omits blank values", async () => {
    await render(<ProductAttributesSection attributes={[
      { name: "Material", value: "Cotton" },
      { name: "   ", value: "ignored" },
    ]} />);

    expect(screen.getByText("Product details")).toBeTruthy();
    expect(screen.getByText("Material")).toBeTruthy();
    expect(screen.getByText("Cotton")).toBeTruthy();
    expect(screen.queryByText("ignored")).toBeNull();
  });

  it("renders nothing when there are no usable attributes", async () => {
    await render(<ProductAttributesSection attributes={[]} />);
    expect(screen.queryByText("Product details")).toBeNull();
  });
});
