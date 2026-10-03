"use client";

import Link from "next/link";

import { weekdayLabels, type StorefrontDraft, type StorefrontDraftUpdater } from "@/components/storefront/storefrontDraft.util";
import { TextAreaField, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { storefrontSocialNetworks, type StorefrontOpeningHours, type StorefrontSocialNetwork } from "@/types/storefront.type";

import styles from "./storefront.module.css";

const socialNetworkLabels: Record<StorefrontSocialNetwork, { label: string; placeholder: string }> = {
  instagram: { label: "Instagram", placeholder: "https://instagram.com/yourstore" },
  tiktok: { label: "TikTok", placeholder: "https://tiktok.com/@yourstore" },
  x: { label: "X", placeholder: "https://x.com/yourstore" },
  whatsapp: { label: "WhatsApp", placeholder: "https://wa.me/2348030000000" },
  facebook: { label: "Facebook", placeholder: "https://facebook.com/yourstore" },
  website: { label: "Website", placeholder: "https://yourstore.ng" },
};

export function StorefrontPoliciesSection({ draft, onDraftChange }: { readonly draft: StorefrontDraft; readonly onDraftChange: StorefrontDraftUpdater }) {
  const updatePolicy = (key: keyof StorefrontDraft["policies"], value: string) => onDraftChange({ policies: { ...draft.policies, [key]: value } });
  return (
    <Panel title="Policies" description="Shown on your store page, at checkout and on packing slips.">
      <div className={styles.stack}>
        <TextAreaField label="Returns and refunds" rows={3} maxLength={2000} value={draft.policies.returns} onChange={(event) => updatePolicy("returns", event.target.value)} />
        <TextAreaField label="Shipping" rows={3} maxLength={2000} value={draft.policies.shipping} onChange={(event) => updatePolicy("shipping", event.target.value)} />
        <TextAreaField label="Privacy" rows={3} maxLength={2000} value={draft.policies.privacy} onChange={(event) => updatePolicy("privacy", event.target.value)} />
      </div>
    </Panel>
  );
}

export function StorefrontOpeningHoursSection({ draft, onDraftChange }: { readonly draft: StorefrontDraft; readonly onDraftChange: StorefrontDraftUpdater }) {
  function updateOpeningHoursForDay(weekday: StorefrontOpeningHours["weekday"], patch: Partial<StorefrontOpeningHours>) {
    onDraftChange({ openingHours: draft.openingHours.map((hours) => (hours.weekday === weekday ? { ...hours, ...patch } : hours)) });
  }
  return (
    <Panel title="Opening hours" description="When you reply to messages and dispatch orders. Buyers see “Open now” or “Closed” on your store.">
      <div>
        {draft.openingHours.map((hours) => (
          <div key={hours.weekday} className={styles.hoursRow}>
            <span>{weekdayLabels[hours.weekday]}</span>
            <ToggleSwitch label={hours.isOpen ? "Open" : "Closed"} checked={hours.isOpen} onCheckedChange={(isOpen) => updateOpeningHoursForDay(hours.weekday, { isOpen })} />
            {hours.isOpen ? (
              <>
                <label>
                  <span className="visuallyHidden">{weekdayLabels[hours.weekday]} opens at</span>
                  <input type="time" className={styles.timeInput} value={hours.opensAt} onChange={(event) => updateOpeningHoursForDay(hours.weekday, { opensAt: event.target.value })} />
                </label>
                <label>
                  <span className="visuallyHidden">{weekdayLabels[hours.weekday]} closes at</span>
                  <input type="time" className={styles.timeInput} value={hours.closesAt} onChange={(event) => updateOpeningHoursForDay(hours.weekday, { closesAt: event.target.value })} />
                </label>
              </>
            ) : (
              <span className={styles.closedLabel}>Closed all day</span>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function StorefrontSocialLinksSection({ draft, onDraftChange }: { readonly draft: StorefrontDraft; readonly onDraftChange: StorefrontDraftUpdater }) {
  return (
    <Panel title="Social links" description="Buyers can follow you elsewhere. Leave any of them empty.">
      <div className={styles.twoColumns}>
        {storefrontSocialNetworks.map((network) => (
          <TextField
            key={network}
            label={socialNetworkLabels[network].label}
            type="url"
            inputMode="url"
            maxLength={200}
            placeholder={socialNetworkLabels[network].placeholder}
            value={draft.socialLinks[network] ?? ""}
            onChange={(event) => onDraftChange({ socialLinks: { ...draft.socialLinks, [network]: event.target.value } })}
          />
        ))}
      </div>
    </Panel>
  );
}

export function StorefrontDeliveryAreasSummary({ deliveryAreas }: { readonly deliveryAreas: readonly string[] }) {
  return (
    <Panel title="Delivery areas" description="Where you deliver and what it costs is set in Delivery." actions={<Link href="/delivery/settings">Manage delivery</Link>}>
      {deliveryAreas.length === 0 ? (
        <p className={styles.muted}>No delivery areas yet. Buyers can still order and arrange pickup.</p>
      ) : (
        <div className={styles.socialRow}>
          {deliveryAreas.map((area) => (
            <StatusBadge key={area} tone="info">
              {area}
            </StatusBadge>
          ))}
        </div>
      )}
    </Panel>
  );
}
