"use client";

import { useState } from "react";

import { ShippingLivePreview } from "@/components/delivery/shipping/shippingLivePreview";
import { ShippingRuleFormDialog, type ShippingRuleWithZone } from "@/components/delivery/shipping/shippingRuleFormDialog";
import { ShippingRulesTable } from "@/components/delivery/shipping/shippingRulesTable";
import { ShippingThresholdPanel } from "@/components/delivery/shipping/shippingThresholdPanel";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { ShippingProfile } from "@/types/shipping.type";

import styles from "./shipping.module.css";

export function ShippingConfigView() {
  const { can } = useSellerSession();
  const profileQuery = useSellerQuery<ShippingProfile>("/seller/shipping/profile");
  const [editing, setEditing] = useState<ShippingRuleWithZone | "new" | null>(null);
  const canEdit = can("delivery:manage");
  const profile = profileQuery.data;

  if (!profile) {
    if (profileQuery.errorMessage) return <Callout tone="error" action={<Button size="small" onClick={profileQuery.reload}>Try again</Button>}>{profileQuery.errorMessage}</Callout>;
    return <LoadingBlock label="Loading shipping rules" />;
  }

  return (
    <div className={styles.stack}>
      <Callout tone="info" title="Shipping is priced per order group, never per item">
        You ship your own orders. Nantty checks the customer&apos;s address against these rules and works out one shipping charge for everything in the order group, however many items it holds. Included on every plan, including Free.
      </Callout>
      <Panel
        title="Shipping rules"
        description="Each rule sets a fee or free shipping for a group of destinations."
        actions={canEdit ? <Button variant="primary" iconName="plus16" onClick={() => setEditing("new")}>Add rule</Button> : null}
        padded={false}
      >
        <ShippingRulesTable profile={profile} canEdit={canEdit} onEdit={setEditing} onChanged={profileQuery.reload} />
      </Panel>
      <ShippingThresholdPanel key={profile.updatedAt} profile={profile} canEdit={canEdit} onSaved={profileQuery.reload} />
      <ShippingLivePreview profile={profile} />
      {editing ? <ShippingRuleFormDialog key={editing === "new" ? "new" : editing.rule.id} existing={editing === "new" ? null : editing} currency={profile.currency} onClose={() => setEditing(null)} onSaved={profileQuery.reload} /> : null}
    </div>
  );
}
