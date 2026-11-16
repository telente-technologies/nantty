import { getSandboxReadiness } from "@/server/sandboxReadiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json(await getSandboxReadiness(), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
