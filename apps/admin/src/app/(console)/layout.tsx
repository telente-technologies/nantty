import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ConfirmDialogHost } from "@zudomart/web-kit";

import { StepUpProvider } from "@/components/security/stepUpProvider";
import { AdminSessionProvider } from "@/components/session/adminSessionProvider";
import { ConsoleShell } from "@/components/shell/consoleShell";
import { ToastProvider } from "@/components/ui/toastProvider";
import { buildAdminSessionViewFromCookies, readCsrfTokenForCookies } from "@/server/adminSessionView.service";

export default async function ConsoleLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const sessionView = buildAdminSessionViewFromCookies(cookieStore);
  if (!sessionView) redirect("/login");
  return (
    <AdminSessionProvider sessionView={sessionView} csrfToken={readCsrfTokenForCookies(cookieStore)}>
      <ToastProvider>
        <StepUpProvider>
          <ConsoleShell>{children}</ConsoleShell>
          <ConfirmDialogHost />
        </StepUpProvider>
      </ToastProvider>
    </AdminSessionProvider>
  );
}
