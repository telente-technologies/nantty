"use client";

import { useQuery } from "@tanstack/react-query";

import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, DataRows, Muted, PageHeader, pageStyles } from "@/components/ui/studioPage";
import { webappLinks } from "@/config/webappLinks.config";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { creatorService } from "@/services/creator.service";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function ApplicationState() {
  const application = useQuery({ queryKey: ["creator", "application"], queryFn: creatorService.fetchMyApplication });
  const data = application.data;
  if (!data) return null;
  if (data.status === "pending") return <Muted>{`Your application from ${shortDate(data.submittedAt)} is in review. We'll email you when it's decided.`}</Muted>;
  if (data.status === "rejected") {
    const reapply = data.reapplyAvailableAt ? ` You can apply again from ${shortDate(data.reapplyAvailableAt)}.` : "";
    return <p className={pageStyles.error}>{`Your last application wasn't approved${data.rejectionReason ? `: ${data.rejectionReason}` : "."}${reapply}`}</p>;
  }
  return null;
}

export function CreatorProgramGate() {
  const eligibility = useQuery({ queryKey: ["creator", "eligibility"], queryFn: creatorService.fetchEligibility });
  return (
    <div className={pageStyles.page}>
      <PageHeader title="Studio is for Creator Program members" subtitle="Members go live, receive gifts, sell subscriptions and get paid. Here's how close you are." />
      <ApplicationState />
      <Card title="Your requirements">
        {eligibility.isError ? <ErrorState title="Requirements didn't load" description={readErrorMessageForDisplay(eligibility.error)} onRetry={() => void eligibility.refetch()} /> : null}
        {eligibility.isLoading ? <Skeleton height={120} /> : null}
        {eligibility.data ? (
          <>
            <DataRows rows={eligibility.data.requirements.map((requirement) => ({ key: requirement.key, label: requirement.label, detail: requirement.met ? "Met" : `${requirement.requiredValue - requirement.currentValue} to go`, value: `${requirement.currentValue} / ${requirement.requiredValue}` }))} />
            <Muted>{eligibility.data.decisionNote}</Muted>
            {eligibility.data.eligible ? <a href={webappLinks.creatorApply} className={pageStyles.textLink}>Apply to the Creator Program</a> : <a href={webappLinks.creatorProgram} className={pageStyles.textLink}>How to qualify</a>}
          </>
        ) : null}
      </Card>
    </div>
  );
}
