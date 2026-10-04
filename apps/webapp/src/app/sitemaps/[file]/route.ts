import { buildSitemapFileXml, respondWithXml } from "@/server/sitemapXml.service";

export async function GET(_request: Request, { params }: { readonly params: Promise<{ readonly file: string }> }): Promise<Response> {
  const { file } = await params;
  const xml = file.endsWith(".xml") ? await buildSitemapFileXml(file.slice(0, -4)) : null;
  return xml === null ? new Response("Not found", { status: 404 }) : respondWithXml(xml);
}
