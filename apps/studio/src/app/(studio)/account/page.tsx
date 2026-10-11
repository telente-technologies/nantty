"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { ThemeSwitcher } from "@zudomart/web-kit";

import { AccountStandingCard } from "@/components/accountHealth/accountHealthSummary";
import { useSession } from "@/components/providers/sessionProvider";
import { SignOutButton } from "@/components/shell/signOutButton";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, DataRows, Muted, PageHeader, pageStyles } from "@/components/ui/studioPage";
import { webappLinks } from "@/config/webappLinks.config";
import { creatorService } from "@/services/creator.service";

const programLabels: Record<string, string> = { approved: "Approved", suspended: "Suspended", pending: "Application in review", rejected: "Not approved", none: "Not a member" };

function CreatorProgramCard() {
  const status = useQuery({ queryKey: ["creator", "status"], queryFn: creatorService.fetchStatus });
  if (status.isError) return <ErrorState title="Creator Program status didn't load" error={status.error} onRetry={() => void status.refetch()} />;
  if (!status.data) return <Skeleton height={120} />;
  const data = status.data;
  return (
    <Card title="Creator Program">
      <DataRows
        rows={[
          { key: "status", label: "Membership", value: programLabels[data.status] ?? data.status },
          ...(data.tier ? [{ key: "tier", label: "Tier", value: data.tier }] : []),
          { key: "share", label: "Your gift share", value: data.giftSharePercent ? `${data.giftSharePercent}%` : "Not earning yet" },
          { key: "live", label: "Can go live", value: data.canGoLive ? "Yes" : "No" },
          { key: "violations", label: "Recent violations", detail: "Counted toward tier reviews", value: String(data.recentViolations) },
        ]}
      />
      {data.suspensionReason ? <p className={pageStyles.error}>{`Suspended${data.suspendedAt ? ` on ${new Date(data.suspendedAt).toLocaleDateString("en-GB")}` : ""}: ${data.suspensionReason}`}</p> : null}
      <a href={webappLinks.creatorProgram} target="_blank" rel="noopener noreferrer" className={pageStyles.textLink}>Program rules and tiers</a>
    </Card>
  );
}

export default function AccountPage() {
  const { viewer } = useSession();
  return (
    <div className={pageStyles.page}>
      <PageHeader title="Account" subtitle="Your standing, your Creator Program membership and Studio settings." />
      <AccountStandingCard />
      <div className={pageStyles.columns}>
        <CreatorProgramCard />
        <Card title="Tools">
          <DataRows
            rows={[
              { key: "embed", label: <Link href="/embed">Embed on your site</Link>, detail: "Copy a buy button, store card or product grid for your own website.", value: "" },
              { key: "help", label: <a href={webappLinks.help} target="_blank" rel="noopener noreferrer">Help Centre</a>, detail: "Guides for going live, payouts and copyright.", value: "" },
            ]}
          />
        </Card>
        <Card title="Settings">
          <DataRows
            rows={[
              { key: "name", label: "Name", value: viewer?.name ?? "" },
              { key: "handle", label: "Handle", value: viewer?.channelHandle ?? "" },
              { key: "email", label: "Sign-in email", value: viewer?.email ?? "Not set" },
            ]}
          />
          <Muted>
            Change your name, photo or bio on{" "}
            <a href={viewer ? webappLinks.profile(viewer.username) : webappLinks.help} target="_blank" rel="noopener noreferrer">your Zudomart profile</a>.
          </Muted>
          <div className={pageStyles.inlineActions}>
            <ThemeSwitcher />
            <SignOutButton />
          </div>
        </Card>
      </div>
    </div>
  );
}
