import type { ProductVariant, ProductVariantGroup } from "@/types/models.type";

export type ProductPurchaseAvailability = "available" | "choose_options" | "invalid_options" | "out_of_stock";

export function productPurchaseAvailability(
  product: { readonly stock?: number; readonly variants?: readonly ProductVariant[] | null },
  selectedVariant: ProductVariant | null,
  needsOptionChoice: boolean,
): ProductPurchaseAvailability {
  if (needsOptionChoice) return "choose_options";
  if ((product.variants?.length ?? 0) > 0 && !selectedVariant) return "invalid_options";
  if (selectedVariant ? !selectedVariant.inStock : product.stock === 0) return "out_of_stock";
  return "available";
}

export function readProductVariantGroups(
  declaredGroups: readonly ProductVariantGroup[] | null | undefined,
  variants: readonly ProductVariant[] | null | undefined,
): ProductVariantGroup[] {
  if (declaredGroups?.length) return [...declaredGroups];

  const groups = new Map<string, string[]>();
  for (const variant of variants ?? []) {
    for (const [name, value] of Object.entries(variant.optionValues ?? {})) {
      const normalizedName = name.trim();
      if (!normalizedName || /^(size|colou?r)$/i.test(normalizedName) || !value.trim()) continue;
      const options = groups.get(normalizedName) ?? [];
      if (!options.includes(value)) options.push(value);
      groups.set(normalizedName, options);
    }
  }
  return [...groups].map(([name, options]) => ({ name, options }));
}

export function findSelectedProductVariant(
  product: {
    readonly sizes: readonly string[];
    readonly colors: readonly string[];
    readonly variants?: readonly ProductVariant[] | null;
  },
  groups: readonly ProductVariantGroup[],
  size: string | null,
  color: string | null,
  selections: Readonly<Record<string, string>>,
): ProductVariant | null {
  const variants = product.variants ?? [];
  if (variants.length === 0) return null;
  if (product.sizes.length > 0 && !size) return null;
  if (product.colors.length > 0 && !color) return null;
  if (groups.some((group) => !selections[group.name])) return null;

  const matches = variants.filter((variant) => {
    if (size && variant.size !== size) return false;
    if (color && variant.color !== color) return false;
    return groups.every((group) => variant.optionValues?.[group.name] === selections[group.name]);
  });
  return matches.length === 1 ? matches[0]! : null;
}
