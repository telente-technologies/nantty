"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState, InlineNotice, LoadingBlock } from "@/components/ui/feedback";
import { Card, KeyValueList, PageHeader } from "@/components/ui/surfaces";
import { roleDescriptions, roleLabels } from "@/config/rolePermissions.config";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { accountsApi } from "@/services/accountsApi.service";
import { AdsApiRequestError, readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import { formatDateWithYear } from "@/utils/dateRange.util";

function isInviteGone(error: unknown): boolean {
  return error instanceof AdsApiRequestError && (error.status === 404 || error.status === 410 || error.code.startsWith("INVITE_"));
}

export function InviteAcceptance({ token }: { readonly token: string }) {
  const router = useRouter();
  const inviteQuery = useAdsQuery(() => accountsApi.previewInvite(token), token);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  async function acceptInviteAndOpenAccount() {
    setIsAccepting(true);
    setAcceptError(null);
    try {
      const { accountId } = await accountsApi.acceptInvite(token);
      router.push(`/accounts/${accountId}/overview`);
    } catch (error) {
      setAcceptError(readErrorMessageForDisplay(error));
      setIsAccepting(false);
    }
  }

  const invite = inviteQuery.data;
  return (
    <>
      <PageHeader title="Join an ad account" />
      {inviteQuery.isLoading ? <LoadingBlock /> : null}
      {inviteQuery.errorMessage ? <ErrorState variant="section" error={inviteQuery.error} kind={isInviteGone(inviteQuery.error) ? "inviteInvalid" : undefined} message={inviteQuery.errorMessage} onRetry={inviteQuery.reload} /> : null}
      {invite ? (
        <Card title={invite.accountName} description={`${invite.invitedBy} invited you.`}>
          <KeyValueList
            items={[
              { label: "Your role", value: roleLabels[invite.role] },
              { label: "What you can do", value: roleDescriptions[invite.role] },
              { label: "Invite expires", value: formatDateWithYear(invite.expiresAt) },
            ]}
          />
          {acceptError ? <InlineNotice tone="error">{acceptError}</InlineNotice> : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <ButtonLink href="/accounts" variant="ghost">
              Not now
            </ButtonLink>
            <Button variant="primary" onClick={acceptInviteAndOpenAccount} isLoading={isAccepting}>
              Accept and open
            </Button>
          </div>
        </Card>
      ) : null}
    </>
  );
}
