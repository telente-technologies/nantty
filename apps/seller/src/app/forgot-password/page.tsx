import type { Metadata } from "next";

import { AuthSplitLayout } from "@/components/auth/authSplitLayout";
import { PasswordResetForm } from "@/components/auth/passwordResetForm";
import { isMockBackendEnabled } from "@/config/sellerEnvironment.config";
import { demoPasswordResetCode } from "@/mocks/handlers/passwordReset.mock";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthSplitLayout>
      <PasswordResetForm demoCode={isMockBackendEnabled() ? demoPasswordResetCode : null} />
    </AuthSplitLayout>
  );
}
