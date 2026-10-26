"use client";

import { useState } from "react";

import { requestConfirmation } from "@nantty/web-kit";

import type { ShippingRuleWithZone } from "@/components/delivery/shipping/shippingRuleFormDialog";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ShippingProfile } from "@/types/shipping.type";
import { describeDestinations } from "@/utils/shippingDestinationSelection.util";

import styles from "./shipping.module.css";

export function ShippingRulesTable({ profile, canEdit, onEdit, onChanged }: { readonly profile: ShippingProfile; readonly canEdit: boolean; readonly onEdit: (row: ShippingRuleWithZone) => void; readonly onChanged: () => void }) {
  const { showToast } = useToast();
  const { formatMoney } = useMoneyFormatter();
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);
  const rows: ShippingRuleWithZone[] = profile.rules.flatMap((rule) => {
    const zone = profile.zones.find((candidate) => candidate.id === rule.zoneId);
    return zone ? [{ rule, zone }] : [];
  });

  async function runRuleRequest(ruleId: string, method: "PATCH" | "DELETE", body?: unknown, successMessage?: string) {
    setBusyRuleId(ruleId);
    try {
      await sendSellerApiRequest(`/seller/shipping/rules/${encodeURIComponent(ruleId)}`, { method, body });
      if (successMessage) showToast(successMessage);
      onChanged();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyRuleId(null);
    }
  }

  async function removeRule({ rule, zone }: ShippingRuleWithZone) {
    if (!(await requestConfirmation({ title: `Remove ${zone.name}?`, description: "Customers there will use the next most specific rule, or can't check out.", confirmLabel: "Remove rule", tone: "danger", intent: "remove" }))) return;
    void runRuleRequest(rule.id, "DELETE", undefined, `Removed ${zone.name}.`);
  }

  const columns: DataTableColumn<ShippingRuleWithZone>[] = [
    { key: "zone", header: "Destination group", render: ({ zone }) => <span className={styles.primaryCell}><strong>{zone.name}</strong><span className={styles.muted}>{describeDestinations(zone.destinations)}</span></span> },
    { key: "fee", header: "Fee per order group", align: "end", render: ({ rule }) => (rule.type === "free" ? <StatusBadge tone="success">Free</StatusBadge> : formatMoney(rule.fee)) },
    {
      key: "active",
      header: "Active",
      render: ({ rule, zone }) => (
        <button type="button" role="switch" aria-checked={rule.active} aria-label={`${zone.name} active`} disabled={!canEdit || busyRuleId === rule.id} className={styles.rowSwitch} onClick={() => void runRuleRequest(rule.id, "PATCH", { active: !rule.active })}>
          <span className={styles.rowSwitchThumb} />
        </button>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (row) => (canEdit ? <span className={styles.actionRow}><Button size="small" onClick={() => onEdit(row)}>Edit</Button><Button size="small" variant="ghost" isBusy={busyRuleId === row.rule.id} onClick={() => removeRule(row)}>Remove</Button></span> : null),
    },
  ];

  return <DataTable caption="Shipping rules" columns={columns} rows={rows} readRowKey={(row) => row.rule.id} emptyState={<EmptyState iconName="mapPin24" title="No shipping rules yet" description="Add a rule to choose where you ship and what it costs. Until then, customers cannot check out." />} />;
}
