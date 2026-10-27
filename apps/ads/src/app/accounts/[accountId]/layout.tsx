import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AccountShell } from "@/components/shell/accountShell";
import { buildSessionViewFromCookies } from "@/server/adsSessionView.service";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({ children, params }: { readonly children: ReactNode; readonly params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(accountId)) notFound();
  const sessionView = buildSessionViewFromCookies(await cookies());
  if (!sessionView) redirect(`/login?next=/accounts/${accountId}/overview`);
  const membership = sessionView.memberships.find((candidate) => candidate.accountId === accountId);
  if (!membership) redirect(`/accounts?denied=${accountId}`);
  return (
    <AccountShell accountId={accountId} role={membership.role}>
      {children}
    </AccountShell>
  );
}
