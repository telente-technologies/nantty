import { assertAdminEnvironmentIsSafe } from "@/config/adminEnvironment.config";

export function register() {
  assertAdminEnvironmentIsSafe();
}
