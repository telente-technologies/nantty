import type { Metadata } from "next";

import { AuthSplitLayout } from "@/components/auth/authSplitLayout";
import { PasswordResetForm } from "@/components/auth/passwordResetForm";
import { isMockBackendEnabled } from "@/config/sellerEnvironment.config";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage() {
  const demoCode = process.env.NODE_ENV !== "production" && isMockBackendEnabled() ? (await import("@/mocks/handlers/passwordReset.mock")).demoPasswordResetCode : null;
  return (
    <AuthSplitLayout>
      <PasswordResetForm demoCode={demoCode} />
    </AuthSplitLayout>
  );
}
