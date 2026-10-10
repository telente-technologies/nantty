"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState, InlineNotice } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, PageHeader } from "@/components/ui/surfaces";
import { VerificationPrompt } from "@/components/verification/verificationPrompt";
import { supportedAccountCountries } from "@/constants/locale.constant";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { accountsApi } from "@/services/accountsApi.service";
import { AdsApiRequestError, isVerificationRequiredError, readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { AdAccountKind } from "@/types/adAccount.type";
import { createClientIdempotencyKey, validateRequiredText, type FieldErrors } from "@/utils/formValidation.util";

import styles from "./createAdAccountForm.module.css";

type FieldName = "name" | "storeId" | "countryCode";

export function CreateAdAccountForm() {
  const router = useRouter();
  const [kind, setKind] = useState<AdAccountKind>("business");
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [countryCode, setCountryCode] = useState("NG");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<FieldName>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => createClientIdempotencyKey("acct"));
  const profilesQuery = useAdsQuery(() => accountsApi.listLinkableBusinessProfiles(), "business-profiles");
  const profiles = profilesQuery.data?.items ?? [];
  const selectedProfile = profiles.find((profile) => profile.storeId === storeId) ?? null;
  const selectedCountry = useMemo(() => supportedAccountCountries.find((country) => country.code === countryCode) ?? supportedAccountCountries[0], [countryCode]);

  function chooseBusinessProfile(nextStoreId: string) {
    setStoreId(nextStoreId);
    const profile = profiles.find((candidate) => candidate.storeId === nextStoreId);
    if (profile) {
      if (!name.trim()) setName(profile.storeName);
      setCountryCode(profile.countryCode);
    }
  }

  async function createAccountAndOpenIt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: FieldErrors<FieldName> = { name: validateRequiredText(name, "Account name", 80, 2), storeId: kind === "business" && !storeId ? "Choose the store this account advertises." : undefined };
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean) || !selectedCountry) return;
    setIsSubmitting(true);
    setFormError(null);
    setVerificationMessage(null);
    try {
      const account = await accountsApi.createAdAccount({ name: name.trim(), kind, storeId: kind === "business" ? storeId : null, countryCode, timezone: selectedCountry.timezone }, idempotencyKey);
      router.push(`/accounts/${account.id}/overview`);
    } catch (error) {
      if (error instanceof AdsApiRequestError && error.issues.length > 0) {
        setFieldErrors(Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message])) as FieldErrors<FieldName>);
      }
      if (isVerificationRequiredError(error)) setVerificationMessage(error.message);
      else setFormError(readErrorMessageForDisplay(error));
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="New ad account" description="You will be its admin. You can invite people after it is created." />
      <form onSubmit={createAccountAndOpenIt} className={styles.form} noValidate>
        {verificationMessage ? <VerificationPrompt message={verificationMessage} /> : null}
        {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
        <fieldset className={styles.kindChoices}>
          <legend className={styles.legend}>Who is advertising?</legend>
          {(["business", "personal"] as const).map((option) => (
            <label key={option} className={kind === option ? `${styles.kindCard} ${styles.kindCardSelected}` : styles.kindCard}>
              <input type="radio" name="kind" value={option} checked={kind === option} onChange={() => setKind(option)} className="visuallyHidden" />
              <span className={styles.kindTitle}>{option === "business" ? "A business or store" : "Just me"}</span>
              <span className={styles.kindDescription}>
                {option === "business" ? "Linked to your Zudomart store. Sales are attributed automatically and verified Gold businesses get a badge and monthly ad credit." : "Promote your own posts, clips and profile."}
              </span>
            </label>
          ))}
        </fieldset>
        <Card>
          <div className={styles.fields}>
            {kind === "business" ? (
              profilesQuery.errorMessage ? (
                <ErrorState message={profilesQuery.errorMessage} onRetry={profilesQuery.reload} />
              ) : (
                <SelectField
                  label="Store or business profile"
                  value={storeId}
                  onValueChange={chooseBusinessProfile}
                  error={fieldErrors.storeId}
                  options={[{ value: "", label: profilesQuery.isLoading ? "Loading your stores…" : "Choose a store" }, ...profiles.map((profile) => ({ value: profile.storeId, label: `${profile.storeName} (@${profile.handle})` }))]}
                  hint={selectedProfile ? (selectedProfile.goldVerified ? <StatusBadge tone="accent">Verified Gold business</StatusBadge> : "This store does not have a verified Gold profile yet, so ads will not show the Verified business badge.") : "Only stores you own or manage are listed."}
                />
              )
            ) : null}
            <TextField label="Account name" value={name} onValueChange={setName} error={fieldErrors.name} maxLength={80} hint="Shown to your team only." />
            <SelectField label="Country" value={countryCode} onValueChange={setCountryCode} error={fieldErrors.countryCode} options={supportedAccountCountries.map((country) => ({ value: country.code, label: country.name }))} hint={`Billing currency will be ${selectedCountry?.currency ?? ""} and the time zone ${selectedCountry?.timezone ?? ""}. The currency cannot be changed later.`} />
          </div>
        </Card>
        <div className={styles.actions}>
          <ButtonLink href="/accounts" variant="ghost">
            Cancel
          </ButtonLink>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Create ad account
          </Button>
        </div>
      </form>
    </>
  );
}
