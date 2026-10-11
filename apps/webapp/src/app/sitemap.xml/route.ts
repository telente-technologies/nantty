import { connection } from "next/server";

import { buildSitemapIndexXml, respondWithXml } from "@/server/sitemapXml.service";

export async function GET(): Promise<Response> {
  await connection();
  return respondWithXml(await buildSitemapIndexXml());
}
