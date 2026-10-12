"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { EmptyState, ErrorBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchOfferLinks } from "@/services/subscriptionOffersApi.service";
import type { OfferLink } from "@/types/subscriptionOffers.type";
import { formatDateOnly } from "@/utils/formatting.util";
import { describeOfferDuration, describeOfferHeadline, describeOfferUses, offerStatusLabels } from "@/utils/offerLinkFormat.util";

import { CreateOfferLinkDialog } from "./createOfferLinkDialog";
import { OfferLinkDetailsDialog } from "./offerLinkDetailsDialog";
import styles from "./subscriptionOffers.module.css";

export function SubscriptionOffersWorkspace() {
  const { canAny } = useAdminPermissions();
  const canWrite = canAny("config:plans", "config:revenue");
  const links = useAdminQuery((signal) => fetchOfferLinks(signal), "subscription-offer-links");
  const [isCreating, setIsCreating] = useState(false);
  const [openLinkId, setOpenLinkId] = useState<string | null>(null);
  const rows = links.data?.data ?? [];
  const openLink = rows.find((link) => link.id === openLinkId) ?? null;
  const replaceLink = (changed: OfferLink) =>
    links.replaceData((current) => (current ? { ...current, data: current.data.some((link) => link.id === changed.id) ? current.data.map((link) => (link.id === changed.id ? changed : link)) : [changed, ...current.data] } : current));
  return (
    <>
      <PageHeader
        area="Configuration"
        title="Subscription offers"
        description="Discount links for Zudomart plans. A link is the only way to claim an offer; there are no promo codes. Offers apply to web checkout only and never stack with yearly or bundle discounts."
      />
      {links.errorMessage ? (
        <ErrorBlock variant="section" error={links.error} message={links.errorMessage} onRetry={links.reload} />
      ) : (
        <Card title="Offer links" actions={canWrite ? <Button variant="primary" iconName="plus16" onClick={() => setIsCreating(true)}>New offer link</Button> : null}>
          {!links.isLoading && rows.length === 0 ? (
            <EmptyState iconName="tag24" title="No offer links yet" description="Create a link, then copy it or email it to someone from here." />
          ) : (
            <div className={styles.tableScroller}>
              <DataTable
                caption="Offer links"
                rows={rows}
                isLoading={links.isLoading}
                readRowKey={(link) => link.id}
                onRowOpen={(link) => setOpenLinkId(link.id)}
                columns={[
                  { key: "offer", header: "Offer", render: (link) => <span className={styles.offerCell}><strong>{describeOfferHeadline(link)}</strong>{link.label ? <span className={styles.muted}>{link.label}</span> : null}</span> },
                  { key: "status", header: "Status", render: (link) => <StatusBadge status={link.status.toUpperCase()} label={offerStatusLabels[link.status]} /> },
                  { key: "duration", header: "Lasts for", render: (link) => describeOfferDuration(link.durationCycles) },
                  { key: "uses", header: "Claims", render: (link) => describeOfferUses(link) },
                  { key: "sends", header: "Emails", render: (link) => String(link.sends.length) },
                  { key: "expires", header: "Expires", render: (link) => (link.expiresAt ? formatDateOnly(link.expiresAt) : "Never") },
                ]}
              />
            </div>
          )}
        </Card>
      )}
      {isCreating ? (
        <CreateOfferLinkDialog
          onClose={() => setIsCreating(false)}
          onCreated={(created) => {
            replaceLink(created);
            setIsCreating(false);
            setOpenLinkId(created.id);
          }}
        />
      ) : null}
      {openLink ? <OfferLinkDetailsDialog link={openLink} canWrite={canWrite} onClose={() => setOpenLinkId(null)} onChanged={replaceLink} /> : null}
    </>
  );
}
