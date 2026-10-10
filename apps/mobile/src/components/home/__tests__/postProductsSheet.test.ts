import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { PostProductsSheet } from "@/components/home/postProductsSheet";
import type { ProductSummary } from "@/types";

jest.setTimeout(30_000);

jest.mock("@/components/ui/bottomSheet", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return { BottomSheet: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children) };
});

const product = (id: string, name: string): ProductSummary => ({
  id,
  name,
  price: { amountMinor: 2500, currency: "NGN" },
  imageUrl: null,
  hasVariants: false,
  variantGroups: [],
});

test("each product row offers its own add-to-cart button", async () => {
  const onAddProduct = jest.fn();
  const onAddAllToCart = jest.fn();
  await render(
    createElement(PostProductsSheet, {
      products: [product("pr_a", "Alpha"), product("pr_b", "Beta")],
      onClose: jest.fn(),
      onPressProduct: jest.fn(),
      onAddProduct,
      onAddAllToCart,
    }),
  );
  await fireEvent.press(screen.getByLabelText("Add Alpha to cart"));
  expect(onAddProduct).toHaveBeenCalledWith(expect.objectContaining({ id: "pr_a" }));
  expect(onAddAllToCart).not.toHaveBeenCalled();
});

test("add-all only appears for multi-product posts", async () => {
  const onAddAllToCart = jest.fn();
  const { unmount } = await render(
    createElement(PostProductsSheet, {
      products: [product("pr_a", "Alpha")],
      onClose: jest.fn(),
      onPressProduct: jest.fn(),
      onAddProduct: jest.fn(),
      onAddAllToCart,
    }),
  );
  expect(screen.queryByText("Add all to Cart")).toBeNull();
  await unmount();
  await render(
    createElement(PostProductsSheet, {
      products: [product("pr_a", "Alpha"), product("pr_b", "Beta")],
      onClose: jest.fn(),
      onPressProduct: jest.fn(),
      onAddProduct: jest.fn(),
      onAddAllToCart,
    }),
  );
  await fireEvent.press(screen.getByText("Add all to Cart"));
  expect(onAddAllToCart).toHaveBeenCalledTimes(1);
});
