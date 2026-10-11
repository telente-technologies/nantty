import { respondWithEmbed } from "@/server/embed/embedPage.service";
import { readEmbedClientKey } from "@/utils/embedSecurity.util";

export async function GET(request: Request, { params }: { readonly params: Promise<{ readonly kind: string; readonly id: string }> }): Promise<Response> {
  const { kind, id } = await params;
  const clientKey = readEmbedClientKey(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip"));
  return respondWithEmbed(kind, decodeURIComponent(id), new URL(request.url).searchParams, clientKey);
}
