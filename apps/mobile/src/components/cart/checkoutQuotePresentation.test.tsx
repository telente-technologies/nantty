import { render, screen } from "@testing-library/react-native";

import type { Cart } from "@/types";

import { CartGrandTotalCard } from "./cartGrandTotalCard";
import { CartSellerGroupCard } from "./cartSellerGroupCard";

jest.mock("@/theme", () => ({
  useTheme: () => ({ colors: { divider: "divider", textMuted: "muted", error: "error" } }),
  makeThemedStyles: (factory: (colors: Record<string, string>) => unknown) => () => factory({ divider: "divider", error: "error" }),
}));
jest.mock("@/components/product/moneyAmount", () => ({
  MoneyAmount: ({ money }: { money: { amountMinor: number } }) => {
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
    return <Text>{String(money.amountMinor)}</Text>;
  },
}));
jest.mock("@/components/cart/cartItemRow", () => ({ CartItemRow: () => null }));
jest.mock("@/components/cart/shippingStatusLine", () => ({
  ShippingStatusLine: () => {
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
    return <Text>Quoted shipping detail</Text>;
  },
}));

const money = (amountMinor: number) => ({ amountMinor, currency: "NGN" as const });
const cart = {
  items: [],
  itemsTotal: money(3_000),
  shopDiscount: money(0),
  storeCredit: money(0),
  shipping: money(700),
  total: money(3_700),
  groups: [{
    storeId: "store_1",
    storeName: "Store one",
    items: [],
    subtotal: money(3_000),
    discounts: money(0),
    storeCredit: money(0),
    shipping: { status: "calculated", fee: money(700), message: null, isFree: false, freeThreshold: null, amountToFreeShipping: null },
    total: money(3_700),
  }],
  addressId: "address_old",
  payableGroupCount: 1,
} as Cart;

describe("checkout quote presentation", () => {
  it("does not show a previous address shipping amount or total while a fresh quote is pending", async () => {
    await render(<CartGrandTotalCard cart={cart} shippingQuoteReady={false} />);

    expect(screen.getByText("Quote pending")).toBeTruthy();
    expect(screen.getByLabelText("Total pending delivery quote")).toBeTruthy();
    expect(screen.queryByText("700")).toBeNull();
    expect(screen.queryByText("3700")).toBeNull();
  });

  it("does not show a previous address seller shipping breakdown while a fresh quote is pending", async () => {
    await render(<CartSellerGroupCard group={cart.groups[0]} showItems={false} shippingQuoteReady={false} />);

    expect(screen.getByText("Delivery total updates after the address quote is ready.")).toBeTruthy();
    expect(screen.queryByText("Quoted shipping detail")).toBeNull();
    expect(screen.queryByText("Seller total")).toBeNull();
  });

  it("explains that unavailable products must be removed before checkout", async () => {
    await render(<CartGrandTotalCard cart={{ ...cart, unavailableItemCount: 1 }} />);

    expect(screen.getByText("Remove unavailable products before checkout.")).toBeTruthy();
  });
});
