import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/authCard";
import { LoginForm } from "@/components/auth/loginForm";
import { isMockBackendEnabled, readAdminDeploymentEnvironment } from "@/config/adminEnvironment.config";

export const metadata: Metadata = { title: "Sign in" };

const reasonMessages: Record<string, string> = {
  idle: "You were signed out after 15 minutes without activity.",
  expired: "Your session ended. Sign in again to continue.",
  "signed-out": "You signed out.",
  privileges: "Your admin access changed. Sign in again to use your new permissions.",
  "mfa-expired": "Your sign-in step expired. Enter your password again.",
};

export default async function LoginPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parameters = await searchParams;
  const reason = typeof parameters.reason === "string" ? parameters.reason : "";
  const nextPath = typeof parameters.next === "string" ? parameters.next : "";
  return (
    <AuthCard environment={readAdminDeploymentEnvironment()} title="Sign in to the admin console" description="Use your work email. An authenticator code is always required.">
      <LoginForm reasonMessage={reasonMessages[reason] ?? null} nextPath={nextPath} isMockBackend={isMockBackendEnabled()} />
    </AuthCard>
  );
}
