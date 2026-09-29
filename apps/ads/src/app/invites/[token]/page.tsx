import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InviteAcceptance } from "@/components/accounts/inviteAcceptance";
import { StandaloneFrame } from "@/components/shell/standaloneFrame";

export const metadata: Metadata = { title: "Join an ad account" };

export default async function InvitePage({ params }: { readonly params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(token)) notFound();
  return (
    <StandaloneFrame width="narrow">
      <InviteAcceptance token={token} />
    </StandaloneFrame>
  );
}
