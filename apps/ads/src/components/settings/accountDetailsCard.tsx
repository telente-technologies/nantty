"use client";

import { useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { supportedAccountCountries } from "@/constants/locale.constant";
import { accountsApi } from "@/services/accountsApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import { formatDateWithYear } from "@/utils/dateRange.util";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./settingsPage.module.css";

const timezoneOptions = [...new Set([...supportedAccountCountries.map((country) => country.timezone), "Africa/Cairo", "Europe/Paris", "UTC"])].map((timezone) => ({ value: timezone, label: timezone.replace(/_/g, " ") }));

export function AccountDetailsCard() {
  const { accountId, account, canPerform, reloadAccount } = useAdAccount();
  const { showToast } = useToast();
  const [name, setName] = useState(account.name);
  const [timezone, setTimezone] = useState(account.timezone);
  const [isSaving, setIsSaving] = useState(false);
  const canManageAccount = canPerform("account:manage");
  const hasChanges = name.trim() !== account.name || timezone !== account.timezone;
  const countryName = supportedAccountCountries.find((country) => country.code === account.countryCode)?.name ?? account.countryCode;
  const options = timezoneOptions.some((option) => option.value === account.timezone) ? timezoneOptions : [{ value: account.timezone, label: account.timezone }, ...timezoneOptions];

  async function copyAccountIdToClipboard() {
    try {
      await navigator.clipboard.writeText(accountId);
      showToast("Account ID copied");
    } catch {
      showToast("Could not copy. Select the ID and copy it manually.", "error");
    }
  }

  async function saveAccountDetails() {
    if (!name.trim() || name.trim().length > 80) {
      showToast("Enter a name of up to 80 characters.", "error");
      return;
    }
    setIsSaving(true);
    try {
      await accountsApi.updateAdAccount(accountId, { name: name.trim(), timezone });
      showToast("Account settings saved");
      reloadAccount();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card title="Ad account" description="Currency and country are fixed when the account is created.">
      <div className={styles.stack}>
        {canManageAccount ? (
          <>
            <TextField label="Account name" value={name} onValueChange={setName} maxLength={80} />
            <SelectField label="Time zone for reports and schedules" value={timezone} onValueChange={setTimezone} options={options} />
            <div>
              <Button variant="primary" disabled={!hasChanges} isLoading={isSaving} onClick={saveAccountDetails}>
                Save changes
              </Button>
            </div>
          </>
        ) : null}
        <KeyValueList
          items={[
            ...(canManageAccount ? [] : [{ label: "Name", value: account.name }, { label: "Time zone", value: account.timezone }]),
            {
              label: "Account ID",
              value: (
                <span className={styles.idRow}>
                  <code>{accountId}</code>
                  <Button size="small" variant="ghost" iconName="copy16" aria-label="Copy account ID" onClick={copyAccountIdToClipboard} />
                </span>
              ),
            },
            { label: "Type", value: account.kind === "business" ? "Business" : "Personal" },
            { label: "Currency", value: account.currency },
            { label: "Country", value: countryName },
            { label: "Owner", value: account.owner.name },
            { label: "Created", value: formatDateWithYear(account.createdAt) },
            { label: "Spent to date", value: formatMoneyForDisplay(account.amountSpent) },
          ]}
        />
        {account.disabledReason ? <InlineNotice tone="error" title="Account disabled">{account.disabledReason}</InlineNotice> : null}
      </div>
    </Card>
  );
}

export function BusinessVerificationCard() {
  const { account } = useAdAccount();
  if (account.kind !== "business" || !account.business) {
    return (
      <Card title="Business profile" description="Personal ad accounts promote your own posts and clips.">
        <p className={styles.muted}>To advertise a store with sales attribution, store audiences and a Verified business label, create a business ad account linked to that store.</p>
      </Card>
    );
  }
  const business = account.business;
  return (
    <Card title="Business profile" description="The store this ad account advertises for.">
      <div className={styles.stack}>
        <div className={styles.businessRow}>
          <span className={styles.storeMark} aria-hidden>
            <NanttyIcon name="buildingStore20" size={20} />
          </span>
          <div>
            <p>
              <strong>{business.storeName}</strong>
            </p>
            <p className={styles.muted}>@{business.handle}</p>
          </div>
          {account.verifiedBusiness ? <StatusBadge tone="accent">Verified business</StatusBadge> : <StatusBadge tone="neutral">Not verified</StatusBadge>}
        </div>
        {account.verifiedBusiness ? (
          <InlineNotice tone="success">Your ads show a Verified business label because {business.storeName} has a verified Gold profile. Gold Premium also adds monthly ad credit.</InlineNotice>
        ) : (
          <InlineNotice tone="info">Ads show a Verified business label when the linked store has a verified Gold profile. Verify the store from the seller dashboard to get it.</InlineNotice>
        )}
      </div>
    </Card>
  );
}
