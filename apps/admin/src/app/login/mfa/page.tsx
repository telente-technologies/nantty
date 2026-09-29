import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/authCard";
import { MfaChallengeForm } from "@/components/auth/mfaChallengeForm";
import { MfaEnrollmentForm } from "@/components/auth/mfaEnrollmentForm";
import { readAdminDeploymentEnvironment } from "@/config/adminEnvironment.config";
import { readPendingMfaChallengeFromCookies } from "@/server/adminSession.service";

export const metadata: Metadata = { title: "Two-step verification" };

export default async function MfaPage() {
  const challenge = readPendingMfaChallengeFromCookies(await cookies());
  if (!challenge) redirect("/login?reason=mfa-expired");
  const environment = readAdminDeploymentEnvironment();
  if (challenge.enrollmentRequired) {
    return (
      <AuthCard environment={environment} title="Set up your authenticator" description={<>Two-step verification is required for every admin. Signing in as <strong>{challenge.email}</strong>.</>}>
        <MfaEnrollmentForm />
      </AuthCard>
    );
  }
  return (
    <AuthCard environment={environment} title="Enter your authenticator code" description={<>Signing in as <strong>{challenge.email}</strong>.</>} footer={<a href="/login">Use a different account</a>}>
      <MfaChallengeForm isPasskeyAvailable={challenge.passkeyAvailable} />
    </AuthCard>
  );
}
