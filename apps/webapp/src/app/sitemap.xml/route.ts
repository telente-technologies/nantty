import { buildSitemapIndexXml, respondWithXml } from "@/server/sitemapXml.service";

export async function GET(): Promise<Response> {
  return respondWithXml(await buildSitemapIndexXml());
}
