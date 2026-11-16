import type { NextRequest } from "next/server";
import { forwardSandboxControl } from "@/server/sandboxPortalProxy";

export async function GET(request: NextRequest) { return forwardSandboxControl(request, "usage.read"); }
