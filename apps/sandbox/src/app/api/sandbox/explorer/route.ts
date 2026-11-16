import type { NextRequest } from "next/server";
import { forwardSandboxExplorer } from "@/server/sandboxExplorerProxy";

export async function POST(request: NextRequest) { return forwardSandboxExplorer(request); }
