"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { sellerService } from "@/services/seller.service";
import { usersService } from "@/services/users.service";
import { isSellerApplicationCountryEligible, normalizeSellerCountryCode } from "@/utils/sellerApplicationEligibility.util";

import styles from "../page.module.css";

export default function SellerApplicationPage() {
  const queryClient = useQueryClient();
  const existing = useQuery({ queryKey: ["seller", "application"], queryFn: () => sellerService.fetchMySellerApplication() });
  const accountSettings = useQuery({ queryKey: ["users", "me", "settings"], queryFn: usersService.fetchMyAccountSettings, retry: false });
  const countryCode = normalizeSellerCountryCode(accountSettings.data?.countryCode);
  const countryEligible = isSellerApplicationCountryEligible(countryCode);
  const needsCountryConfirmation = !accountSettings.isLoading && !accountSettings.isError && countryCode === null;
  const supportedCountries = useQuery({
    queryKey: ["locale", "countries"],
    queryFn: usersService.listSupportedCountries,
    enabled: needsCountryConfirmation,
    retry: false,
  });
  const [countrySelection, setCountrySelection] = useState("");
  const [enableLogistics, setEnableLogistics] = useState<boolean | null>(null);
  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [state, setStateValue] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentPhotoUrl, setDocumentPhotoUrl] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: () => {
      if (!isSellerApplicationCountryEligible(accountSettings.data?.countryCode)) {
        throw new Error("Seller applications are currently limited to businesses operating in Nigeria.");
      }
      if (enableLogistics === null) {
        throw new Error("Choose whether your store can handle logistics.");
      }
      return sellerService.submitSellerApplication({
        storeName: storeName.trim(),
        categoryId: "general",
        description: description.trim(),
        phone: phone.trim(),
        addressLine: addressLine.trim(),
        city: city.trim(),
        state: state.trim(),
        identityDocument: { documentType: "nin_slip", documentNumber: documentNumber.trim(), documentPhotoUrl: documentPhotoUrl.trim() },
        payoutAccount: { bankCode: bankCode.trim(), accountNumber: accountNumber.trim() },
        enableLogistics,
      });
    },
    onSuccess: () => {
      setError(null);
      void existing.refetch();
      showToast({ text: "Application submitted" });
    },
    onError: (mutationError) => setError(readErrorMessageForDisplay(mutationError)),
  });
  const confirmCountry = useMutation({
    mutationFn: (selectedCountryCode: string) => usersService.updateMyCountryPreference(selectedCountryCode),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users", "me", "settings"] });
      setCountrySelection("");
    },
  });
  if (existing.isLoading) return <ListRowsSkeleton label="Loading application" rows={4} />;
  if (existing.isError) return <ErrorState description="We couldn't load your application." error={existing.error} onRetry={() => void existing.refetch()} />;
  if (existing.data) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Seller application</h1>
        <div className={styles.card}>
          <span className={styles.label}>Status</span>
          <span className={styles.value}>{existing.data.status}</span>
          <span className={styles.rowMeta}>{existing.data.storeName} · {existing.data.city}, {existing.data.state}</span>
          {existing.data.rejectionReason ? <span className={styles.rowMeta}>{existing.data.rejectionReason}</span> : null}
        </div>
      </div>
    );
  }
  if (accountSettings.isLoading) return <ListRowsSkeleton label="Checking seller eligibility" rows={2} />;
  if (accountSettings.isError) {
    return <ErrorState description="We couldn’t verify the country saved to your account. Seller applications are paused until we can confirm it." error={accountSettings.error} onRetry={() => void accountSettings.refetch()} />;
  }
  if (countryCode !== null && !countryEligible) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Seller applications</h1>
        <section className={styles.card} aria-labelledby="seller-country-heading">
          <h2 id="seller-country-heading" className={styles.sectionTitle}>Seller stores are currently available in Nigeria</h2>
          <p className={styles.note}>Your account country is {countryCode}. We can’t accept a seller-store application from this country in v1. This restriction applies to selling businesses only; creator applications are separate.</p>
          <Link className={styles.linkButton} href="/creator/apply">Explore the creator program</Link>
        </section>
      </div>
    );
  }
  if (needsCountryConfirmation) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Confirm your country to apply</h1>
        <section className={styles.card} aria-labelledby="seller-country-confirm-heading">
          <h2 id="seller-country-confirm-heading" className={styles.sectionTitle}>We couldn’t confirm your account country</h2>
          <p className={styles.note}>Seller stores are currently available to businesses operating in Nigeria. Choose your current country below to save it to your account. We won’t assume you’re in Nigeria, and the server remains the final eligibility check.</p>
          {supportedCountries.isError ? (
            <div>
              <p className={styles.error} role="alert">We couldn’t load the country list. Please try again.</p>
              <button type="button" className={styles.linkButton} onClick={() => void supportedCountries.refetch()}>Retry country list</button>
            </div>
          ) : null}
          <label className={styles.field} htmlFor="seller-country">Current country
            <select id="seller-country" className={styles.input} value={countrySelection} onChange={(event) => setCountrySelection(event.target.value)} disabled={supportedCountries.isLoading || supportedCountries.isError}>
              <option value="">Choose a country</option>
              {(supportedCountries.data ?? []).map((country) => <option key={country.countryCode} value={country.countryCode}>{country.countryName}</option>)}
            </select>
          </label>
          <button type="button" className={styles.primary} disabled={!countrySelection || confirmCountry.isPending || supportedCountries.isError} onClick={() => confirmCountry.mutate(countrySelection)}>
            {confirmCountry.isPending ? "Saving…" : "Save country"}
          </button>
          {confirmCountry.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(confirmCountry.error)}</p> : null}
          <p className={styles.note}>International creators can still apply through the separate creator program.</p>
          <Link className={styles.linkButton} href="/creator/apply">Creator program</Link>
        </section>
      </div>
    );
  }
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Become a seller</h1>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          submit.mutate();
        }}
      >
        <label className={styles.field}>Store name
          <input className={styles.input} value={storeName} onChange={(event) => setStoreName(event.target.value)} required />
        </label>
        <label className={styles.field}>Description
          <textarea className={styles.textarea} value={description} onChange={(event) => setDescription(event.target.value)} required />
        </label>
        <label className={styles.field}>Phone
          <input className={styles.input} value={phone} onChange={(event) => setPhone(event.target.value)} required />
        </label>
        <label className={styles.field}>Address
          <input className={styles.input} value={addressLine} onChange={(event) => setAddressLine(event.target.value)} required />
        </label>
        <label className={styles.field}>City
          <input className={styles.input} value={city} onChange={(event) => setCity(event.target.value)} required />
        </label>
        <label className={styles.field}>State
          <input className={styles.input} value={state} onChange={(event) => setStateValue(event.target.value)} required />
        </label>
        <label className={styles.field}>ID number
          <input className={styles.input} value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} required />
        </label>
        <label className={styles.field}>ID photo URL
          <input className={styles.input} value={documentPhotoUrl} onChange={(event) => setDocumentPhotoUrl(event.target.value)} placeholder="Upload in the app, paste URL here" required />
        </label>
        <label className={styles.field}>Payout bank code
          <input className={styles.input} value={bankCode} onChange={(event) => setBankCode(event.target.value)} required />
        </label>
        <label className={styles.field}>Payout account number
          <input className={styles.input} value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} required />
        </label>
        <label className={styles.field}>
          <span>Can your store handle order logistics?</span>
          <span className={styles.note}>Tell us whether your business can fulfil delivery logistics. This records your capability for review; it does not activate a courier integration. Your email address is not sent to logistics providers.</span>
          <span><input type="radio" name="enableLogistics" value="yes" checked={enableLogistics === true} required onChange={() => setEnableLogistics(true)} /> Yes, we can</span>
          <span><input type="radio" name="enableLogistics" value="no" checked={enableLogistics === false} required onChange={() => setEnableLogistics(false)} /> Not yet</span>
        </label>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <button type="submit" className={styles.primary} disabled={submit.isPending || !countryEligible || enableLogistics === null}>{submit.isPending ? "Submitting…" : "Submit application"}</button>
      </form>
    </div>
  );
}
