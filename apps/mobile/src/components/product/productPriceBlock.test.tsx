import { render, screen } from "@testing-library/react-native";

import type { Product } from "@/types";

import { ProductPriceBlock } from "./productPriceBlock";

jest.mock("@/components/icons", () => ({
  BookmarkFill24Icon: () => null,
  BookmarkSimple24Icon: () => null,
  Share24Icon: () => null,
  Star16Icon: () => null,
}));
jest.mock("@/theme", () => ({ useTheme: () => ({ colors: { primary: "brand", textMuted: "muted" } }) }));
jest.mock("./moneyAmount", () => ({ MoneyAmount: () => null }));
jest.mock("./productCard", () => ({ SponsoredLabel: () => null }));

const product = { id: "product-1", title: "Sample product", rating: 0, price: { amountMinor: 1000, currency: "NGN" }, sponsored: null } as Product;

describe("ProductPriceBlock", () => {
  it("labels an unrated product as new and keeps the reviews action accessible", async () => {
    await render(
      <ProductPriceBlock
        product={product}
        bookmarked={false}
        saveCount={0}
        onShare={() => undefined}
        onToggleBookmark={() => undefined}
        onPressRating={() => undefined}
      />,
    );

    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByRole("button", { name: "No ratings yet, see reviews" })).toBeTruthy();
  });
});
