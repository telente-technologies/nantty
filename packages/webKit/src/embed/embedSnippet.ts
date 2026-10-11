export type EmbedSnippetKind = "store" | "products" | "button";
export type EmbedSnippetTheme = "light" | "dark";
export type EmbedSnippetLayout = "grid" | "carousel";
export type EmbedSnippetSize = "small" | "medium" | "large";

export interface EmbedSnippetOptions {
  readonly origin: string;
  readonly kind: EmbedSnippetKind;
  readonly storeId: string;
  readonly productId?: string;
  readonly theme: EmbedSnippetTheme;
  readonly layout?: EmbedSnippetLayout;
  readonly size?: EmbedSnippetSize;
  readonly productIds?: readonly string[];
}

const attributeValue = (value: string) => value.replace(/[&"<>]/g, (character) => `&#${character.charCodeAt(0)};`);

export function buildEmbedSnippet(options: EmbedSnippetOptions): string {
  const attributes: [string, string][] = [["class", "zudomart-embed"], ["data-type", options.kind]];
  if (options.kind === "button") attributes.push(["data-product", options.productId ?? ""]);
  else attributes.push(["data-store", options.storeId]);
  attributes.push(["data-theme", options.theme]);
  if (options.kind === "products" && options.layout !== undefined) attributes.push(["data-layout", options.layout]);
  if (options.kind === "products" && options.productIds !== undefined && options.productIds.length > 0) attributes.push(["data-products", options.productIds.join(",")]);
  if (options.size !== undefined && options.kind !== "button") attributes.push(["data-size", options.size]);
  const element = `<div ${attributes.map(([name, value]) => `${name}="${attributeValue(value)}"`).join(" ")}></div>`;
  return `${element}\n<script async src="${attributeValue(options.origin)}/embed/loader.js"></script>`;
}

export function buildEmbedFrameUrl(options: EmbedSnippetOptions, frame = "preview0000"): string {
  const query = new URLSearchParams({ theme: options.theme });
  if (options.kind === "products" && options.layout !== undefined) query.set("layout", options.layout);
  if (options.kind === "products" && options.productIds !== undefined && options.productIds.length > 0) query.set("products", options.productIds.join(","));
  if (options.size !== undefined && options.kind !== "button") query.set("size", options.size);
  if (options.kind === "button") query.set("view", "button");
  const kind = options.kind === "button" ? "product" : options.kind;
  const id = options.kind === "button" ? (options.productId ?? "") : options.storeId;
  return `${options.origin}/embed/${kind}/${encodeURIComponent(id)}?${query.toString()}#frame=${frame}`;
}

export const embedPreviewSandbox = "allow-scripts allow-popups allow-popups-to-escape-sandbox";
