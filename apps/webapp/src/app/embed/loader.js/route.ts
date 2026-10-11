import { buildEmbedLoaderScript, readEmbedSiteOrigin } from "@/utils/embedLoader.util";

export function GET(): Response {
  return new Response(buildEmbedLoaderScript(readEmbedSiteOrigin()), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
