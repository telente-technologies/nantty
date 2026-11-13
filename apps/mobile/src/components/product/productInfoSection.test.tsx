import { fireEvent, render, screen } from "@testing-library/react-native";

import { ProductInfoSection } from "./productInfoSection";

jest.mock("@/theme", () => ({
  useTheme: () => ({ colors: { textMuted: "muted", textSubtle: "subtle" } }),
  makeThemedStyles: (factory: (colors: Record<string, string>) => unknown) => () => factory({ divider: "divider" }),
}));

jest.mock("@/components/icons", () => ({ CaretDown24Icon: () => null }));
jest.mock("@/components/mentions/mentionText", () => ({
  MentionText: ({ text }: { readonly text: string }) => {
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
    return <Text>{text}</Text>;
  },
}));

describe("ProductInfoSection", () => {
  it("shows the logistics note below seller shipping information", async () => {
    await render(
      <ProductInfoSection
        title="Shipping & returns"
        body="Ships in 2–4 working days."
        note="Delivery availability and the final shipping cost are confirmed for your delivery address at checkout. Review the quote before paying."
      />,
    );

    expect(screen.getByText("Ships in 2–4 working days.")).toBeTruthy();
    expect(screen.getByText(/Delivery availability and the final shipping cost/)).toBeTruthy();
  });

  it("keeps the note inside the description disclosure when collapsed", async () => {
    await render(
      <ProductInfoSection title="Description" body="Handmade locally." note="Read more details below." collapsible />,
    );

    expect(screen.getByText("Read more details below.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Description" }));
    expect(screen.queryByText("Read more details below.")).toBeNull();
  });
});
