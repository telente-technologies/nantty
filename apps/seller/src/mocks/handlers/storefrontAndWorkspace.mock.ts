import { registerStorefrontMockRoutes } from "@/mocks/handlers/storefrontMockRoutes.mock";
import { registerWorkspaceDeveloperMockRoutes } from "@/mocks/handlers/workspaceDeveloperRoutes.mock";
import { registerWorkspaceSecurityMockRoutes } from "@/mocks/handlers/workspaceSecurityRoutes.mock";

export function registerStorefrontAndWorkspaceMockHandlers(): void {
  registerStorefrontMockRoutes();
  registerWorkspaceDeveloperMockRoutes();
  registerWorkspaceSecurityMockRoutes();
}
