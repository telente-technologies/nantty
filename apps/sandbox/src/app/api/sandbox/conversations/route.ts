import type { NextRequest } from "next/server";
import { forwardSandboxControl } from "@/server/sandboxPortalProxy";

export async function GET(request: NextRequest) { return forwardSandboxControl(request, "conversations.list"); }
export async function POST(request: NextRequest) { return forwardSandboxControl(request, "conversations.create"); }
