import type { NextRequest } from "next/server";
import { forwardSandboxControl } from "@/server/sandboxPortalProxy";

export async function POST(request: NextRequest) { return forwardSandboxControl(request, "conversations.message"); }
export async function PATCH(request: NextRequest) { return forwardSandboxControl(request, "messages.transition"); }
