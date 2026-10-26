import { fetchPublicProduct, fetchPublicStore } from "@/server/publicContent.service";
import { readEmbedSiteOrigin } from "@/utils/embedLoader.util";
import { buildOembedIframeHtml, readOembedDimension, readOembedTarget } from "@/utils/embedOembed.util";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" };

function jsonResponse(status: number, body: unknown, cacheSeconds: number): Response {
  return Response.json(body, { status, headers: { ...corsHeaders, "Cache-Control": cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams;
  if ((query.get("format") ?? "json") !== "json") return jsonResponse(501, { message: "Only JSON is supported." }, 0);
  const origin = readEmbedSiteOrigin();
  const target = readOembedTarget(query.get("url"), origin);
  if (target === null) return jsonResponse(404, { message: "Not an embeddable Nantty link." }, 300);
  const width = readOembedDimension(query.get("maxwidth"), target.kind === "store" ? 480 : 320, 200, 1200);
  const height = target.kind === "store" ? 120 : 380;
  const product = target.kind === "product" ? await fetchPublicProduct(target.id) : null;
  const store = target.kind === "store" ? await fetchPublicStore(target.id) : product === null ? null : await fetchPublicStore(product.store.id);
  if (store === null || (target.kind === "product" && product === null)) return jsonResponse(404, { message: "This item isn't available on Nantty right now." }, 60);
  const title = product?.name ?? product?.title ?? store.name;
  const frameUrl = target.kind === "store" ? `${origin}/embed/store/${encodeURIComponent(store.id)}` : `${origin}/embed/product/${encodeURIComponent(target.id)}?view=card`;
  return jsonResponse(200, {
    version: "1.0", type: "rich", provider_name: "Nantty", provider_url: origin, title, author_name: store.name, author_url: `${origin}/store/${encodeURIComponent(store.id)}`,
    html: buildOembedIframeHtml(frameUrl, width, height, title), width, height, cache_age: 3600,
  }, 3600);
}
