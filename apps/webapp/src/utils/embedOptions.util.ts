export const embedKinds = ["store", "products", "product"] as const;
export type EmbedKind = (typeof embedKinds)[number];
export type EmbedTheme = "light" | "dark";
export type EmbedLayout = "grid" | "carousel";
export type EmbedSize = "small" | "medium" | "large";
export type EmbedProductView = "button" | "card";

export interface EmbedOptions {
  readonly kind: EmbedKind;
  readonly id: string;
  readonly theme: EmbedTheme;
  readonly layout: EmbedLayout;
  readonly size: EmbedSize;
  readonly limit: number;
  readonly productIds: readonly string[];
  readonly view: EmbedProductView;
}

const embedIdPattern = /^[A-Za-z0-9_.~-]{1,100}$/;
const maximumSelectedProducts = 12;

function pick<Value extends string>(value: string | null, allowed: readonly Value[], fallback: Value): Value {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as Value) : fallback;
}

export function isEmbedKind(value: string): value is EmbedKind {
  return (embedKinds as readonly string[]).includes(value);
}

export function parseEmbedOptions(kind: string, id: string, query: URLSearchParams): EmbedOptions | null {
  if (!isEmbedKind(kind) || !embedIdPattern.test(id)) return null;
  const size = pick(query.get("size"), ["small", "medium", "large"] as const, "medium");
  const requestedLimit = Number.parseInt(query.get("limit") ?? "", 10);
  const defaultLimit = { small: 3, medium: 6, large: 9 }[size];
  const productIds = (query.get("products") ?? "").split(",").map((value) => value.trim()).filter((value) => embedIdPattern.test(value)).slice(0, maximumSelectedProducts);
  return {
    kind, id, size, productIds,
    theme: pick(query.get("theme"), ["light", "dark"] as const, "light"),
    layout: pick(query.get("layout"), ["grid", "carousel"] as const, "grid"),
    view: pick(query.get("view"), ["button", "card"] as const, "card"),
    limit: Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), maximumSelectedProducts) : defaultLimit,
  };
}

export function embedCacheKey(options: EmbedOptions): string {
  return [options.kind, options.id, options.theme, options.layout, options.size, options.limit, options.view, options.productIds.join(",")].join("|");
}

export function buildEmbedFramePath(options: Pick<EmbedOptions, "kind" | "id"> & Partial<EmbedOptions>): string {
  const query = new URLSearchParams();
  if (options.theme !== undefined) query.set("theme", options.theme);
  if (options.kind === "products") {
    if (options.layout !== undefined) query.set("layout", options.layout);
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    if (options.productIds !== undefined && options.productIds.length > 0) query.set("products", options.productIds.join(","));
  }
  if (options.kind === "product" && options.view !== undefined) query.set("view", options.view);
  if (options.size !== undefined) query.set("size", options.size);
  const text = query.toString();
  return `/embed/${options.kind}/${encodeURIComponent(options.id)}${text === "" ? "" : `?${text}`}`;
}
