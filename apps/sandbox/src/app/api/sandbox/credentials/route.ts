import type { NextRequest } from "next/server";
import { forwardSandboxControl } from "@/server/sandboxPortalProxy";

export async function GET(request: NextRequest) { return forwardSandboxControl(request, "credentials.list"); }
export async function POST(request: NextRequest) { return forwardSandboxControl(request, "credentials.issue"); }
export async function DELETE(request: NextRequest) { return forwardSandboxControl(request, "credentials.revoke"); }
