import type { ProductSummary } from "@/types";
import { renderBuyButtonMarkup, renderEmbedDocument, renderProductCollectionMarkup, renderStoreCardMarkup, renderUnavailableMarkup, embedResizeScript, type EmbedProductCard } from "@/utils/embedMarkup.util";
import { embedCacheKey, parseEmbedOptions, type EmbedOptions, type EmbedTheme } from "@/utils/embedOptions.util";
import { buildEmbedResponseHeaders, EmbedRateLimiter, EmbedResponseCache } from "@/utils/embedSecurity.util";
import { buildAbsoluteSiteUrl, buildProductPath, buildStorePath } from "@/utils/seoPaths.util";
import { isProductInStock } from "@/utils/structuredData.util";

import { fetchPublicProduct, fetchPublicStore, fetchPublicStoreProducts } from "../publicContent.service";

const embedCacheSeconds = 300;
const unavailableCacheSeconds = 60;
const embedRequestsPerMinutePerClient = 120;
const unavailableMessage = "This store isn't available on Zudomart right now.";

const rateLimiter = new EmbedRateLimiter(embedRequestsPerMinutePerClient);
const renderedEmbeds = new EmbedResponseCache(embedCacheSeconds * 1000);

interface RenderedEmbed {
  readonly body: string;
  readonly status: number;
}

function htmlResponse(rendered: RenderedEmbed, cacheSeconds: number): Response {
  return new Response(rendered.body, { status: rendered.status, headers: buildEmbedResponseHeaders(embedResizeScript, cacheSeconds) });
}

function unavailable(theme: EmbedTheme, message = unavailableMessage): RenderedEmbed {
  return { status: 404, body: renderEmbedDocument("Zudomart", theme, renderUnavailableMarkup(message)) };
}

function toProductCard(product: Pick<ProductSummary, "id" | "name" | "price" | "imageUrl" | "stock">): EmbedProductCard {
  return { name: product.name, price: product.price, imageUrl: product.imageUrl, inStock: isProductInStock(product), url: buildAbsoluteSiteUrl(buildProductPath(product)) };
}

async function renderStore(options: EmbedOptions): Promise<RenderedEmbed> {
  const store = await fetchPublicStore(options.id);
  if (store === null) return unavailable(options.theme);
  const card = { name: store.name, handle: store.handle, logoUrl: store.logoUrl, bio: store.bio ?? "", verified: store.verified, productsCount: store.productsCount, url: buildAbsoluteSiteUrl(buildStorePath(store.id)) };
  return { status: 200, body: renderEmbedDocument(store.name, options.theme, renderStoreCardMarkup(card)) };
}

async function renderProducts(options: EmbedOptions): Promise<RenderedEmbed> {
  const store = await fetchPublicStore(options.id);
  if (store === null) return unavailable(options.theme);
  const listed = await fetchPublicStoreProducts(store.id);
  const chosen = options.productIds.length > 0
    ? options.productIds.flatMap((id) => listed.filter((product) => product.id === id))
    : listed.filter((product) => isProductInStock(product));
  const markup = renderProductCollectionMarkup(chosen.slice(0, options.limit).map(toProductCard), options.layout, store.name, buildAbsoluteSiteUrl(buildStorePath(store.id)));
  return { status: 200, body: renderEmbedDocument(`${store.name} on Zudomart`, options.theme, markup) };
}

async function renderProduct(options: EmbedOptions): Promise<RenderedEmbed> {
  const product = await fetchPublicProduct(options.id);
  if (product === null) return unavailable(options.theme, "This product isn't available on Zudomart right now.");
  const store = await fetchPublicStore(product.store.id);
  if (store === null) return unavailable(options.theme);
  const card = toProductCard({ ...product, name: product.name ?? product.title, imageUrl: product.imageUrl ?? product.images[0] ?? null });
  return { status: 200, body: renderEmbedDocument(card.name, options.theme, renderBuyButtonMarkup(card, options.view)) };
}

export async function respondWithEmbed(kind: string, id: string, query: URLSearchParams, clientKey: string): Promise<Response> {
  const options = parseEmbedOptions(kind, id, query);
  const theme: EmbedTheme = query.get("theme") === "dark" ? "dark" : "light";
  if (!rateLimiter.allow(clientKey)) {
    const limited = htmlResponse({ status: 429, body: renderEmbedDocument("Zudomart", theme, renderUnavailableMarkup("Too many requests. Try again shortly.")) }, 0);
    limited.headers.set("Retry-After", "60");
    return limited;
  }
  if (options === null) return htmlResponse(unavailable(theme, "This embed link isn't valid."), unavailableCacheSeconds);
  const cacheKey = embedCacheKey(options);
  const cached = renderedEmbeds.read(cacheKey);
  if (cached !== null) return htmlResponse(cached, cached.status === 200 ? embedCacheSeconds : unavailableCacheSeconds);
  const rendered = options.kind === "store" ? await renderStore(options) : options.kind === "products" ? await renderProducts(options) : await renderProduct(options);
  renderedEmbeds.write(cacheKey, rendered.body, rendered.status);
  return htmlResponse(rendered, rendered.status === 200 ? embedCacheSeconds : unavailableCacheSeconds);
}
