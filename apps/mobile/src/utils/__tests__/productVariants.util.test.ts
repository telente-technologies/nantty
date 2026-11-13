import type { ProductVariant } from "@/types/models.type";

import { findSelectedProductVariant, productPurchaseAvailability, readProductVariantGroups } from "../productVariants.util";

const variants: ProductVariant[] = [
  { id: "s-cotton", title: "Small cotton", size: "S", color: "Red", price: { amountMinor: 1000, currency: "NGN" }, inStock: true, optionValues: { Size: "S", Color: "Red", Material: "Cotton" } },
  { id: "l-cotton", title: "Large cotton", size: "L", color: "Red", price: { amountMinor: 1200, currency: "NGN" }, inStock: true, optionValues: { Size: "L", Color: "Red", Material: "Cotton" } },
  { id: "s-linen", title: "Small linen", size: "S", color: "Blue", price: { amountMinor: 1300, currency: "NGN" }, inStock: false, optionValues: { Size: "S", Color: "Blue", Material: "Linen" } },
];

describe("buyer product variants", () => {
  it("derives selectable groups without duplicating the legacy size and color fields", () => {
    expect(readProductVariantGroups(null, variants)).toEqual([{ name: "Material", options: ["Cotton", "Linen"] }]);
  });

  it("resolves the selected variant only after all required choices are made", () => {
    const groups = readProductVariantGroups(null, variants);
    const product = { sizes: ["S", "L"], colors: ["Red", "Blue"], variants };
    expect(findSelectedProductVariant(product, groups, null, "Red", { Material: "Cotton" })).toBeNull();
    expect(findSelectedProductVariant(product, groups, "L", "Red", { Material: "Cotton" })?.id).toBe("l-cotton");
  });

  it("blocks missing or invalid choices and inventory that is known to be empty", () => {
    expect(productPurchaseAvailability({ variants }, null, true)).toBe("choose_options");
    expect(productPurchaseAvailability({ variants }, null, false)).toBe("invalid_options");
    expect(productPurchaseAvailability({ stock: 0 }, null, false)).toBe("out_of_stock");
    expect(productPurchaseAvailability({ stock: 0 }, variants[0]!, false)).toBe("available");
    expect(productPurchaseAvailability({ stock: 4 }, variants[2]!, false)).toBe("out_of_stock");
  });
});
